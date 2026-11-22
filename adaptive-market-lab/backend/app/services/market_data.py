"""Market data service — fetches historical data via yfinance and processes CSV uploads."""
from __future__ import annotations

import io
import time
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
import pandas as pd
import yfinance as yf

from app.config import settings
from app.schemas.models import MarketSummary, OHLCVRow


# ── Simple in-memory cache ─────────────────────────────────────────────
_cache: dict[str, tuple[float, pd.DataFrame, dict]] = {}

PERIOD_MAP = {
    "1mo": 30,
    "3mo": 90,
    "6mo": 180,
    "1y": 365,
    "2y": 730,
    "5y": 1825,
}


def _cache_key(symbol: str, start: str, end: str) -> str:
    return f"{symbol}|{start}|{end}"


def _get_cached(key: str) -> Optional[tuple[pd.DataFrame, dict]]:
    if key in _cache:
        ts, df, meta = _cache[key]
        if time.time() - ts < settings.CACHE_TTL_SECONDS:
            return df.copy(), meta
        del _cache[key]
    return None


def _set_cache(key: str, df: pd.DataFrame, meta: dict) -> None:
    if len(_cache) >= settings.MAX_CACHE_ENTRIES:
        oldest_key = min(_cache, key=lambda k: _cache[k][0])
        del _cache[oldest_key]
    _cache[key] = (time.time(), df.copy(), meta)


# ── Symbol validation ──────────────────────────────────────────────────
def validate_symbol(symbol: str) -> dict:
    """Validate a ticker symbol by attempting to fetch its info."""
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        if not info or info.get("regularMarketPrice") is None:
            # Try fetching a small amount of history as fallback
            hist = ticker.history(period="5d")
            if hist.empty:
                return {"valid": False, "symbol": symbol, "name": None, "error": "Symbol not found or no data available"}
            return {
                "valid": True,
                "symbol": symbol.upper(),
                "name": info.get("shortName", symbol.upper()),
                "currency": info.get("currency", "USD"),
            }
        return {
            "valid": True,
            "symbol": symbol.upper(),
            "name": info.get("shortName", symbol.upper()),
            "currency": info.get("currency", "USD"),
        }
    except Exception:
        return {"valid": False, "symbol": symbol, "name": None, "error": "Could not validate symbol"}


# ── Fetch historical data ─────────────────────────────────────────────
def fetch_history(
    symbol: str,
    period: str = "1y",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> tuple[pd.DataFrame, dict]:
    """Fetch OHLCV data from Yahoo Finance.

    Returns (DataFrame with columns [Date,Open,High,Low,Close,Volume], metadata dict).
    """
    if start_date and end_date:
        cache_key = _cache_key(symbol, start_date, end_date)
    else:
        cache_key = _cache_key(symbol, period, "")

    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    ticker = yf.Ticker(symbol)

    if start_date and end_date:
        df = ticker.history(start=start_date, end=end_date, auto_adjust=True)
    else:
        df = ticker.history(period=period, auto_adjust=True)

    if df.empty:
        raise ValueError(f"No data returned for symbol '{symbol}'. It may be invalid or data is unavailable.")

    info = ticker.info
    meta = {
        "symbol": symbol.upper(),
        "name": info.get("shortName", symbol.upper()),
        "currency": info.get("currency", "USD"),
    }

    df = df.reset_index()
    # Normalize column names
    rename_map = {}
    for col in df.columns:
        lower = col.lower()
        if lower == "date":
            rename_map[col] = "Date"
        elif lower == "open":
            rename_map[col] = "Open"
        elif lower == "high":
            rename_map[col] = "High"
        elif lower == "low":
            rename_map[col] = "Low"
        elif lower == "close":
            rename_map[col] = "Close"
        elif lower == "volume":
            rename_map[col] = "Volume"
    df = df.rename(columns=rename_map)

    required_cols = {"Date", "Close"}
    if not required_cols.issubset(set(df.columns)):
        raise ValueError("Retrieved data is missing required columns (Date, Close).")

    # Ensure Date is string
    df["Date"] = pd.to_datetime(df["Date"]).dt.strftime("%Y-%m-%d")

    # Drop duplicates by date
    df = df.drop_duplicates(subset=["Date"], keep="last")
    df = df.sort_values("Date").reset_index(drop=True)

    # Keep only needed columns
    keep = [c for c in ["Date", "Open", "High", "Low", "Close", "Volume"] if c in df.columns]
    df = df[keep]

    _set_cache(cache_key, df, meta)
    return df, meta


# ── CSV Processing ─────────────────────────────────────────────────────
def process_csv(file_bytes: bytes, filename: str) -> tuple[pd.DataFrame, dict]:
    """Parse and validate an uploaded CSV file.

    Expected columns: Date, Open, High, Low, Close, Volume
    Required: Date, Close
    """
    try:
        df = pd.read_csv(io.BytesIO(file_bytes))
    except Exception as e:
        raise ValueError(f"Could not parse CSV file: {e}")

    if df.empty:
        raise ValueError("CSV file is empty.")

    # Normalize column names (case-insensitive match)
    col_map = {}
    for col in df.columns:
        lower = col.strip().lower()
        if lower in ("date", "timestamp", "time", "datetime"):
            col_map[col] = "Date"
        elif lower == "open":
            col_map[col] = "Open"
        elif lower == "high":
            col_map[col] = "High"
        elif lower == "low":
            col_map[col] = "Low"
        elif lower in ("close", "adj close", "adj_close", "adjusted_close"):
            col_map[col] = "Close"
        elif lower in ("volume", "vol"):
            col_map[col] = "Volume"
    df = df.rename(columns=col_map)

    # Validate required columns
    missing = {"Date", "Close"} - set(df.columns)
    if missing:
        raise ValueError(f"CSV is missing required columns: {', '.join(missing)}. Found columns: {', '.join(df.columns)}")

    # Parse dates
    try:
        df["Date"] = pd.to_datetime(df["Date"]).dt.strftime("%Y-%m-%d")
    except Exception:
        raise ValueError("Could not parse the 'Date' column. Ensure dates are in a recognizable format (e.g., YYYY-MM-DD).")

    # Validate Close prices
    df["Close"] = pd.to_numeric(df["Close"], errors="coerce")
    null_close_count = df["Close"].isna().sum()
    if null_close_count > 0:
        if null_close_count == len(df):
            raise ValueError("All Close prices are invalid or missing.")
        df = df.dropna(subset=["Close"])

    if (df["Close"] < 0).any():
        raise ValueError("Close prices contain negative values.")

    # Convert numeric columns
    for col in ["Open", "High", "Low", "Volume"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Drop duplicate dates
    dup_count = df.duplicated(subset=["Date"]).sum()
    if dup_count > 0:
        df = df.drop_duplicates(subset=["Date"], keep="last")

    df = df.sort_values("Date").reset_index(drop=True)

    keep = [c for c in ["Date", "Open", "High", "Low", "Close", "Volume"] if c in df.columns]
    df = df[keep]

    meta = {
        "symbol": filename.replace(".csv", "").upper(),
        "name": filename,
        "currency": "N/A",
    }

    return df, meta


# ── Summary ────────────────────────────────────────────────────────────
def compute_summary(df: pd.DataFrame) -> MarketSummary:
    """Compute market summary statistics from OHLCV data."""
    closes = df["Close"].values
    latest = float(closes[-1])
    prev = float(closes[-2]) if len(closes) >= 2 else None
    change = latest - prev if prev is not None else None
    change_pct = (change / prev * 100) if prev and prev != 0 else None

    highest = float(df["High"].max()) if "High" in df.columns else float(np.max(closes))
    lowest = float(df["Low"].min()) if "Low" in df.columns else float(np.min(closes))
    avg_vol = float(df["Volume"].mean()) if "Volume" in df.columns and df["Volume"].notna().any() else None

    return MarketSummary(
        latest_close=round(latest, 2),
        previous_close=round(prev, 2) if prev is not None else None,
        price_change=round(change, 2) if change is not None else None,
        price_change_pct=round(change_pct, 2) if change_pct is not None else None,
        highest=round(highest, 2),
        lowest=round(lowest, 2),
        avg_volume=round(avg_vol, 0) if avg_vol is not None else None,
    )


def df_to_rows(df: pd.DataFrame) -> list[OHLCVRow]:
    """Convert DataFrame to list of OHLCVRow."""
    rows: list[OHLCVRow] = []
    for _, r in df.iterrows():
        rows.append(
            OHLCVRow(
                date=r["Date"],
                open=round(float(r["Open"]), 2) if "Open" in r and pd.notna(r.get("Open")) else None,
                high=round(float(r["High"]), 2) if "High" in r and pd.notna(r.get("High")) else None,
                low=round(float(r["Low"]), 2) if "Low" in r and pd.notna(r.get("Low")) else None,
                close=round(float(r["Close"]), 2),
                volume=float(r["Volume"]) if "Volume" in r and pd.notna(r.get("Volume")) else None,
            )
        )
    return rows

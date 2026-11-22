"""Pydantic schemas for request/response validation."""
from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ── Enums ──────────────────────────────────────────────────────────────
class IndicatorType(str, Enum):
    SMA = "SMA"
    EMA = "EMA"
    KAMA = "KAMA"


class SignalType(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


# ── Market Data ────────────────────────────────────────────────────────
class MarketSearchRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=20)


class MarketHistoryRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=20)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    period: Optional[str] = Field(default="1y", pattern=r"^(1mo|3mo|6mo|1y|2y|5y|max)$")


class OHLCVRow(BaseModel):
    date: str
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: float
    volume: Optional[float] = None


class MarketSummary(BaseModel):
    latest_close: float
    previous_close: Optional[float] = None
    price_change: Optional[float] = None
    price_change_pct: Optional[float] = None
    highest: float
    lowest: float
    avg_volume: Optional[float] = None


class MarketDataResponse(BaseModel):
    symbol: str
    name: Optional[str] = None
    currency: Optional[str] = None
    data: list[OHLCVRow]
    summary: Optional[MarketSummary] = None


# ── Indicators ─────────────────────────────────────────────────────────
class IndicatorRequest(BaseModel):
    close_prices: list[float] = Field(..., min_length=2)
    indicators: list[IndicatorConfig]

    @field_validator("close_prices")
    @classmethod
    def validate_prices(cls, v: list[float]) -> list[float]:
        if any(p < 0 for p in v):
            raise ValueError("Prices must be non-negative")
        return v


class IndicatorConfig(BaseModel):
    type: IndicatorType
    period: int = Field(default=20, ge=2, le=500)
    # KAMA-specific
    fast_period: int = Field(default=2, ge=2, le=50)
    slow_period: int = Field(default=30, ge=10, le=500)


class IndicatorResult(BaseModel):
    type: str
    period: int
    values: list[Optional[float]]
    params: dict = {}


class IndicatorResponse(BaseModel):
    results: list[IndicatorResult]


# ── Signals ────────────────────────────────────────────────────────────
class SignalRequest(BaseModel):
    close_prices: list[float] = Field(..., min_length=2)
    dates: list[str]
    fast_type: IndicatorType = IndicatorType.EMA
    slow_type: IndicatorType = IndicatorType.SMA
    fast_period: int = Field(default=12, ge=2, le=500)
    slow_period: int = Field(default=26, ge=2, le=500)

    @field_validator("slow_period")
    @classmethod
    def slow_gt_fast(cls, v: int, info) -> int:
        fast = info.data.get("fast_period", 12)
        if v <= fast:
            raise ValueError("slow_period must be greater than fast_period")
        return v


class CrossoverSignal(BaseModel):
    date: str
    price: float
    signal_type: SignalType
    fast_value: float
    slow_value: float
    explanation: str


class SignalResponse(BaseModel):
    signals: list[CrossoverSignal]
    fast_values: list[Optional[float]]
    slow_values: list[Optional[float]]


# ── Backtesting ────────────────────────────────────────────────────────
class BacktestRequest(BaseModel):
    close_prices: list[float] = Field(..., min_length=2)
    dates: list[str]
    initial_capital: float = Field(default=100000.0, gt=0)
    fast_type: IndicatorType = IndicatorType.EMA
    slow_type: IndicatorType = IndicatorType.SMA
    fast_period: int = Field(default=12, ge=2, le=500)
    slow_period: int = Field(default=26, ge=2, le=500)
    fee_pct: float = Field(default=0.1, ge=0, le=5.0)

    @field_validator("slow_period")
    @classmethod
    def slow_gt_fast(cls, v: int, info) -> int:
        fast = info.data.get("fast_period", 12)
        if v <= fast:
            raise ValueError("slow_period must be greater than fast_period")
        return v


class TradeRecord(BaseModel):
    entry_date: str
    entry_price: float
    exit_date: Optional[str] = None
    exit_price: Optional[float] = None
    shares: float
    pnl: Optional[float] = None
    pnl_pct: Optional[float] = None
    fees_paid: float = 0.0


class BacktestMetrics(BaseModel):
    initial_capital: float
    final_value: float
    total_return: float
    total_return_pct: float
    num_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: Optional[float] = None
    max_drawdown: float
    max_drawdown_pct: float
    sharpe_ratio: Optional[float] = None
    buy_hold_return: float
    buy_hold_return_pct: float


class BacktestResponse(BaseModel):
    metrics: BacktestMetrics
    trades: list[TradeRecord]
    equity_curve: list[float]
    drawdown_curve: list[float]
    buy_hold_curve: list[float]


# ── Reports ────────────────────────────────────────────────────────────
class ReportRequest(BaseModel):
    symbol: str = ""
    dates: list[str] = []
    close_prices: list[float] = []
    indicators: list[IndicatorResult] = []
    signals: list[CrossoverSignal] = []
    backtest_metrics: Optional[BacktestMetrics] = None
    trades: list[TradeRecord] = []
    format: str = Field(default="pdf", pattern=r"^(pdf|csv)$")
    report_type: str = Field(
        default="full", pattern=r"^(full|data|signals|backtest)$"
    )


# ── Generic ────────────────────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str
    version: str
    timestamp: str


class ErrorResponse(BaseModel):
    detail: str

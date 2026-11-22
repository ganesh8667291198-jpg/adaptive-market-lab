"""API routes."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import Response

from app.config import settings
from app.schemas.models import (
    BacktestRequest,
    BacktestResponse,
    ErrorResponse,
    HealthResponse,
    IndicatorConfig,
    IndicatorRequest,
    IndicatorResponse,
    IndicatorResult,
    MarketDataResponse,
    ReportRequest,
    SignalRequest,
    SignalResponse,
)
from app.services import backtesting as bt_service
from app.services import indicators as ind_service
from app.services import market_data as md_service
from app.services import reports as report_service
from app.services import signals as sig_service

router = APIRouter(prefix="/api")


# ── Health ─────────────────────────────────────────────────────────────
@router.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="healthy",
        version=settings.APP_VERSION,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


# ── Market Data ────────────────────────────────────────────────────────
@router.get("/market/search")
async def market_search(symbol: str = Query(..., min_length=1, max_length=20)):
    result = md_service.validate_symbol(symbol.strip())
    if not result["valid"]:
        raise HTTPException(status_code=404, detail=result.get("error", "Symbol not found"))
    return result


@router.get("/market/history", response_model=MarketDataResponse)
async def market_history(
    symbol: str = Query(..., min_length=1, max_length=20),
    period: Optional[str] = Query(default="1y", pattern=r"^(1mo|3mo|6mo|1y|2y|5y|max)$"),
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
):
    try:
        df, meta = md_service.fetch_history(
            symbol.strip(),
            period=period or "1y",
            start_date=start_date,
            end_date=end_date,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch data: {str(e)}")

    rows = md_service.df_to_rows(df)
    summary = md_service.compute_summary(df)

    return MarketDataResponse(
        symbol=meta["symbol"],
        name=meta.get("name"),
        currency=meta.get("currency"),
        data=rows,
        summary=summary,
    )


# ── CSV Upload ─────────────────────────────────────────────────────────
@router.post("/data/upload", response_model=MarketDataResponse)
async def upload_csv(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    contents = await file.read()
    if len(contents) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum size is {settings.MAX_UPLOAD_SIZE_MB}MB.")

    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="File is empty.")

    try:
        df, meta = md_service.process_csv(contents, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    rows = md_service.df_to_rows(df)
    summary = md_service.compute_summary(df)

    return MarketDataResponse(
        symbol=meta["symbol"],
        name=meta.get("name"),
        currency=meta.get("currency"),
        data=rows,
        summary=summary,
    )


# ── Indicators ─────────────────────────────────────────────────────────
@router.post("/indicators/calculate", response_model=IndicatorResponse)
async def calculate_indicators(req: IndicatorRequest):
    results: list[IndicatorResult] = []

    for cfg in req.indicators:
        try:
            values = ind_service.compute_indicator(
                cfg.type.value,
                req.close_prices,
                period=cfg.period,
                fast_period=cfg.fast_period,
                slow_period=cfg.slow_period,
            )
            params = {}
            if cfg.type.value == "KAMA":
                params = {"fast_period": cfg.fast_period, "slow_period": cfg.slow_period}

            results.append(IndicatorResult(
                type=cfg.type.value,
                period=cfg.period,
                values=values,
                params=params,
            ))
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    return IndicatorResponse(results=results)


# ── Signals ────────────────────────────────────────────────────────────
@router.post("/signals/detect", response_model=SignalResponse)
async def detect_signals(req: SignalRequest):
    if len(req.close_prices) != len(req.dates):
        raise HTTPException(status_code=400, detail="close_prices and dates must have the same length")

    try:
        signals, fast_vals, slow_vals = sig_service.detect_crossovers(
            req.close_prices,
            req.dates,
            fast_type=req.fast_type.value,
            slow_type=req.slow_type.value,
            fast_period=req.fast_period,
            slow_period=req.slow_period,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return SignalResponse(signals=signals, fast_values=fast_vals, slow_values=slow_vals)


# ── Backtesting ────────────────────────────────────────────────────────
@router.post("/backtest/run", response_model=BacktestResponse)
async def run_backtest(req: BacktestRequest):
    if len(req.close_prices) != len(req.dates):
        raise HTTPException(status_code=400, detail="close_prices and dates must have the same length")

    try:
        result = bt_service.run_backtest(
            req.close_prices,
            req.dates,
            initial_capital=req.initial_capital,
            fast_type=req.fast_type.value,
            slow_type=req.slow_type.value,
            fast_period=req.fast_period,
            slow_period=req.slow_period,
            fee_pct=req.fee_pct,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return result


# ── Reports ────────────────────────────────────────────────────────────
@router.post("/reports/export")
async def export_report(req: ReportRequest):
    try:
        if req.format == "csv":
            if req.report_type == "data":
                content = report_service.generate_data_csv(req.dates, req.close_prices)
                filename = f"{req.symbol or 'data'}_market_data.csv"
            elif req.report_type == "signals":
                content = report_service.generate_signals_csv(req.signals)
                filename = f"{req.symbol or 'data'}_signals.csv"
            elif req.report_type == "backtest":
                content = report_service.generate_backtest_csv(req.backtest_metrics, req.trades)
                filename = f"{req.symbol or 'data'}_backtest.csv"
            else:
                # Full data CSV
                content = report_service.generate_data_csv(req.dates, req.close_prices)
                filename = f"{req.symbol or 'data'}_full_data.csv"

            return Response(
                content=content,
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename={filename}"},
            )

        elif req.format == "pdf":
            content = report_service.generate_pdf_report(
                symbol=req.symbol,
                dates=req.dates,
                close_prices=req.close_prices,
                indicators=req.indicators,
                signals=req.signals,
                backtest_metrics=req.backtest_metrics,
                trades=req.trades,
            )
            filename = f"{req.symbol or 'analysis'}_report.pdf"
            return Response(
                content=content,
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename={filename}"},
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")

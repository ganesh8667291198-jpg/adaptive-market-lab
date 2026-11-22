"""Report generation service — PDF and CSV exports."""
from __future__ import annotations

import csv
import io
from datetime import datetime
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.schemas.models import BacktestMetrics, CrossoverSignal, IndicatorResult, TradeRecord


def generate_data_csv(dates: list[str], close_prices: list[float]) -> bytes:
    """Export raw market data as CSV."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Date", "Close"])
    for d, c in zip(dates, close_prices):
        writer.writerow([d, round(c, 2)])
    return buf.getvalue().encode("utf-8")


def generate_signals_csv(signals: list[CrossoverSignal]) -> bytes:
    """Export crossover signals as CSV."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Date", "Type", "Price", "Fast MA", "Slow MA", "Explanation"])
    for s in signals:
        writer.writerow([s.date, s.signal_type, s.price, s.fast_value, s.slow_value, s.explanation])
    return buf.getvalue().encode("utf-8")


def generate_backtest_csv(
    metrics: Optional[BacktestMetrics], trades: list[TradeRecord]
) -> bytes:
    """Export backtest results as CSV."""
    buf = io.StringIO()
    writer = csv.writer(buf)

    # Metrics section
    if metrics:
        writer.writerow(["=== Performance Metrics ==="])
        writer.writerow(["Metric", "Value"])
        writer.writerow(["Initial Capital", metrics.initial_capital])
        writer.writerow(["Final Value", metrics.final_value])
        writer.writerow(["Total Return", metrics.total_return])
        writer.writerow(["Total Return %", metrics.total_return_pct])
        writer.writerow(["Trades", metrics.num_trades])
        writer.writerow(["Winning Trades", metrics.winning_trades])
        writer.writerow(["Losing Trades", metrics.losing_trades])
        writer.writerow(["Win Rate %", metrics.win_rate])
        writer.writerow(["Max Drawdown", metrics.max_drawdown])
        writer.writerow(["Max Drawdown %", metrics.max_drawdown_pct])
        writer.writerow(["Sharpe Ratio", metrics.sharpe_ratio])
        writer.writerow(["Buy & Hold Return", metrics.buy_hold_return])
        writer.writerow(["Buy & Hold Return %", metrics.buy_hold_return_pct])
        writer.writerow([])

    # Trades section
    writer.writerow(["=== Trade History ==="])
    writer.writerow(["Entry Date", "Entry Price", "Exit Date", "Exit Price", "Shares", "P&L", "P&L %", "Fees"])
    for t in trades:
        writer.writerow([
            t.entry_date, t.entry_price, t.exit_date or "Open",
            t.exit_price or "N/A", t.shares, t.pnl, t.pnl_pct, t.fees_paid,
        ])
    return buf.getvalue().encode("utf-8")


def generate_pdf_report(
    symbol: str,
    dates: list[str],
    close_prices: list[float],
    indicators: list[IndicatorResult],
    signals: list[CrossoverSignal],
    backtest_metrics: Optional[BacktestMetrics],
    trades: list[TradeRecord],
) -> bytes:
    """Generate a comprehensive PDF analysis report."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm,
                            topMargin=20 * mm, bottomMargin=20 * mm)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title2", parent=styles["Title"], fontSize=20, spaceAfter=12)
    heading_style = ParagraphStyle("Heading2a", parent=styles["Heading2"], fontSize=14, spaceBefore=16, spaceAfter=8)
    body_style = ParagraphStyle("Body2", parent=styles["Normal"], fontSize=10, spaceAfter=6)
    small_style = ParagraphStyle("Small", parent=styles["Normal"], fontSize=8, textColor=colors.gray)

    elements: list = []

    # Title
    elements.append(Paragraph("Adaptive Market Lab — Analysis Report", title_style))
    elements.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", small_style))
    elements.append(Spacer(1, 10))

    # Overview
    elements.append(Paragraph("1. Analysis Overview", heading_style))
    if symbol:
        elements.append(Paragraph(f"<b>Symbol / Dataset:</b> {symbol}", body_style))
    if dates:
        elements.append(Paragraph(f"<b>Date Range:</b> {dates[0]} to {dates[-1]}", body_style))
        elements.append(Paragraph(f"<b>Data Points:</b> {len(dates)}", body_style))
    if close_prices:
        elements.append(Paragraph(f"<b>Latest Close:</b> {round(close_prices[-1], 2)}", body_style))
    elements.append(Spacer(1, 8))

    # Indicators
    if indicators:
        elements.append(Paragraph("2. Indicator Parameters", heading_style))
        for ind in indicators:
            params_str = f"Period={ind.period}"
            if ind.params:
                params_str += ", " + ", ".join(f"{k}={v}" for k, v in ind.params.items())
            non_null = sum(1 for v in ind.values if v is not None)
            elements.append(Paragraph(f"<b>{ind.type}</b>: {params_str} — {non_null} computed values", body_style))
        elements.append(Spacer(1, 8))

    # Signals
    if signals:
        elements.append(Paragraph("3. Crossover Signals", heading_style))
        buy_count = sum(1 for s in signals if s.signal_type == "BUY")
        sell_count = sum(1 for s in signals if s.signal_type == "SELL")
        elements.append(Paragraph(f"Total: {len(signals)} signals ({buy_count} BUY, {sell_count} SELL)", body_style))

        sig_data = [["Date", "Type", "Price", "Fast MA", "Slow MA"]]
        for s in signals[:30]:  # Limit to 30 for readability
            sig_data.append([s.date, s.signal_type, str(s.price), str(s.fast_value), str(s.slow_value)])

        if sig_data:
            t = Table(sig_data, repeatRows=1)
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.gray),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
            ]))
            elements.append(t)

        if len(signals) > 30:
            elements.append(Paragraph(f"... and {len(signals) - 30} more signals (see CSV export for full list)", small_style))
        elements.append(Spacer(1, 8))

    # Backtest
    if backtest_metrics:
        elements.append(Paragraph("4. Backtesting Results", heading_style))
        m = backtest_metrics
        metrics_data = [
            ["Metric", "Value"],
            ["Initial Capital", f"{m.initial_capital:,.2f}"],
            ["Final Portfolio Value", f"{m.final_value:,.2f}"],
            ["Total Return", f"{m.total_return:,.2f} ({m.total_return_pct:+.2f}%)"],
            ["Completed Trades", str(m.num_trades)],
            ["Winning / Losing", f"{m.winning_trades} / {m.losing_trades}"],
            ["Win Rate", f"{m.win_rate:.1f}%" if m.win_rate is not None else "N/A"],
            ["Max Drawdown", f"{m.max_drawdown:,.2f} ({m.max_drawdown_pct:.2f}%)"],
            ["Sharpe Ratio", f"{m.sharpe_ratio:.4f}" if m.sharpe_ratio is not None else "N/A"],
            ["Buy & Hold Return", f"{m.buy_hold_return:,.2f} ({m.buy_hold_return_pct:+.2f}%)"],
        ]
        t = Table(metrics_data, colWidths=[140, 200])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.gray),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 8))

        # Trade log
        if trades:
            elements.append(Paragraph("Trade History", heading_style))
            trade_data = [["Entry", "Entry Price", "Exit", "Exit Price", "Shares", "P&L", "P&L %"]]
            for tr in trades[:20]:
                trade_data.append([
                    tr.entry_date, f"{tr.entry_price:.2f}",
                    tr.exit_date or "Open", f"{tr.exit_price:.2f}" if tr.exit_price else "—",
                    str(int(tr.shares)),
                    f"{tr.pnl:+.2f}" if tr.pnl is not None else "—",
                    f"{tr.pnl_pct:+.2f}%" if tr.pnl_pct is not None else "—",
                ])
            t = Table(trade_data, repeatRows=1)
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.gray),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
            ]))
            elements.append(t)

    # Disclaimer
    elements.append(Spacer(1, 20))
    elements.append(Paragraph("5. Limitations & Disclaimer", heading_style))
    elements.append(Paragraph(
        "This report is generated for academic and educational purposes only. "
        "Moving average crossover signals are not guaranteed predictions of future price movements. "
        "Historical backtesting results do not guarantee future returns. "
        "Market data sourced via Yahoo Finance may be delayed, incomplete, or adjusted. "
        "Transaction costs in backtesting are simplified (flat percentage) and may not reflect actual brokerage fees. "
        "This tool does not account for slippage, market impact, or liquidity constraints.",
        body_style,
    ))

    doc.build(elements)
    return buf.getvalue()

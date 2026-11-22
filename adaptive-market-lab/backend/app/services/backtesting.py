"""Backtesting engine — long-only crossover strategy."""
from __future__ import annotations

from typing import Optional

import numpy as np

from app.schemas.models import BacktestMetrics, BacktestResponse, SignalType, TradeRecord
from app.services.signals import detect_crossovers


def run_backtest(
    close_prices: list[float],
    dates: list[str],
    initial_capital: float = 100000.0,
    fast_type: str = "EMA",
    slow_type: str = "SMA",
    fast_period: int = 12,
    slow_period: int = 26,
    fee_pct: float = 0.1,
) -> BacktestResponse:
    """Execute a long-only crossover backtest.

    Rules:
    - Enter (buy) on the next candle after a BUY signal.
    - Exit (sell) on the next candle after a SELL signal.
    - Next-candle execution avoids look-ahead bias.
    - Transaction fees are applied on both entry and exit.
    - No short selling. No leverage. No partial fills.
    """
    n = len(close_prices)
    if n != len(dates):
        raise ValueError("close_prices and dates must have the same length")
    if n < 2:
        raise ValueError("Need at least 2 data points for backtesting")

    signals, _, _ = detect_crossovers(
        close_prices, dates, fast_type, slow_type, fast_period, slow_period
    )

    # Build signal schedule: map date index to signal type
    # Signals execute on the NEXT candle
    date_to_idx = {d: i for i, d in enumerate(dates)}
    execution_schedule: dict[int, SignalType] = {}
    for sig in signals:
        sig_idx = date_to_idx.get(sig.date)
        if sig_idx is not None and sig_idx + 1 < n:
            exec_idx = sig_idx + 1
            execution_schedule[exec_idx] = sig.signal_type

    # Run simulation
    cash = initial_capital
    shares = 0.0
    trades: list[TradeRecord] = []
    current_entry: Optional[dict] = None
    equity_curve: list[float] = []
    fee_rate = fee_pct / 100.0

    for i in range(n):
        price = close_prices[i]

        # Execute scheduled signals
        if i in execution_schedule:
            action = execution_schedule[i]

            if action == SignalType.BUY and shares == 0 and cash > 0:
                # Buy as many whole shares as possible
                cost_per_share = price * (1 + fee_rate)
                max_shares = int(cash / cost_per_share)
                if max_shares > 0:
                    total_cost = max_shares * price
                    fees = total_cost * fee_rate
                    cash -= total_cost + fees
                    shares = max_shares
                    current_entry = {
                        "entry_date": dates[i],
                        "entry_price": price,
                        "shares": max_shares,
                        "fees_paid": round(fees, 2),
                    }

            elif action == SignalType.SELL and shares > 0:
                # Sell all shares
                total_proceeds = shares * price
                fees = total_proceeds * fee_rate
                cash += total_proceeds - fees

                if current_entry is not None:
                    pnl = (price - current_entry["entry_price"]) * shares - current_entry["fees_paid"] - fees
                    pnl_pct = (price - current_entry["entry_price"]) / current_entry["entry_price"] * 100
                    trades.append(
                        TradeRecord(
                            entry_date=current_entry["entry_date"],
                            entry_price=round(current_entry["entry_price"], 2),
                            exit_date=dates[i],
                            exit_price=round(price, 2),
                            shares=current_entry["shares"],
                            pnl=round(pnl, 2),
                            pnl_pct=round(pnl_pct, 2),
                            fees_paid=round(current_entry["fees_paid"] + fees, 2),
                        )
                    )
                    current_entry = None

                shares = 0

        # Portfolio value
        portfolio_value = cash + shares * price
        equity_curve.append(round(portfolio_value, 2))

    # If still holding at end, record as open trade
    if shares > 0 and current_entry is not None:
        final_price = close_prices[-1]
        pnl = (final_price - current_entry["entry_price"]) * shares - current_entry["fees_paid"]
        pnl_pct = (final_price - current_entry["entry_price"]) / current_entry["entry_price"] * 100
        trades.append(
            TradeRecord(
                entry_date=current_entry["entry_date"],
                entry_price=round(current_entry["entry_price"], 2),
                exit_date=None,
                exit_price=None,
                shares=current_entry["shares"],
                pnl=round(pnl, 2),
                pnl_pct=round(pnl_pct, 2),
                fees_paid=round(current_entry["fees_paid"], 2),
            )
        )

    # ── Metrics ────────────────────────────────────────────────────────
    final_value = equity_curve[-1] if equity_curve else initial_capital
    total_return = final_value - initial_capital
    total_return_pct = (total_return / initial_capital) * 100

    completed = [t for t in trades if t.exit_date is not None]
    num_trades = len(completed)
    winning = sum(1 for t in completed if t.pnl is not None and t.pnl > 0)
    losing = sum(1 for t in completed if t.pnl is not None and t.pnl <= 0)
    win_rate = round(winning / num_trades * 100, 2) if num_trades > 0 else None

    # Drawdown
    eq = np.array(equity_curve, dtype=np.float64)
    running_max = np.maximum.accumulate(eq)
    drawdown_abs = running_max - eq
    drawdown_pct_arr = np.where(running_max > 0, drawdown_abs / running_max * 100, 0.0)
    max_dd = float(np.max(drawdown_abs))
    max_dd_pct = float(np.max(drawdown_pct_arr))

    # Sharpe ratio (annualized, assuming ~252 trading days)
    sharpe = None
    if len(equity_curve) > 1:
        daily_returns = np.diff(eq) / eq[:-1]
        if len(daily_returns) > 1 and np.std(daily_returns) > 0:
            sharpe = round(float(np.mean(daily_returns) / np.std(daily_returns) * np.sqrt(252)), 4)

    # Buy and hold
    bh_shares = int(initial_capital / close_prices[0])
    bh_curve = [round(bh_shares * p + (initial_capital - bh_shares * close_prices[0]), 2) for p in close_prices]
    bh_final = bh_curve[-1]
    bh_return = bh_final - initial_capital
    bh_return_pct = (bh_return / initial_capital) * 100

    metrics = BacktestMetrics(
        initial_capital=round(initial_capital, 2),
        final_value=round(final_value, 2),
        total_return=round(total_return, 2),
        total_return_pct=round(total_return_pct, 2),
        num_trades=num_trades,
        winning_trades=winning,
        losing_trades=losing,
        win_rate=win_rate,
        max_drawdown=round(max_dd, 2),
        max_drawdown_pct=round(max_dd_pct, 2),
        sharpe_ratio=sharpe,
        buy_hold_return=round(bh_return, 2),
        buy_hold_return_pct=round(bh_return_pct, 2),
    )

    return BacktestResponse(
        metrics=metrics,
        trades=trades,
        equity_curve=equity_curve,
        drawdown_curve=[round(float(d), 2) for d in drawdown_pct_arr],
        buy_hold_curve=bh_curve,
    )

"""Crossover signal detection service."""
from __future__ import annotations

from typing import Optional

from app.schemas.models import CrossoverSignal, SignalType
from app.services.indicators import compute_indicator


def detect_crossovers(
    close_prices: list[float],
    dates: list[str],
    fast_type: str = "EMA",
    slow_type: str = "SMA",
    fast_period: int = 12,
    slow_period: int = 26,
) -> tuple[list[CrossoverSignal], list[Optional[float]], list[Optional[float]]]:
    """Detect buy/sell crossover signals between fast and slow moving averages.

    BUY:  fast crosses above slow (fast[t] > slow[t] AND fast[t-1] <= slow[t-1])
    SELL: fast crosses below slow (fast[t] < slow[t] AND fast[t-1] >= slow[t-1])

    Returns (signals, fast_values, slow_values).
    """
    n = len(close_prices)
    if n != len(dates):
        raise ValueError("close_prices and dates must have the same length")

    fast_values = compute_indicator(fast_type, close_prices, fast_period)
    slow_values = compute_indicator(slow_type, close_prices, slow_period)

    signals: list[CrossoverSignal] = []

    for i in range(1, n):
        f_prev = fast_values[i - 1]
        f_curr = fast_values[i]
        s_prev = slow_values[i - 1]
        s_curr = slow_values[i]

        # Skip if any value is None (insufficient data for indicator)
        if any(v is None for v in (f_prev, f_curr, s_prev, s_curr)):
            continue

        # BUY crossover: fast crosses above slow
        if f_prev <= s_prev and f_curr > s_curr:
            signals.append(
                CrossoverSignal(
                    date=dates[i],
                    price=round(close_prices[i], 2),
                    signal_type=SignalType.BUY,
                    fast_value=round(f_curr, 2),
                    slow_value=round(s_curr, 2),
                    explanation=(
                        f"BUY signal: {fast_type}({fast_period}) = {round(f_curr, 2)} "
                        f"crossed above {slow_type}({slow_period}) = {round(s_curr, 2)}. "
                        f"The short-term average has moved above the long-term average, "
                        f"indicating a potential upward momentum shift. "
                        f"This is not a guaranteed prediction of future price increases."
                    ),
                )
            )

        # SELL crossover: fast crosses below slow
        elif f_prev >= s_prev and f_curr < s_curr:
            signals.append(
                CrossoverSignal(
                    date=dates[i],
                    price=round(close_prices[i], 2),
                    signal_type=SignalType.SELL,
                    fast_value=round(f_curr, 2),
                    slow_value=round(s_curr, 2),
                    explanation=(
                        f"SELL signal: {fast_type}({fast_period}) = {round(f_curr, 2)} "
                        f"crossed below {slow_type}({slow_period}) = {round(s_curr, 2)}. "
                        f"The short-term average has moved below the long-term average, "
                        f"indicating a potential downward momentum shift. "
                        f"This is not a guaranteed prediction of future price decreases."
                    ),
                )
            )

    return signals, fast_values, slow_values

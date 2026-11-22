"""Technical indicator calculations — SMA, EMA, KAMA.

All calculations use NumPy vectorized operations where possible.
"""
from __future__ import annotations

from typing import Optional

import numpy as np


def calculate_sma(prices: list[float], period: int) -> list[Optional[float]]:
    """Simple Moving Average.

    SMA_t = (1/N) * Σ(Price_{t-i}) for i = 0..N-1

    Returns None for positions where insufficient data exists.
    """
    n = len(prices)
    if n < period:
        return [None] * n

    arr = np.array(prices, dtype=np.float64)
    result: list[Optional[float]] = [None] * (period - 1)

    # Vectorized cumsum approach
    cumsum = np.cumsum(arr)
    cumsum = np.insert(cumsum, 0, 0.0)
    sma_values = (cumsum[period:] - cumsum[:-period]) / period

    result.extend(round(float(v), 6) for v in sma_values)
    return result


def calculate_ema(prices: list[float], period: int) -> list[Optional[float]]:
    """Exponential Moving Average.

    α = 2 / (N + 1)
    EMA_t = Price_t * α + EMA_{t-1} * (1 - α)

    The first EMA value is seeded with the SMA of the first `period` prices.
    Returns None for positions where insufficient data exists.
    """
    n = len(prices)
    if n < period:
        return [None] * n

    arr = np.array(prices, dtype=np.float64)
    alpha = 2.0 / (period + 1)

    result: list[Optional[float]] = [None] * (period - 1)

    # Seed with SMA
    seed = float(np.mean(arr[:period]))
    result.append(round(seed, 6))

    ema = seed
    for i in range(period, n):
        ema = arr[i] * alpha + ema * (1 - alpha)
        result.append(round(float(ema), 6))

    return result


def calculate_kama(
    prices: list[float],
    er_period: int = 10,
    fast_period: int = 2,
    slow_period: int = 30,
) -> list[Optional[float]]:
    """Kaufman Adaptive Moving Average (KAMA).

    1. Efficiency Ratio (ER):
       Direction = |Price_t - Price_{t - er_period}|
       Volatility = Σ |Price_i - Price_{i-1}| for i = t-er_period+1 .. t
       ER = Direction / Volatility   (0 if Volatility == 0)

    2. Smoothing Constant (SC):
       fast_sc = 2 / (fast_period + 1)
       slow_sc = 2 / (slow_period + 1)
       SC = (ER * (fast_sc - slow_sc) + slow_sc) ** 2

    3. KAMA:
       KAMA_t = KAMA_{t-1} + SC * (Price_t - KAMA_{t-1})

    The first KAMA value is seeded at index `er_period - 1` with the closing price.
    Returns None for positions where insufficient data exists.
    """
    n = len(prices)
    if n < er_period:
        return [None] * n

    arr = np.array(prices, dtype=np.float64)
    fast_sc = 2.0 / (fast_period + 1)
    slow_sc = 2.0 / (slow_period + 1)

    result: list[Optional[float]] = [None] * (er_period - 1)

    # Seed KAMA with the price at index er_period - 1
    kama = arr[er_period - 1]
    result.append(round(float(kama), 6))

    for i in range(er_period, n):
        direction = abs(arr[i] - arr[i - er_period])
        volatility = float(np.sum(np.abs(np.diff(arr[i - er_period : i + 1]))))

        if volatility == 0:
            er = 0.0
        else:
            er = direction / volatility

        sc = (er * (fast_sc - slow_sc) + slow_sc) ** 2
        kama = kama + sc * (arr[i] - kama)
        result.append(round(float(kama), 6))

    return result


# ── Dispatcher ─────────────────────────────────────────────────────────
def compute_indicator(
    indicator_type: str,
    prices: list[float],
    period: int = 20,
    fast_period: int = 2,
    slow_period: int = 30,
) -> list[Optional[float]]:
    """Route to the correct indicator calculation."""
    t = indicator_type.upper()
    if t == "SMA":
        return calculate_sma(prices, period)
    elif t == "EMA":
        return calculate_ema(prices, period)
    elif t == "KAMA":
        return calculate_kama(prices, period, fast_period, slow_period)
    else:
        raise ValueError(f"Unknown indicator type: {indicator_type}")

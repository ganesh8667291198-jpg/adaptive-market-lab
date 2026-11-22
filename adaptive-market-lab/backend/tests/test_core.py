"""Comprehensive backend tests for Adaptive Market Lab."""
import io
import json
import math
from unittest.mock import patch

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.indicators import calculate_ema, calculate_kama, calculate_sma
from app.services.signals import detect_crossovers
from app.services.backtesting import run_backtest
from app.services.market_data import process_csv, compute_summary

client = TestClient(app)


# ═══════════════════════════════════════════════════════════════════════
# SMA Tests
# ═══════════════════════════════════════════════════════════════════════

class TestSMA:
    def test_basic_sma(self):
        prices = [10.0, 20.0, 30.0, 40.0, 50.0]
        result = calculate_sma(prices, 3)
        assert result[0] is None
        assert result[1] is None
        assert result[2] == pytest.approx(20.0, abs=0.01)
        assert result[3] == pytest.approx(30.0, abs=0.01)
        assert result[4] == pytest.approx(40.0, abs=0.01)

    def test_sma_period_equals_length(self):
        prices = [10.0, 20.0, 30.0]
        result = calculate_sma(prices, 3)
        assert result[0] is None
        assert result[1] is None
        assert result[2] == pytest.approx(20.0, abs=0.01)

    def test_sma_period_exceeds_length(self):
        prices = [10.0, 20.0]
        result = calculate_sma(prices, 5)
        assert all(v is None for v in result)

    def test_sma_constant_prices(self):
        prices = [100.0] * 10
        result = calculate_sma(prices, 5)
        for v in result[4:]:
            assert v == pytest.approx(100.0, abs=0.01)

    def test_sma_two_elements(self):
        prices = [10.0, 20.0]
        result = calculate_sma(prices, 2)
        assert result[0] is None
        assert result[1] == pytest.approx(15.0, abs=0.01)


# ═══════════════════════════════════════════════════════════════════════
# EMA Tests
# ═══════════════════════════════════════════════════════════════════════

class TestEMA:
    def test_basic_ema(self):
        prices = [22.0, 22.5, 23.0, 23.5, 24.0, 24.5, 25.0]
        result = calculate_ema(prices, 3)
        assert result[0] is None
        assert result[1] is None
        assert result[2] is not None  # First EMA = SMA of first 3
        assert result[2] == pytest.approx(22.5, abs=0.01)  # SMA seed
        # EMA should react to rising prices
        for i in range(3, len(result)):
            assert result[i] > result[i - 1]  # Uptrend

    def test_ema_period_exceeds_length(self):
        prices = [10.0, 20.0]
        result = calculate_ema(prices, 5)
        assert all(v is None for v in result)

    def test_ema_smoothing_factor(self):
        prices = [10.0, 20.0, 30.0, 40.0, 50.0]
        result = calculate_ema(prices, 2)
        # alpha = 2/3
        # seed = SMA(first 2) = 15
        assert result[0] is None
        assert result[1] == pytest.approx(15.0, abs=0.01)
        # EMA[2] = 30 * 2/3 + 15 * 1/3 = 25
        assert result[2] == pytest.approx(25.0, abs=0.01)

    def test_ema_constant_prices(self):
        prices = [50.0] * 10
        result = calculate_ema(prices, 5)
        for v in result[4:]:
            assert v == pytest.approx(50.0, abs=0.01)


# ═══════════════════════════════════════════════════════════════════════
# KAMA Tests
# ═══════════════════════════════════════════════════════════════════════

class TestKAMA:
    def test_kama_trending_market(self):
        """In a strong trend, KAMA should track prices closely."""
        prices = [float(i) for i in range(1, 31)]  # Strong uptrend
        result = calculate_kama(prices, er_period=10, fast_period=2, slow_period=30)
        # After initial period, KAMA should increase
        valid = [v for v in result if v is not None]
        assert len(valid) > 0
        for i in range(1, len(valid)):
            assert valid[i] >= valid[i - 1]  # Should follow uptrend

    def test_kama_sideways_market(self):
        """In a sideways market, KAMA should be relatively stable."""
        # Create choppy data
        prices = [100.0 + (i % 3) * 0.5 for i in range(30)]
        result = calculate_kama(prices, er_period=10, fast_period=2, slow_period=30)
        valid = [v for v in result if v is not None]
        assert len(valid) > 0
        # KAMA should not deviate far from 100
        for v in valid:
            assert abs(v - 100.5) < 3.0

    def test_kama_period_exceeds_length(self):
        prices = [10.0, 20.0, 30.0]
        result = calculate_kama(prices, er_period=10)
        assert all(v is None for v in result)

    def test_kama_first_value_is_price(self):
        prices = [float(i) for i in range(20, 40)]
        result = calculate_kama(prices, er_period=10)
        # First non-None value should be the price at index er_period-1
        assert result[9] == pytest.approx(29.0, abs=0.01)

    def test_kama_constant_prices(self):
        prices = [100.0] * 30
        result = calculate_kama(prices, er_period=10)
        valid = [v for v in result if v is not None]
        for v in valid:
            assert v == pytest.approx(100.0, abs=0.01)


# ═══════════════════════════════════════════════════════════════════════
# Crossover Detection Tests
# ═══════════════════════════════════════════════════════════════════════

class TestCrossover:
    def test_golden_cross(self):
        """Fast crosses above slow = BUY."""
        # Create data where EMA(5) will cross above SMA(10)
        prices = [50.0] * 15 + [55.0, 60.0, 65.0, 70.0, 75.0]
        dates = [f"2024-01-{i+1:02d}" for i in range(len(prices))]
        signals, fast_vals, slow_vals = detect_crossovers(
            prices, dates, fast_type="EMA", slow_type="SMA",
            fast_period=5, slow_period=10
        )
        buy_signals = [s for s in signals if s.signal_type.value == "BUY"]
        assert len(buy_signals) >= 1

    def test_death_cross(self):
        """Fast crosses below slow = SELL."""
        prices = [50.0] * 15 + [45.0, 40.0, 35.0, 30.0, 25.0]
        dates = [f"2024-01-{i+1:02d}" for i in range(len(prices))]
        signals, _, _ = detect_crossovers(
            prices, dates, fast_type="EMA", slow_type="SMA",
            fast_period=5, slow_period=10
        )
        sell_signals = [s for s in signals if s.signal_type.value == "SELL"]
        assert len(sell_signals) >= 1

    def test_no_crossover_constant(self):
        """Constant prices = no crossovers."""
        prices = [100.0] * 50
        dates = [f"2024-01-{i+1:02d}" for i in range(50)]
        signals, _, _ = detect_crossovers(
            prices, dates, fast_type="SMA", slow_type="SMA",
            fast_period=5, slow_period=20
        )
        assert len(signals) == 0

    def test_insufficient_data(self):
        """Not enough data for indicators = no signals."""
        prices = [100.0, 101.0, 102.0]
        dates = ["2024-01-01", "2024-01-02", "2024-01-03"]
        signals, _, _ = detect_crossovers(
            prices, dates, fast_type="SMA", slow_type="SMA",
            fast_period=5, slow_period=20
        )
        assert len(signals) == 0

    def test_signals_have_explanations(self):
        prices = [50.0] * 15 + [55.0, 60.0, 65.0, 70.0, 75.0]
        dates = [f"2024-01-{i+1:02d}" for i in range(len(prices))]
        signals, _, _ = detect_crossovers(
            prices, dates, fast_type="EMA", slow_type="SMA",
            fast_period=5, slow_period=10
        )
        for s in signals:
            assert len(s.explanation) > 0
            assert "not a guaranteed" in s.explanation.lower()

    def test_mismatched_lengths(self):
        with pytest.raises(ValueError):
            detect_crossovers([1.0, 2.0], ["2024-01-01"], "SMA", "SMA", 2, 3)


# ═══════════════════════════════════════════════════════════════════════
# CSV Processing Tests
# ═══════════════════════════════════════════════════════════════════════

class TestCSV:
    def _make_csv(self, content: str) -> bytes:
        return content.encode("utf-8")

    def test_valid_csv(self):
        csv_data = self._make_csv(
            "Date,Open,High,Low,Close,Volume\n"
            "2024-01-01,100,105,95,102,1000\n"
            "2024-01-02,102,108,101,107,1200\n"
        )
        df, meta = process_csv(csv_data, "test.csv")
        assert len(df) == 2
        assert "Close" in df.columns
        assert "Date" in df.columns

    def test_csv_missing_close(self):
        csv_data = self._make_csv("Date,Open,High,Low,Volume\n2024-01-01,100,105,95,1000\n")
        with pytest.raises(ValueError, match="missing required columns"):
            process_csv(csv_data, "test.csv")

    def test_csv_missing_date(self):
        csv_data = self._make_csv("Close,Volume\n100,1000\n")
        with pytest.raises(ValueError, match="missing required columns"):
            process_csv(csv_data, "test.csv")

    def test_csv_empty(self):
        csv_data = self._make_csv("")
        with pytest.raises(ValueError):
            process_csv(csv_data, "test.csv")

    def test_csv_negative_prices(self):
        csv_data = self._make_csv("Date,Close\n2024-01-01,-100\n")
        with pytest.raises(ValueError, match="negative"):
            process_csv(csv_data, "test.csv")

    def test_csv_duplicate_dates(self):
        csv_data = self._make_csv(
            "Date,Close\n2024-01-01,100\n2024-01-01,105\n2024-01-02,110\n"
        )
        df, _ = process_csv(csv_data, "test.csv")
        assert len(df) == 2  # Duplicate removed

    def test_csv_case_insensitive_columns(self):
        csv_data = self._make_csv("date,close\n2024-01-01,100\n2024-01-02,105\n")
        df, _ = process_csv(csv_data, "test.csv")
        assert "Close" in df.columns

    def test_csv_all_invalid_close(self):
        csv_data = self._make_csv("Date,Close\n2024-01-01,abc\n2024-01-02,xyz\n")
        with pytest.raises(ValueError, match="invalid"):
            process_csv(csv_data, "test.csv")


# ═══════════════════════════════════════════════════════════════════════
# Backtesting Tests
# ═══════════════════════════════════════════════════════════════════════

class TestBacktesting:
    def test_basic_backtest(self):
        # Trending up then down to generate signals
        prices = [50.0] * 30 + [float(50 + i) for i in range(1, 21)] + [float(70 - i) for i in range(1, 21)]
        dates = [f"2024-{(i//28)+1:02d}-{(i%28)+1:02d}" for i in range(len(prices))]
        result = run_backtest(
            prices, dates,
            initial_capital=100000,
            fast_type="EMA", slow_type="SMA",
            fast_period=5, slow_period=15,
            fee_pct=0.1,
        )
        assert result.metrics.initial_capital == 100000
        assert len(result.equity_curve) == len(prices)
        assert len(result.drawdown_curve) == len(prices)
        assert len(result.buy_hold_curve) == len(prices)

    def test_no_signals_capital_unchanged(self):
        """Constant prices = no signals = capital stays the same."""
        prices = [100.0] * 50
        dates = [f"2024-01-{i+1:02d}" for i in range(50)]
        result = run_backtest(
            prices, dates,
            initial_capital=10000,
            fast_type="SMA", slow_type="SMA",
            fast_period=5, slow_period=20,
            fee_pct=0.0,
        )
        assert result.metrics.final_value == pytest.approx(10000, abs=0.01)
        assert result.metrics.num_trades == 0

    def test_transaction_costs_reduce_returns(self):
        prices = [50.0] * 20 + [float(50 + i) for i in range(1, 31)]
        dates = [f"2024-01-{i+1:02d}" for i in range(len(prices))]
        result_no_fee = run_backtest(
            prices, dates, initial_capital=10000,
            fast_type="EMA", slow_type="SMA",
            fast_period=5, slow_period=15, fee_pct=0.0,
        )
        result_with_fee = run_backtest(
            prices, dates, initial_capital=10000,
            fast_type="EMA", slow_type="SMA",
            fast_period=5, slow_period=15, fee_pct=1.0,
        )
        # With fees, final value should be <= without fees
        assert result_with_fee.metrics.final_value <= result_no_fee.metrics.final_value

    def test_backtest_insufficient_data(self):
        with pytest.raises(ValueError):
            run_backtest([100.0], ["2024-01-01"], initial_capital=10000)

    def test_buy_hold_computed(self):
        prices = [100.0 + i for i in range(50)]
        dates = [f"2024-{(i//28)+1:02d}-{(i%28)+1:02d}" for i in range(50)]
        result = run_backtest(prices, dates, initial_capital=100000)
        assert result.metrics.buy_hold_return_pct != 0

    def test_drawdown_non_negative(self):
        prices = [50.0] * 20 + [float(50 + i) for i in range(1, 31)]
        dates = [f"2024-01-{i+1:02d}" for i in range(len(prices))]
        result = run_backtest(prices, dates, initial_capital=10000)
        for d in result.drawdown_curve:
            assert d >= 0


# ═══════════════════════════════════════════════════════════════════════
# API Endpoint Tests
# ═══════════════════════════════════════════════════════════════════════

class TestAPI:
    def test_health(self):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"

    def test_root(self):
        resp = client.get("/")
        assert resp.status_code == 200

    def test_upload_invalid_extension(self):
        resp = client.post(
            "/api/data/upload",
            files={"file": ("test.txt", b"some data", "text/plain")},
        )
        assert resp.status_code == 400

    def test_upload_empty_file(self):
        resp = client.post(
            "/api/data/upload",
            files={"file": ("test.csv", b"", "text/csv")},
        )
        assert resp.status_code == 400

    def test_upload_valid_csv(self):
        csv_content = b"Date,Close\n2024-01-01,100\n2024-01-02,105\n2024-01-03,110\n"
        resp = client.post(
            "/api/data/upload",
            files={"file": ("test.csv", csv_content, "text/csv")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["data"]) == 3

    def test_calculate_indicators(self):
        resp = client.post("/api/indicators/calculate", json={
            "close_prices": [10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0, 100.0],
            "indicators": [
                {"type": "SMA", "period": 3},
                {"type": "EMA", "period": 3},
            ],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["results"]) == 2

    def test_detect_signals(self):
        prices = [50.0] * 30 + [float(50 + i) for i in range(1, 21)]
        dates = [f"2024-{(i//28)+1:02d}-{(i%28)+1:02d}" for i in range(len(prices))]
        resp = client.post("/api/signals/detect", json={
            "close_prices": prices,
            "dates": dates,
            "fast_type": "EMA",
            "slow_type": "SMA",
            "fast_period": 5,
            "slow_period": 15,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "signals" in data
        assert "fast_values" in data
        assert "slow_values" in data

    def test_run_backtest_api(self):
        prices = [50.0] * 30 + [float(50 + i) for i in range(1, 21)]
        dates = [f"2024-{(i//28)+1:02d}-{(i%28)+1:02d}" for i in range(len(prices))]
        resp = client.post("/api/backtest/run", json={
            "close_prices": prices,
            "dates": dates,
            "initial_capital": 100000,
            "fast_type": "EMA",
            "slow_type": "SMA",
            "fast_period": 5,
            "slow_period": 15,
            "fee_pct": 0.1,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "metrics" in data
        assert "trades" in data

    def test_slow_period_must_exceed_fast(self):
        resp = client.post("/api/signals/detect", json={
            "close_prices": [100.0] * 10,
            "dates": [f"2024-01-{i+1:02d}" for i in range(10)],
            "fast_period": 10,
            "slow_period": 5,
        })
        assert resp.status_code == 422  # Validation error

    def test_report_csv_export(self):
        resp = client.post("/api/reports/export", json={
            "symbol": "TEST",
            "dates": ["2024-01-01", "2024-01-02"],
            "close_prices": [100.0, 105.0],
            "format": "csv",
            "report_type": "data",
        })
        assert resp.status_code == 200
        assert "csv" in resp.headers.get("content-type", "")

    def test_report_pdf_export(self):
        resp = client.post("/api/reports/export", json={
            "symbol": "TEST",
            "dates": ["2024-01-01", "2024-01-02"],
            "close_prices": [100.0, 105.0],
            "indicators": [],
            "signals": [],
            "trades": [],
            "format": "pdf",
            "report_type": "full",
        })
        assert resp.status_code == 200
        assert "pdf" in resp.headers.get("content-type", "")

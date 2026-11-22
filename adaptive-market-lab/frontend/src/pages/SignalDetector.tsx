import { useStore } from '@/store';
import Chart from '@/components/Chart';
import type { Data } from 'plotly.js';
import type { IndicatorType } from '@/types';
import {
  Zap,
  AlertCircle,
  Loader2,
  Play,
  Info,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

export default function SignalDetector() {
  const {
    marketData, signals, signalFastValues, signalSlowValues,
    signalConfig, isLoading, error,
    computeSignals, setSignalConfig, clearError,
  } = useStore();

  if (!marketData) {
    return (
      <div>
        <div className="page-header">
          <h2>Signal Detector</h2>
          <p>Load market data first from the Market Explorer</p>
        </div>
        <div className="alert alert-info">
          <Info size={18} />
          <span>Please load a dataset from the Market Explorer page before detecting signals.</span>
        </div>
      </div>
    );
  }

  const dates = marketData.data.map((r) => r.date);
  const closePrices = marketData.data.map((r) => r.close);

  const buySignals = signals.filter((s) => s.signal_type === 'BUY');
  const sellSignals = signals.filter((s) => s.signal_type === 'SELL');

  const chartData: Data[] = [
    {
      type: 'scatter',
      mode: 'lines',
      x: dates,
      y: closePrices,
      name: 'Close Price',
      line: { color: '#64748b', width: 1.5 },
    },
  ];

  if (signalFastValues.length > 0) {
    chartData.push({
      type: 'scatter',
      mode: 'lines',
      x: dates,
      y: signalFastValues.map((v) => v ?? null),
      name: `${signalConfig.fast_type}(${signalConfig.fast_period})`,
      line: { color: '#06b6d4', width: 2 },
      connectgaps: false,
    });
  }
  if (signalSlowValues.length > 0) {
    chartData.push({
      type: 'scatter',
      mode: 'lines',
      x: dates,
      y: signalSlowValues.map((v) => v ?? null),
      name: `${signalConfig.slow_type}(${signalConfig.slow_period})`,
      line: { color: '#f59e0b', width: 2 },
      connectgaps: false,
    });
  }

  if (buySignals.length > 0) {
    chartData.push({
      type: 'scatter',
      mode: 'markers',
      x: buySignals.map((s) => s.date),
      y: buySignals.map((s) => s.price),
      name: 'BUY Signal',
      marker: { color: '#22c55e', size: 12, symbol: 'triangle-up', line: { width: 1, color: '#16a34a' } },
    });
  }
  if (sellSignals.length > 0) {
    chartData.push({
      type: 'scatter',
      mode: 'markers',
      x: sellSignals.map((s) => s.date),
      y: sellSignals.map((s) => s.price),
      name: 'SELL Signal',
      marker: { color: '#ef4444', size: 12, symbol: 'triangle-down', line: { width: 1, color: '#dc2626' } },
    });
  }

  return (
    <div>
      <div className="page-header">
        <h2>Signal Detector</h2>
        <p>Detect buy/sell crossover signals using moving average pairs</p>
      </div>

      {error && (
        <div className="alert alert-error mb-4">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={clearError} style={{ marginLeft: 'auto' }}>×</button>
        </div>
      )}

      {/* Configuration */}
      <div className="card mb-6">
        <div className="card-header">
          <div className="card-title"><Zap size={18} /> Signal Configuration</div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Fast Indicator</label>
            <select
              className="form-input"
              value={signalConfig.fast_type}
              onChange={(e) => setSignalConfig({ fast_type: e.target.value as IndicatorType })}
            >
              <option value="SMA">SMA</option>
              <option value="EMA">EMA</option>
              <option value="KAMA">KAMA</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Fast Period</label>
            <input
              className="form-input"
              type="number"
              min={2}
              max={500}
              value={signalConfig.fast_period}
              onChange={(e) => setSignalConfig({ fast_period: parseInt(e.target.value) || 12 })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Slow Indicator</label>
            <select
              className="form-input"
              value={signalConfig.slow_type}
              onChange={(e) => setSignalConfig({ slow_type: e.target.value as IndicatorType })}
            >
              <option value="SMA">SMA</option>
              <option value="EMA">EMA</option>
              <option value="KAMA">KAMA</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Slow Period</label>
            <input
              className="form-input"
              type="number"
              min={2}
              max={500}
              value={signalConfig.slow_period}
              onChange={(e) => setSignalConfig({ slow_period: parseInt(e.target.value) || 26 })}
            />
          </div>
        </div>
        <button
          className="btn btn-primary mt-4"
          onClick={computeSignals}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 size={16} className="spinner" /> : <Play size={16} />}
          Detect Signals
        </button>
      </div>

      {/* Signal summary */}
      {signals.length > 0 && (
        <div className="stat-grid mb-6">
          <div className="stat-card">
            <div className="stat-label">Total Signals</div>
            <div className="stat-value">{signals.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Buy Signals</div>
            <div className="stat-value positive">{buySignals.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Sell Signals</div>
            <div className="stat-value negative">{sellSignals.length}</div>
          </div>
        </div>
      )}

      {/* Chart */}
      <Chart
        data={chartData}
        title={`${marketData.symbol} — Crossover Signals`}
        height={500}
        layout={{
          yaxis: { title: { text: 'Price', font: { size: 12 } } },
        }}
      />

      {/* Signal table */}
      {signals.length > 0 && (
        <div className="card mt-6">
          <div className="card-header">
            <div className="card-title">Detected Signals</div>
            <span className="badge badge-info">{signals.length} signals</span>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Price</th>
                  <th>Fast MA</th>
                  <th>Slow MA</th>
                  <th>Explanation</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((sig, i) => (
                  <tr key={i}>
                    <td>{sig.date}</td>
                    <td>
                      <span className={`badge ${sig.signal_type === 'BUY' ? 'badge-buy' : 'badge-sell'}`}>
                        {sig.signal_type === 'BUY' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {sig.signal_type}
                      </span>
                    </td>
                    <td>{sig.price.toFixed(2)}</td>
                    <td>{sig.fast_value.toFixed(2)}</td>
                    <td>{sig.slow_value.toFixed(2)}</td>
                    <td className="text-xs text-muted" style={{ maxWidth: 300, whiteSpace: 'normal', fontFamily: 'var(--font-sans)' }}>
                      {sig.explanation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

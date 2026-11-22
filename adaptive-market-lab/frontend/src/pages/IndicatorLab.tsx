import { useCallback } from 'react';
import { useStore } from '@/store';
import Chart from '@/components/Chart';
import type { Data } from 'plotly.js';
import type { IndicatorType } from '@/types';
import {
  LineChart,
  AlertCircle,
  Loader2,
  Play,
  Info,
} from 'lucide-react';

const INDICATOR_COLORS: Record<string, string> = {
  SMA: '#f59e0b',
  EMA: '#06b6d4',
  KAMA: '#8b5cf6',
};

export default function IndicatorLab() {
  const {
    marketData, indicators, indicatorConfigs, isLoading, error,
    computeIndicators, setIndicatorConfigs, clearError,
  } = useStore();

  const handleToggle = useCallback(
    (idx: number) => {
      const next = [...indicatorConfigs];
      next[idx] = { ...next[idx], enabled: !next[idx].enabled };
      setIndicatorConfigs(next);
    },
    [indicatorConfigs, setIndicatorConfigs],
  );

  const handleChange = useCallback(
    (idx: number, field: string, value: number | IndicatorType) => {
      const next = [...indicatorConfigs];
      next[idx] = { ...next[idx], [field]: value };
      setIndicatorConfigs(next);
    },
    [indicatorConfigs, setIndicatorConfigs],
  );

  const addIndicator = useCallback(() => {
    setIndicatorConfigs([
      ...indicatorConfigs,
      { type: 'SMA', period: 50, fast_period: 2, slow_period: 30, enabled: true },
    ]);
  }, [indicatorConfigs, setIndicatorConfigs]);

  const removeIndicator = useCallback(
    (idx: number) => {
      setIndicatorConfigs(indicatorConfigs.filter((_, i) => i !== idx));
    },
    [indicatorConfigs, setIndicatorConfigs],
  );

  // Build chart data
  const dates = marketData?.data.map((r) => r.date) ?? [];
  const closePrices = marketData?.data.map((r) => r.close) ?? [];

  const chartData: Data[] = [
    {
      type: 'scatter',
      mode: 'lines',
      x: dates,
      y: closePrices,
      name: 'Close Price',
      line: { color: '#64748b', width: 1.5 },
    },
    ...indicators.map((ind) => ({
      type: 'scatter' as const,
      mode: 'lines' as const,
      x: dates,
      y: ind.values.map((v) => v ?? null),
      name: `${ind.type}(${ind.period})`,
      line: {
        color: INDICATOR_COLORS[ind.type] ?? '#94a3b8',
        width: 2,
        dash: ind.type === 'KAMA' ? ('dot' as const) : undefined,
      },
      connectgaps: false,
    })),
  ];

  if (!marketData) {
    return (
      <div>
        <div className="page-header">
          <h2>Indicator Lab</h2>
          <p>Load market data first from the Market Explorer</p>
        </div>
        <div className="alert alert-info">
          <Info size={18} />
          <span>Please load a dataset from the Market Explorer page before calculating indicators.</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2>Indicator Lab</h2>
        <p>Calculate and compare SMA, EMA, and KAMA moving averages</p>
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
          <div className="card-title"><LineChart size={18} /> Indicator Configuration</div>
          <button className="btn btn-secondary btn-sm" onClick={addIndicator}>+ Add</button>
        </div>

        {indicatorConfigs.map((cfg, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 mb-4"
            style={{
              padding: '12px 16px',
              background: cfg.enabled ? 'var(--bg-secondary)' : 'transparent',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${cfg.enabled ? 'var(--border-default)' : 'var(--border-subtle)'}`,
              opacity: cfg.enabled ? 1 : 0.5,
              flexWrap: 'wrap',
            }}
          >
            <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={cfg.enabled}
                onChange={() => handleToggle(idx)}
                style={{ accentColor: INDICATOR_COLORS[cfg.type] }}
              />
              <span
                style={{
                  width: 12, height: 12, borderRadius: 3,
                  background: INDICATOR_COLORS[cfg.type],
                }}
              />
            </label>

            <select
              className="form-input"
              value={cfg.type}
              onChange={(e) => handleChange(idx, 'type', e.target.value as IndicatorType)}
              style={{ width: 100 }}
            >
              <option value="SMA">SMA</option>
              <option value="EMA">EMA</option>
              <option value="KAMA">KAMA</option>
            </select>

            <div className="flex items-center gap-2">
              <label className="text-xs text-muted">Period:</label>
              <input
                className="form-input"
                type="number"
                min={2}
                max={500}
                value={cfg.period}
                onChange={(e) => handleChange(idx, 'period', parseInt(e.target.value) || 2)}
                style={{ width: 70 }}
              />
            </div>

            {cfg.type === 'KAMA' && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted">Fast:</label>
                  <input
                    className="form-input"
                    type="number"
                    min={2}
                    max={50}
                    value={cfg.fast_period}
                    onChange={(e) => handleChange(idx, 'fast_period', parseInt(e.target.value) || 2)}
                    style={{ width: 60 }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted">Slow:</label>
                  <input
                    className="form-input"
                    type="number"
                    min={10}
                    max={500}
                    value={cfg.slow_period}
                    onChange={(e) => handleChange(idx, 'slow_period', parseInt(e.target.value) || 30)}
                    style={{ width: 60 }}
                  />
                </div>
              </>
            )}

            {indicatorConfigs.length > 1 && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => removeIndicator(idx)}
                style={{ marginLeft: 'auto', color: 'var(--danger-400)' }}
              >
                ×
              </button>
            )}
          </div>
        ))}

        <button
          className="btn btn-primary mt-4"
          onClick={computeIndicators}
          disabled={isLoading || indicatorConfigs.every((c) => !c.enabled)}
        >
          {isLoading ? <Loader2 size={16} className="spinner" /> : <Play size={16} />}
          Calculate Indicators
        </button>
      </div>

      {/* Chart */}
      <Chart
        data={chartData}
        title={`${marketData.symbol} — Moving Averages`}
        height={500}
        layout={{
          yaxis: { title: { text: 'Price', font: { size: 12 } } },
        }}
      />

      {/* Algorithm explanation */}
      <div className="card mt-6">
        <div className="card-title mb-4"><Info size={18} /> Algorithm Reference</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', borderLeft: `3px solid ${INDICATOR_COLORS.SMA}` }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: INDICATOR_COLORS.SMA, marginBottom: 6 }}>Simple Moving Average (SMA)</h4>
            <p className="text-sm text-secondary">Equal-weighted average of the last N closing prices. Smooth and easy to interpret, but reacts slowly to price changes.</p>
            <code className="text-xs font-mono" style={{ display: 'block', marginTop: 8, color: 'var(--text-muted)' }}>SMA = (1/N) × Σ(Price_i)</code>
          </div>
          <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', borderLeft: `3px solid ${INDICATOR_COLORS.EMA}` }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: INDICATOR_COLORS.EMA, marginBottom: 6 }}>Exponential Moving Average (EMA)</h4>
            <p className="text-sm text-secondary">Exponentially weighted — recent prices have more influence. Reacts faster than SMA to price changes.</p>
            <code className="text-xs font-mono" style={{ display: 'block', marginTop: 8, color: 'var(--text-muted)' }}>EMA_t = α × Price_t + (1-α) × EMA_{'{t-1}'}</code>
          </div>
          <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', borderLeft: `3px solid ${INDICATOR_COLORS.KAMA}` }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: INDICATOR_COLORS.KAMA, marginBottom: 6 }}>Kaufman Adaptive MA (KAMA)</h4>
            <p className="text-sm text-secondary">Adapts its smoothing to market conditions via an Efficiency Ratio. Fast in trends, slow in noise.</p>
            <code className="text-xs font-mono" style={{ display: 'block', marginTop: 8, color: 'var(--text-muted)' }}>KAMA_t = KAMA_{'{t-1}'} + SC × (Price_t - KAMA_{'{t-1}'})</code>
          </div>
        </div>
      </div>
    </div>
  );
}

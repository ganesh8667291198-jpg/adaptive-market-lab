import { useStore } from '@/store';
import Chart from '@/components/Chart';
import type { Data } from 'plotly.js';
import type { IndicatorType } from '@/types';
import {
  FlaskConical,
  AlertCircle,
  Loader2,
  Play,
  Info,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Target,
  ShieldAlert,
} from 'lucide-react';

export default function Backtesting() {
  const {
    marketData, backtestResult, backtestConfig,
    isLoading, error,
    runBacktest, setBacktestConfig, clearError,
  } = useStore();

  if (!marketData) {
    return (
      <div>
        <div className="page-header">
          <h2>Backtesting</h2>
          <p>Load market data first from the Market Explorer</p>
        </div>
        <div className="alert alert-info">
          <Info size={18} />
          <span>Please load a dataset from the Market Explorer page before running a backtest.</span>
        </div>
      </div>
    );
  }

  const dates = marketData.data.map((r) => r.date);
  const m = backtestResult?.metrics;

  // Equity curve chart
  const equityData: Data[] = backtestResult
    ? [
        {
          type: 'scatter',
          mode: 'lines',
          x: dates,
          y: backtestResult.equity_curve,
          name: 'Strategy',
          line: { color: '#6366f1', width: 2 },
          fill: 'tozeroy',
          fillcolor: 'rgba(99,102,241,0.05)',
        },
        {
          type: 'scatter',
          mode: 'lines',
          x: dates,
          y: backtestResult.buy_hold_curve,
          name: 'Buy & Hold',
          line: { color: '#64748b', width: 2, dash: 'dash' },
        },
      ]
    : [];

  // Drawdown chart
  const drawdownData: Data[] = backtestResult
    ? [
        {
          type: 'scatter',
          mode: 'lines',
          x: dates,
          y: backtestResult.drawdown_curve.map((v) => -v),
          name: 'Drawdown %',
          line: { color: '#ef4444', width: 1.5 },
          fill: 'tozeroy',
          fillcolor: 'rgba(239,68,68,0.1)',
        },
      ]
    : [];

  return (
    <div>
      <div className="page-header">
        <h2>Backtesting</h2>
        <p>Simulate a crossover trading strategy on historical data</p>
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
          <div className="card-title"><FlaskConical size={18} /> Backtest Configuration</div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Initial Capital ($)</label>
            <input
              className="form-input"
              type="number"
              min={100}
              value={backtestConfig.initial_capital}
              onChange={(e) => setBacktestConfig({ initial_capital: parseFloat(e.target.value) || 100000 })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Fast Indicator</label>
            <select
              className="form-input"
              value={backtestConfig.fast_type}
              onChange={(e) => setBacktestConfig({ fast_type: e.target.value as IndicatorType })}
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
              value={backtestConfig.fast_period}
              onChange={(e) => setBacktestConfig({ fast_period: parseInt(e.target.value) || 12 })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Slow Indicator</label>
            <select
              className="form-input"
              value={backtestConfig.slow_type}
              onChange={(e) => setBacktestConfig({ slow_type: e.target.value as IndicatorType })}
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
              value={backtestConfig.slow_period}
              onChange={(e) => setBacktestConfig({ slow_period: parseInt(e.target.value) || 26 })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Fee (%)</label>
            <input
              className="form-input"
              type="number"
              min={0}
              max={5}
              step={0.01}
              value={backtestConfig.fee_pct}
              onChange={(e) => setBacktestConfig({ fee_pct: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>
        <button
          className="btn btn-primary mt-4"
          onClick={runBacktest}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 size={16} className="spinner" /> : <Play size={16} />}
          Run Backtest
        </button>
      </div>

      {/* Results */}
      {m && (
        <div className="animate-fade-in">
          {/* Metrics grid */}
          <div className="stat-grid mb-6">
            <div className="stat-card">
              <div className="stat-label"><DollarSign size={12} style={{ display: 'inline' }} /> Final Value</div>
              <div className="stat-value">${m.final_value.toLocaleString()}</div>
              <div className={`stat-change ${m.total_return >= 0 ? 'positive' : 'negative'}`}>
                {m.total_return >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {m.total_return >= 0 ? '+' : ''}${m.total_return.toLocaleString()} ({m.total_return_pct.toFixed(2)}%)
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label"><Target size={12} style={{ display: 'inline' }} /> Win Rate</div>
              <div className={`stat-value ${m.win_rate !== null && m.win_rate >= 50 ? 'positive' : 'negative'}`}>
                {m.win_rate !== null ? m.win_rate.toFixed(1) + '%' : 'N/A'}
              </div>
              <div className="text-xs text-muted mt-2">{m.winning_trades}W / {m.losing_trades}L of {m.num_trades} trades</div>
            </div>
            <div className="stat-card">
              <div className="stat-label"><ShieldAlert size={12} style={{ display: 'inline' }} /> Max Drawdown</div>
              <div className="stat-value negative">{m.max_drawdown_pct.toFixed(2)}%</div>
              <div className="text-xs text-muted mt-2">${m.max_drawdown.toLocaleString()}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label"><BarChart3 size={12} style={{ display: 'inline' }} /> Sharpe Ratio</div>
              <div className={`stat-value ${m.sharpe_ratio !== null && m.sharpe_ratio > 0 ? 'positive' : 'negative'}`}>
                {m.sharpe_ratio !== null ? m.sharpe_ratio.toFixed(4) : 'N/A'}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Buy & Hold</div>
              <div className={`stat-value ${m.buy_hold_return >= 0 ? 'positive' : 'negative'}`}>
                {m.buy_hold_return_pct >= 0 ? '+' : ''}{m.buy_hold_return_pct.toFixed(2)}%
              </div>
              <div className="text-xs text-muted mt-2">${m.buy_hold_return.toLocaleString()}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Strategy vs B&H</div>
              <div className={`stat-value ${m.total_return_pct - m.buy_hold_return_pct >= 0 ? 'positive' : 'negative'}`}>
                {(m.total_return_pct - m.buy_hold_return_pct) >= 0 ? '+' : ''}
                {(m.total_return_pct - m.buy_hold_return_pct).toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Equity curve */}
          <Chart
            data={equityData}
            title="Equity Curve — Strategy vs Buy & Hold"
            height={400}
            layout={{
              yaxis: { title: { text: 'Portfolio Value ($)', font: { size: 12 } } },
            }}
          />

          {/* Drawdown */}
          <div className="mt-4">
            <Chart
              data={drawdownData}
              title="Drawdown"
              height={200}
              layout={{
                yaxis: { title: { text: 'Drawdown %', font: { size: 12 } } },
              }}
            />
          </div>

          {/* Trade log */}
          {backtestResult.trades.length > 0 && (
            <div className="card mt-6">
              <div className="card-header">
                <div className="card-title">Trade History</div>
                <span className="badge badge-info">{backtestResult.trades.length} trades</span>
              </div>
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Entry Date</th>
                      <th>Entry Price</th>
                      <th>Exit Date</th>
                      <th>Exit Price</th>
                      <th>Shares</th>
                      <th>P&L</th>
                      <th>P&L %</th>
                      <th>Fees</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backtestResult.trades.map((t, i) => (
                      <tr key={i}>
                        <td>{t.entry_date}</td>
                        <td>${t.entry_price.toFixed(2)}</td>
                        <td>{t.exit_date ?? <span className="badge badge-warning">Open</span>}</td>
                        <td>{t.exit_price ? `$${t.exit_price.toFixed(2)}` : '—'}</td>
                        <td>{t.shares}</td>
                        <td style={{ color: t.pnl !== null && t.pnl >= 0 ? 'var(--success-400)' : 'var(--danger-400)', fontWeight: 600 }}>
                          {t.pnl !== null ? `${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)}` : '—'}
                        </td>
                        <td style={{ color: t.pnl_pct !== null && t.pnl_pct >= 0 ? 'var(--success-400)' : 'var(--danger-400)' }}>
                          {t.pnl_pct !== null ? `${t.pnl_pct >= 0 ? '+' : ''}${t.pnl_pct.toFixed(2)}%` : '—'}
                        </td>
                        <td>${t.fees_paid.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="alert alert-info mt-6">
            <Info size={18} />
            <div>
              <strong>Disclaimer:</strong> This backtest uses simplified assumptions (no slippage, flat fee,
              next-candle execution). Historical performance does not guarantee future results.
              This is for academic and educational purposes only.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

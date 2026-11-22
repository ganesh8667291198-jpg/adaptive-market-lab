import { useState, useCallback } from 'react';
import { useStore } from '@/store';
import * as api from '@/api';
import type { ReportRequest } from '@/types';
import {
  FileDown,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle2,
  BarChart3,
  Zap,
  FlaskConical,
  Info,
} from 'lucide-react';

export default function Reports() {
  const { marketData, indicators, signals, backtestResult } = useStore();

  const [downloading, setDownloading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const triggerExport = useCallback(
    async (format: 'pdf' | 'csv', reportType: 'full' | 'data' | 'signals' | 'backtest') => {
      if (!marketData || marketData.data.length === 0) {
        setErrorMsg('Please load market data before generating a report.');
        return;
      }

      const key = `${format}-${reportType}`;
      setDownloading(key);
      setErrorMsg(null);
      setSuccessMsg(null);

      try {
        const payload: ReportRequest = {
          symbol: marketData.symbol,
          dates: marketData.data.map((r) => r.date),
          close_prices: marketData.data.map((r) => r.close),
          indicators: indicators.length > 0 ? indicators : undefined,
          signals: signals.length > 0 ? signals : undefined,
          backtest_metrics: backtestResult?.metrics || undefined,
          trades: backtestResult?.trades || undefined,
          format,
          report_type: reportType,
        };

        const blob = await api.exportReport(payload);
        const filename = `${marketData.symbol || 'market'}_${reportType}_report.${format}`;
        api.downloadBlob(blob, filename);

        setSuccessMsg(`Successfully generated ${filename}`);
        setTimeout(() => setSuccessMsg(null), 4000);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Report export failed';
        const axiosMsg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setErrorMsg(axiosMsg || msg);
      } finally {
        setDownloading(null);
      }
    },
    [marketData, indicators, signals, backtestResult]
  );

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1>Reports & Export</h1>
        <p>Export executive PDF analytical summaries and structured CSV datasets for research</p>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="alert alert-danger mb-6 animate-fade-in">
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setErrorMsg(null)}>
            Dismiss
          </button>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success mb-6 animate-fade-in">
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {!marketData ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <FileDown size={32} />
          </div>
          <h3>No Data Loaded</h3>
          <p>Go to the Market Explorer to fetch or upload financial data before exporting reports.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {/* Current Session Metadata Overview */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <BarChart3 className="text-primary-400" size={18} />
                <span className="card-title">Active Dataset Summary</span>
              </div>
              <span className="badge badge-primary">{marketData.symbol}</span>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="stat-card">
                <div className="stat-label">Total Observations</div>
                <div className="stat-value">{marketData.data.length.toLocaleString()} bars</div>
                <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                  {marketData.data[0]?.date} → {marketData.data[marketData.data.length - 1]?.date}
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">Active Indicators</div>
                <div className="stat-value text-accent-400">
                  {indicators.length} {indicators.length === 1 ? 'series' : 'series'}
                </div>
                <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                  {indicators.map((i) => `${i.type}(${i.period})`).join(', ') || 'None computed'}
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">Detected Signals</div>
                <div className="stat-value text-warning-400">
                  {signals.length} {signals.length === 1 ? 'event' : 'events'}
                </div>
                <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                  {signals.filter((s) => s.signal_type === 'BUY').length} Buy / {signals.filter((s) => s.signal_type === 'SELL').length} Sell
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">Backtest Status</div>
                <div className={`stat-value ${backtestResult ? 'text-success-400' : 'text-muted'}`}>
                  {backtestResult ? `${backtestResult.metrics.total_return_pct >= 0 ? '+' : ''}${backtestResult.metrics.total_return_pct.toFixed(1)}%` : 'Not Executed'}
                </div>
                <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                  {backtestResult ? `${backtestResult.metrics.num_trades} executed trades` : 'Run Backtest to include'}
                </div>
              </div>
            </div>
          </div>

          {/* Export Options Grid */}
          <div className="grid grid-cols-2 gap-6">
            {/* PDF Report Card */}
            <div className="card flex flex-col justify-between">
              <div>
                <div className="card-header">
                  <div className="flex items-center gap-2">
                    <FileText className="text-danger-400" size={20} />
                    <div>
                      <h3 className="text-base font-semibold">Executive PDF Dossier</h3>
                      <p className="text-xs text-muted">Formatted report designed for printing, reading, or presentations</p>
                    </div>
                  </div>
                  <span className="badge badge-outline">PDF</span>
                </div>

                <div className="text-sm text-secondary space-y-2 mb-6" style={{ marginTop: 12 }}>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-success-400" />
                    <span>Complete asset profile, time series bounds, and statistical parameters</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-success-400" />
                    <span>Calculated technical indicators table and algorithmic configuration</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-success-400" />
                    <span>Chronological crossover signals table with trigger reasoning</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-success-400" />
                    <span>Full portfolio performance dossier: Sharpe ratio, drawdown, and trade log</span>
                  </div>
                </div>
              </div>

              <button
                className="btn btn-primary w-full"
                disabled={downloading !== null}
                onClick={() => triggerExport('pdf', 'full')}
              >
                {downloading === 'pdf-full' ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <FileDown size={16} />
                    Download Executive PDF Report
                  </>
                )}
              </button>
            </div>

            {/* CSV Data Exports Card */}
            <div className="card flex flex-col justify-between">
              <div>
                <div className="card-header">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="text-success-400" size={20} />
                    <div>
                      <h3 className="text-base font-semibold">Raw Data & Analytical CSVs</h3>
                      <p className="text-xs text-muted">Clean structured tabular data for spreadsheet software or Python</p>
                    </div>
                  </div>
                  <span className="badge badge-outline">CSV</span>
                </div>

                <div className="space-y-3" style={{ marginTop: 14 }}>
                  {/* CSV Option 1: Market Data */}
                  <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-input)' }}>
                    <div>
                      <div className="text-sm font-medium">OHLCV Market Time Series</div>
                      <div className="text-xs text-muted">{marketData.data.length} records with Open, High, Low, Close, Volume</div>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={downloading !== null}
                      onClick={() => triggerExport('csv', 'data')}
                    >
                      {downloading === 'csv-data' ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                      Export
                    </button>
                  </div>

                  {/* CSV Option 2: Signals */}
                  <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-input)' }}>
                    <div>
                      <div className="text-sm font-medium">Crossover Signals Log</div>
                      <div className="text-xs text-muted">{signals.length} crossover records with buy/sell triggers</div>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={downloading !== null || signals.length === 0}
                      onClick={() => triggerExport('csv', 'signals')}
                    >
                      {downloading === 'csv-signals' ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                      Export
                    </button>
                  </div>

                  {/* CSV Option 3: Backtest & Trades */}
                  <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-input)' }}>
                    <div>
                      <div className="text-sm font-medium">Backtest Metrics & Trade Log</div>
                      <div className="text-xs text-muted">
                        {backtestResult ? `${backtestResult.trades.length} trade transactions with PnL and return metrics` : 'Requires backtest execution'}
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={downloading !== null || !backtestResult}
                      onClick={() => triggerExport('csv', 'backtest')}
                    >
                      {downloading === 'csv-backtest' ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />}
                      Export
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted mt-4">
                <Info size={14} />
                <span>CSVs are UTF-8 formatted with standardized RFC 4180 delimiters.</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

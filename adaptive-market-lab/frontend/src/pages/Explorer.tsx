import { useState, useRef, useCallback } from 'react';
import { useStore } from '@/store';
import Chart from '@/components/Chart';
import type { Data } from 'plotly.js';
import {
  Search,
  Upload,
  AlertCircle,
  Loader2,
  X,
  Calendar,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

const PERIODS = [
  { value: '1mo', label: '1M' },
  { value: '3mo', label: '3M' },
  { value: '6mo', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: '2y', label: '2Y' },
  { value: '5y', label: '5Y' },
];

export default function Explorer() {
  const {
    marketData, isLoading, error,
    loadSymbol, uploadFile, clearError, clearData,
  } = useStore();

  const [symbol, setSymbol] = useState('');
  const [period, setPeriod] = useState('1y');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(async () => {
    if (!symbol.trim()) return;
    await loadSymbol(symbol.trim(), period);
  }, [symbol, period, loadSymbol]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  }, [handleSearch]);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return;
    }
    await uploadFile(file);
  }, [uploadFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  // Chart data
  const chartData: Data[] = marketData ? [
    {
      type: 'candlestick',
      x: marketData.data.map((r) => r.date),
      open: marketData.data.map((r) => r.open),
      high: marketData.data.map((r) => r.high),
      low: marketData.data.map((r) => r.low),
      close: marketData.data.map((r) => r.close),
      increasing: { line: { color: '#22c55e' } },
      decreasing: { line: { color: '#ef4444' } },
      name: 'OHLC',
    },
  ] : [];

  const volumeData: Data[] = marketData ? [
    {
      type: 'bar',
      x: marketData.data.map((r) => r.date),
      y: marketData.data.map((r) => r.volume),
      marker: {
        color: marketData.data.map((r, i) =>
          i > 0 && r.close >= marketData.data[i - 1].close
            ? 'rgba(34,197,94,0.4)'
            : 'rgba(239,68,68,0.4)'
        ),
      },
      name: 'Volume',
    },
  ] : [];

  const summary = marketData?.summary;

  return (
    <div>
      <div className="page-header">
        <h2>Market Explorer</h2>
        <p>Search stock symbols or upload CSV datasets for analysis</p>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={clearError} style={{ marginLeft: 'auto' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Search bar */}
      <div className="card mb-6">
        <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: '1 1 200px' }}>
            <label className="form-label">Stock Symbol</label>
            <div className="flex gap-2">
              <input
                id="symbol-input"
                className="form-input"
                placeholder="e.g. AAPL, MSFT, GOOGL"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                style={{ flex: 1 }}
                disabled={isLoading}
              />
              <select
                className="form-input"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                style={{ width: 90 }}
              >
                {PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <button
                id="search-btn"
                className="btn btn-primary"
                onClick={handleSearch}
                disabled={isLoading || !symbol.trim()}
              >
                {isLoading ? <Loader2 size={16} className="spinner" /> : <Search size={16} />}
                Search
              </button>
            </div>
          </div>
        </div>

        {/* Quick symbols */}
        <div className="flex gap-2 mt-4" style={{ flexWrap: 'wrap' }}>
          <span className="text-xs text-muted" style={{ alignSelf: 'center' }}>Quick:</span>
          {['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META'].map((sym) => (
            <button
              key={sym}
              className="btn btn-ghost btn-sm"
              onClick={() => { setSymbol(sym); loadSymbol(sym, period); }}
              disabled={isLoading}
              style={{ fontSize: 12 }}
            >
              {sym}
            </button>
          ))}
        </div>
      </div>

      {/* CSV Upload */}
      {!marketData && (
        <div
          className={`upload-zone mb-6 ${dragOver ? 'drag-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <Upload />
          <h3>Upload CSV File</h3>
          <p>Drag and drop a CSV file here, or click to browse</p>
          <p className="text-xs text-muted mt-2">Required columns: Date, Close. Optional: Open, High, Low, Volume</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
            }}
          />
        </div>
      )}

      {/* Data loaded */}
      {marketData && (
        <div className="animate-fade-in">
          {/* Summary */}
          {summary && (
            <div className="stat-grid mb-6">
              <div className="stat-card">
                <div className="stat-label">Symbol</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{marketData.symbol}</div>
                {marketData.name && <div className="text-xs text-muted">{marketData.name}</div>}
              </div>
              <div className="stat-card">
                <div className="stat-label">Latest Close</div>
                <div className="stat-value">{summary.latest_close.toFixed(2)}</div>
                {summary.price_change_pct !== null && (
                  <div className={`stat-change ${summary.price_change_pct >= 0 ? 'positive' : 'negative'}`}>
                    {summary.price_change_pct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {summary.price_change_pct >= 0 ? '+' : ''}{summary.price_change_pct.toFixed(2)}%
                  </div>
                )}
              </div>
              <div className="stat-card">
                <div className="stat-label">Range</div>
                <div className="stat-value" style={{ fontSize: 16 }}>
                  {summary.lowest.toFixed(2)} — {summary.highest.toFixed(2)}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Data Points</div>
                <div className="stat-value">{marketData.data.length}</div>
                <div className="stat-change" style={{ color: 'var(--text-muted)' }}>
                  <Calendar size={12} /> {marketData.data[0]?.date} to {marketData.data[marketData.data.length - 1]?.date}
                </div>
              </div>
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Price Chart</h3>
            <button className="btn btn-ghost btn-sm" onClick={clearData}>
              <X size={14} /> Clear Data
            </button>
          </div>

          {/* Candlestick chart */}
          <Chart
            data={chartData}
            layout={{
              xaxis: { rangeslider: { visible: false }, title: { text: '' } },
              yaxis: { title: { text: 'Price', font: { size: 12 } } },
            }}
            height={450}
          />

          {/* Volume chart */}
          <div className="mt-4">
            <Chart
              data={volumeData}
              layout={{
                yaxis: { title: { text: 'Volume', font: { size: 12 } } },
              }}
              height={200}
            />
          </div>

          {/* Data table */}
          <div className="card mt-6">
            <div className="card-header">
              <div className="card-title">Historical Data</div>
              <span className="badge badge-info">{marketData.data.length} rows</span>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Open</th>
                    <th>High</th>
                    <th>Low</th>
                    <th>Close</th>
                    <th>Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {marketData.data.slice(-50).reverse().map((row) => (
                    <tr key={row.date}>
                      <td>{row.date}</td>
                      <td>{row.open?.toFixed(2) ?? '—'}</td>
                      <td>{row.high?.toFixed(2) ?? '—'}</td>
                      <td>{row.low?.toFixed(2) ?? '—'}</td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.close.toFixed(2)}</td>
                      <td>{row.volume ? (row.volume / 1e6).toFixed(1) + 'M' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

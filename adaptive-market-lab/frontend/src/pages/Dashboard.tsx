import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import {
  Search,
  Upload,
  LineChart,
  Zap,
  FlaskConical,
  FileDown,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  BarChart3,
  Activity,
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { marketData } = useStore();
  const summary = marketData?.summary;

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>
          {marketData
            ? `Analyzing ${marketData.symbol}${marketData.name ? ` — ${marketData.name}` : ''}`
            : 'Load a dataset to begin financial analysis'}
        </p>
      </div>

      {/* Summary stats */}
      {summary && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">Latest Close</div>
            <div className="stat-value">${summary.latest_close.toLocaleString()}</div>
            {summary.price_change_pct !== null && (
              <div className={`stat-change ${summary.price_change_pct >= 0 ? 'positive' : 'negative'}`}>
                {summary.price_change_pct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {summary.price_change_pct >= 0 ? '+' : ''}{summary.price_change_pct.toFixed(2)}%
              </div>
            )}
          </div>
          <div className="stat-card">
            <div className="stat-label">52-Week High</div>
            <div className="stat-value">${summary.highest.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">52-Week Low</div>
            <div className="stat-value">${summary.lowest.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Volume</div>
            <div className="stat-value">
              {summary.avg_volume ? (summary.avg_volume / 1e6).toFixed(1) + 'M' : 'N/A'}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Data Points</div>
            <div className="stat-value">{marketData?.data.length.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      {!marketData && (
        <div style={{ maxWidth: 700, margin: '32px auto' }}>
          <div className="card" style={{ textAlign: 'center', padding: '48px 32px' }}>
            <div style={{
              width: 72, height: 72, borderRadius: 'var(--radius-xl)',
              background: 'linear-gradient(135deg, var(--primary-600), var(--accent-500))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px', boxShadow: '0 0 40px rgba(99,102,241,0.3)',
            }}>
              <Activity size={32} color="white" />
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Welcome to Adaptive Market Lab</h3>
            <p className="text-secondary" style={{ marginBottom: 28, maxWidth: 500, margin: '0 auto 28px' }}>
              Analyze historical stock data with SMA, EMA, and KAMA algorithms.
              Detect crossover signals, run backtests, and generate reports.
            </p>
            <div className="flex items-center gap-3" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-lg" onClick={() => navigate('/explorer')}>
                <Search size={18} /> Search Symbol
              </button>
              <button className="btn btn-secondary btn-lg" onClick={() => navigate('/explorer')}>
                <Upload size={18} /> Upload CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workflow cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 24 }}>
        {[
          {
            icon: <Search size={20} />,
            title: 'Market Explorer',
            desc: 'Search stocks by symbol or upload CSV datasets',
            to: '/explorer',
            color: '#6366f1',
          },
          {
            icon: <LineChart size={20} />,
            title: 'Indicator Lab',
            desc: 'Calculate and compare SMA, EMA, and KAMA',
            to: '/indicators',
            color: '#06b6d4',
          },
          {
            icon: <Zap size={20} />,
            title: 'Signal Detector',
            desc: 'Detect buy/sell crossover signals automatically',
            to: '/signals',
            color: '#22c55e',
          },
          {
            icon: <FlaskConical size={20} />,
            title: 'Backtesting',
            desc: 'Run historical strategy simulations',
            to: '/backtest',
            color: '#f59e0b',
          },
          {
            icon: <BarChart3 size={20} />,
            title: 'Performance',
            desc: 'Compare strategy vs buy-and-hold returns',
            to: '/backtest',
            color: '#8b5cf6',
          },
          {
            icon: <FileDown size={20} />,
            title: 'Reports',
            desc: 'Export analysis results as PDF or CSV',
            to: '/reports',
            color: '#ec4899',
          },
        ].map((card) => (
          <div
            key={card.title}
            className="card"
            style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
            onClick={() => navigate(card.to)}
          >
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 3,
              background: card.color, opacity: 0.6,
            }} />
            <div className="flex items-center gap-3 mb-4" style={{ marginTop: 4 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 'var(--radius-md)',
                background: `${card.color}15`, color: card.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {card.icon}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{card.title}</div>
                <div className="text-sm text-muted">{card.desc}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm" style={{ color: card.color }}>
              Open <ArrowRight size={14} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

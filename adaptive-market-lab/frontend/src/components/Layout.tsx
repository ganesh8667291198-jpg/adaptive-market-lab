import { useState, type ReactNode, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  LineChart,
  Zap,
  FlaskConical,
  FileDown,
  Menu,
  X,
  Activity,
} from 'lucide-react';

interface NavItem {
  to: string;
  icon: ReactNode;
  label: string;
}

const navItems: NavItem[] = [
  { to: '/', icon: <LayoutDashboard />, label: 'Dashboard' },
  { to: '/explorer', icon: <Search />, label: 'Market Explorer' },
  { to: '/indicators', icon: <LineChart />, label: 'Indicator Lab' },
  { to: '/signals', icon: <Zap />, label: 'Signal Detector' },
  { to: '/backtest', icon: <FlaskConical />, label: 'Backtesting' },
  { to: '/reports', icon: <FileDown />, label: 'Reports' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="app-layout">
      {/* Mobile header */}
      <div className="mobile-header">
        <button className="btn btn-ghost" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          <Menu />
        </button>
        <div className="flex items-center gap-2">
          <div className="sidebar-logo-icon" style={{ width: 28, height: 28, fontSize: 12 }}>
            <Activity size={16} />
          </div>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Adaptive Market Lab</span>
        </div>
        <div style={{ width: 32 }} />
      </div>

      {/* Sidebar overlay (mobile) */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={closeSidebar}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Activity size={18} />
          </div>
          <div>
            <h1>Adaptive Market Lab</h1>
            <span>Financial Analysis Platform</span>
          </div>
          <button
            className="btn btn-ghost"
            onClick={closeSidebar}
            style={{ marginLeft: 'auto', display: sidebarOpen ? 'flex' : 'none', padding: 4 }}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Analysis</div>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''}`
              }
              onClick={closeSidebar}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-subtle)' }}>
          <p className="text-xs text-muted">Academic AI Project</p>
          <p className="text-xs text-muted" style={{ marginTop: 2 }}>v1.0.0</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content" key={location.pathname}>
        <div className="animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}

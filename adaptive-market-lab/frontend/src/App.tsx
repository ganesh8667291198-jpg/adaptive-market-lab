import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Explorer from '@/pages/Explorer';
import IndicatorLab from '@/pages/IndicatorLab';
import SignalDetector from '@/pages/SignalDetector';
import Backtesting from '@/pages/Backtesting';
import Reports from '@/pages/Reports';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/explorer" element={<Explorer />} />
        <Route path="/indicators" element={<IndicatorLab />} />
        <Route path="/signals" element={<SignalDetector />} />
        <Route path="/backtest" element={<Backtesting />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

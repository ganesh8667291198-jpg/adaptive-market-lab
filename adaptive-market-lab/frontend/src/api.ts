import axios from 'axios';
import type {
  MarketDataResponse,
  IndicatorRequest,
  IndicatorResponse,
  SignalRequest,
  SignalResponse,
  BacktestRequest,
  BacktestResponse,
  ReportRequest,
} from '@/types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Market Data ──────────────────────────────────────────────────────

export async function searchSymbol(symbol: string) {
  const { data } = await api.get('/market/search', { params: { symbol } });
  return data as { valid: boolean; symbol: string; name: string | null; currency: string | null };
}

export async function fetchHistory(
  symbol: string,
  period: string = '1y',
  startDate?: string,
  endDate?: string,
) {
  const params: Record<string, string> = { symbol, period };
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  const { data } = await api.get<MarketDataResponse>('/market/history', { params });
  return data;
}

export async function uploadCSV(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<MarketDataResponse>('/data/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return data;
}

// ── Indicators ───────────────────────────────────────────────────────

export async function calculateIndicators(req: IndicatorRequest) {
  const { data } = await api.post<IndicatorResponse>('/indicators/calculate', req);
  return data;
}

// ── Signals ──────────────────────────────────────────────────────────

export async function detectSignals(req: SignalRequest) {
  const { data } = await api.post<SignalResponse>('/signals/detect', req);
  return data;
}

// ── Backtesting ──────────────────────────────────────────────────────

export async function runBacktest(req: BacktestRequest) {
  const { data } = await api.post<BacktestResponse>('/backtest/run', req);
  return data;
}

// ── Reports ──────────────────────────────────────────────────────────

export async function exportReport(req: ReportRequest) {
  const { data } = await api.post('/reports/export', req, {
    responseType: 'blob',
    timeout: 60000,
  });
  return data as Blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

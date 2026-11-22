// ── API Types matching backend Pydantic schemas ──────────────────────

export interface OHLCVRow {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
}

export interface MarketSummary {
  latest_close: number;
  previous_close: number | null;
  price_change: number | null;
  price_change_pct: number | null;
  highest: number;
  lowest: number;
  avg_volume: number | null;
}

export interface MarketDataResponse {
  symbol: string;
  name: string | null;
  currency: string | null;
  data: OHLCVRow[];
  summary: MarketSummary | null;
}

export interface IndicatorConfig {
  type: 'SMA' | 'EMA' | 'KAMA';
  period: number;
  fast_period?: number;
  slow_period?: number;
}

export interface IndicatorResult {
  type: string;
  period: number;
  values: (number | null)[];
  params: Record<string, number>;
}

export interface IndicatorRequest {
  close_prices: number[];
  indicators: IndicatorConfig[];
}

export interface IndicatorResponse {
  results: IndicatorResult[];
}

export interface CrossoverSignal {
  date: string;
  price: number;
  signal_type: 'BUY' | 'SELL';
  fast_value: number;
  slow_value: number;
  explanation: string;
}

export interface SignalRequest {
  close_prices: number[];
  dates: string[];
  fast_type: 'SMA' | 'EMA' | 'KAMA';
  slow_type: 'SMA' | 'EMA' | 'KAMA';
  fast_period: number;
  slow_period: number;
}

export interface SignalResponse {
  signals: CrossoverSignal[];
  fast_values: (number | null)[];
  slow_values: (number | null)[];
}

export interface TradeRecord {
  entry_date: string;
  entry_price: number;
  exit_date: string | null;
  exit_price: number | null;
  shares: number;
  pnl: number | null;
  pnl_pct: number | null;
  fees_paid: number;
}

export interface BacktestMetrics {
  initial_capital: number;
  final_value: number;
  total_return: number;
  total_return_pct: number;
  num_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number | null;
  max_drawdown: number;
  max_drawdown_pct: number;
  sharpe_ratio: number | null;
  buy_hold_return: number;
  buy_hold_return_pct: number;
}

export interface BacktestRequest {
  close_prices: number[];
  dates: string[];
  initial_capital: number;
  fast_type: 'SMA' | 'EMA' | 'KAMA';
  slow_type: 'SMA' | 'EMA' | 'KAMA';
  fast_period: number;
  slow_period: number;
  fee_pct: number;
}

export interface BacktestResponse {
  metrics: BacktestMetrics;
  trades: TradeRecord[];
  equity_curve: number[];
  drawdown_curve: number[];
  buy_hold_curve: number[];
}

export interface ReportRequest {
  symbol?: string;
  dates: string[];
  close_prices: number[];
  indicators?: IndicatorResult[];
  signals?: CrossoverSignal[];
  backtest_metrics?: BacktestMetrics;
  trades?: TradeRecord[];
  format: 'pdf' | 'csv';
  report_type: 'full' | 'data' | 'signals' | 'backtest';
}

export type IndicatorType = 'SMA' | 'EMA' | 'KAMA';

import { create } from 'zustand';
import type {
  MarketDataResponse,
  IndicatorResult,
  CrossoverSignal,
  BacktestResponse,
  IndicatorType,
  OHLCVRow,
} from '@/types';
import * as api from '@/api';

interface AppState {
  // ── Data ──
  marketData: MarketDataResponse | null;
  isLoading: boolean;
  error: string | null;

  // ── Indicators ──
  indicators: IndicatorResult[];
  indicatorConfigs: {
    type: IndicatorType;
    period: number;
    fast_period: number;
    slow_period: number;
    enabled: boolean;
  }[];

  // ── Signals ──
  signals: CrossoverSignal[];
  signalFastValues: (number | null)[];
  signalSlowValues: (number | null)[];
  signalConfig: {
    fast_type: IndicatorType;
    slow_type: IndicatorType;
    fast_period: number;
    slow_period: number;
  };

  // ── Backtest ──
  backtestResult: BacktestResponse | null;
  backtestConfig: {
    initial_capital: number;
    fast_type: IndicatorType;
    slow_type: IndicatorType;
    fast_period: number;
    slow_period: number;
    fee_pct: number;
  };

  // ── Actions ──
  loadSymbol: (symbol: string, period?: string) => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
  computeIndicators: () => Promise<void>;
  computeSignals: () => Promise<void>;
  runBacktest: () => Promise<void>;
  setIndicatorConfigs: (configs: AppState['indicatorConfigs']) => void;
  setSignalConfig: (config: Partial<AppState['signalConfig']>) => void;
  setBacktestConfig: (config: Partial<AppState['backtestConfig']>) => void;
  clearData: () => void;
  clearError: () => void;
}

const defaultIndicatorConfigs: AppState['indicatorConfigs'] = [
  { type: 'SMA', period: 20, fast_period: 2, slow_period: 30, enabled: true },
  { type: 'EMA', period: 12, fast_period: 2, slow_period: 30, enabled: true },
  { type: 'KAMA', period: 10, fast_period: 2, slow_period: 30, enabled: true },
];

export const useStore = create<AppState>((set, get) => ({
  // ── Initial state ──
  marketData: null,
  isLoading: false,
  error: null,
  indicators: [],
  indicatorConfigs: defaultIndicatorConfigs,
  signals: [],
  signalFastValues: [],
  signalSlowValues: [],
  signalConfig: { fast_type: 'EMA', slow_type: 'SMA', fast_period: 12, slow_period: 26 },
  backtestResult: null,
  backtestConfig: {
    initial_capital: 100000,
    fast_type: 'EMA',
    slow_type: 'SMA',
    fast_period: 12,
    slow_period: 26,
    fee_pct: 0.1,
  },

  // ── Actions ──
  loadSymbol: async (symbol, period = '1y') => {
    set({ isLoading: true, error: null, indicators: [], signals: [], signalFastValues: [], signalSlowValues: [], backtestResult: null });
    try {
      const data = await api.fetchHistory(symbol, period);
      set({ marketData: data, isLoading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch market data';
      const axiosMsg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      set({ error: axiosMsg || msg, isLoading: false });
    }
  },

  uploadFile: async (file) => {
    set({ isLoading: true, error: null, indicators: [], signals: [], signalFastValues: [], signalSlowValues: [], backtestResult: null });
    try {
      const data = await api.uploadCSV(file);
      set({ marketData: data, isLoading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to process CSV';
      const axiosMsg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      set({ error: axiosMsg || msg, isLoading: false });
    }
  },

  computeIndicators: async () => {
    const { marketData, indicatorConfigs } = get();
    if (!marketData) return;

    const closePrices = marketData.data.map((r: OHLCVRow) => r.close);
    const enabled = indicatorConfigs.filter((c) => c.enabled);
    if (enabled.length === 0) return;

    set({ isLoading: true, error: null });
    try {
      const res = await api.calculateIndicators({
        close_prices: closePrices,
        indicators: enabled.map((c) => ({
          type: c.type,
          period: c.period,
          fast_period: c.fast_period,
          slow_period: c.slow_period,
        })),
      });
      set({ indicators: res.results, isLoading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to calculate indicators';
      const axiosMsg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      set({ error: axiosMsg || msg, isLoading: false });
    }
  },

  computeSignals: async () => {
    const { marketData, signalConfig } = get();
    if (!marketData) return;

    set({ isLoading: true, error: null });
    try {
      const res = await api.detectSignals({
        close_prices: marketData.data.map((r: OHLCVRow) => r.close),
        dates: marketData.data.map((r: OHLCVRow) => r.date),
        ...signalConfig,
      });
      set({
        signals: res.signals,
        signalFastValues: res.fast_values,
        signalSlowValues: res.slow_values,
        isLoading: false,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to detect signals';
      const axiosMsg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      set({ error: axiosMsg || msg, isLoading: false });
    }
  },

  runBacktest: async () => {
    const { marketData, backtestConfig } = get();
    if (!marketData) return;

    set({ isLoading: true, error: null });
    try {
      const res = await api.runBacktest({
        close_prices: marketData.data.map((r: OHLCVRow) => r.close),
        dates: marketData.data.map((r: OHLCVRow) => r.date),
        ...backtestConfig,
      });
      set({ backtestResult: res, isLoading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Backtest failed';
      const axiosMsg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      set({ error: axiosMsg || msg, isLoading: false });
    }
  },

  setIndicatorConfigs: (configs) => set({ indicatorConfigs: configs }),
  setSignalConfig: (config) =>
    set((s) => ({ signalConfig: { ...s.signalConfig, ...config } })),
  setBacktestConfig: (config) =>
    set((s) => ({ backtestConfig: { ...s.backtestConfig, ...config } })),
  clearData: () =>
    set({
      marketData: null,
      indicators: [],
      signals: [],
      signalFastValues: [],
      signalSlowValues: [],
      backtestResult: null,
      error: null,
    }),
  clearError: () => set({ error: null }),
}));

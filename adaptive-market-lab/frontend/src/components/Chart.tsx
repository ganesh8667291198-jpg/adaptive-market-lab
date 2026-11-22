import Plot from 'react-plotly.js';
import type { Data, Layout as PlotlyLayout } from 'plotly.js';

interface ChartProps {
  data: Data[];
  layout?: Partial<PlotlyLayout>;
  height?: number;
  title?: string;
}

const darkTheme: Partial<PlotlyLayout> = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(17, 24, 39, 0.5)',
  font: {
    family: 'Inter, sans-serif',
    color: '#94a3b8',
    size: 12,
  },
  xaxis: {
    gridcolor: 'rgba(148,163,184,0.08)',
    linecolor: 'rgba(148,163,184,0.1)',
    tickfont: { size: 11 },
    zeroline: false,
  },
  yaxis: {
    gridcolor: 'rgba(148,163,184,0.08)',
    linecolor: 'rgba(148,163,184,0.1)',
    tickfont: { size: 11 },
    zeroline: false,
  },
  margin: { t: 40, r: 20, b: 50, l: 60 },
  legend: {
    bgcolor: 'rgba(0,0,0,0)',
    font: { size: 11, color: '#94a3b8' },
    orientation: 'h',
    y: -0.15,
  },
  hovermode: 'x unified',
  hoverlabel: {
    bgcolor: '#1e2436',
    bordercolor: 'rgba(148,163,184,0.2)',
    font: { family: 'Inter, sans-serif', size: 12, color: '#f1f5f9' },
  },
};

export default function Chart({ data, layout, height = 400, title }: ChartProps) {
  const mergedLayout: Partial<PlotlyLayout> = {
    ...darkTheme,
    height,
    title: title
      ? { text: title, font: { size: 14, color: '#f1f5f9' }, x: 0.02 }
      : undefined,
    ...layout,
    xaxis: { ...darkTheme.xaxis, ...(layout?.xaxis ?? {}) },
    yaxis: { ...darkTheme.yaxis, ...(layout?.yaxis ?? {}) },
  };

  return (
    <div className="chart-container">
      <Plot
        data={data}
        layout={mergedLayout}
        config={{
          responsive: true,
          displayModeBar: true,
          modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d'],
          displaylogo: false,
        }}
        style={{ width: '100%' }}
        useResizeHandler
      />
    </div>
  );
}

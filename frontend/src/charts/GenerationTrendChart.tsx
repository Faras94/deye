import ReactECharts from 'echarts-for-react'

interface SeriesPoint {
  label: string
  value: number
}

interface GenerationTrendChartProps {
  data: SeriesPoint[]
  title?: string
  unit?: string
  height?: number
  type?: 'line' | 'bar'
  color?: string
}

export function GenerationTrendChart({
  data,
  unit = 'W',
  height = 300,
  type = 'line',
  color = '#f59e0b',
}: GenerationTrendChartProps) {
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      borderColor: 'rgba(148, 163, 184, 0.2)',
      textStyle: { color: '#f8fafc', fontSize: 12 },
      valueFormatter: (val: number) => `${val ?? 0} ${unit}`,
    },
    grid: { left: 48, right: 20, top: 20, bottom: 32 },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.label),
      axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.3)' } },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
      axisLabel: { color: '#94a3b8', fontSize: 11, formatter: `{value} ${unit}` },
    },
    series: [
      {
        type,
        data: data.map((d) => d.value),
        smooth: type === 'line',
        showSymbol: false,
        itemStyle: { color, borderRadius: type === 'bar' ? [6, 6, 0, 0] : 0 },
        lineStyle: { width: 2.5, color },
        areaStyle:
          type === 'line'
            ? {
                color: {
                  type: 'linear',
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: 'rgba(245, 158, 11, 0.32)' },
                    { offset: 1, color: 'rgba(245, 158, 11, 0.02)' },
                  ],
                },
              }
            : undefined,
      },
    ],
  }

  return <ReactECharts option={option} style={{ height, width: '100%' }} notMerge />
}

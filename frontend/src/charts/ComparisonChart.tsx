import ReactECharts from 'echarts-for-react'

interface ComparisonItem {
  name: string
  value: number
}

interface ComparisonChartProps {
  data: ComparisonItem[]
  unit?: string
  height?: number
}

export function ComparisonChart({ data, unit = 'kWh', height = 280 }: ComparisonChartProps) {
  const palette = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6']
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      borderColor: 'rgba(148, 163, 184, 0.2)',
      textStyle: { color: '#f8fafc', fontSize: 12 },
      valueFormatter: (val: number) => `${val ?? 0} ${unit}`,
    },
    grid: { left: 48, right: 20, top: 16, bottom: 36 },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.name),
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.3)' } },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
      axisLabel: { color: '#94a3b8', fontSize: 11, formatter: `{value} ${unit}` },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 44,
        data: data.map((d, idx) => ({
          value: d.value,
          itemStyle: { color: palette[idx % palette.length], borderRadius: [6, 6, 0, 0] },
        })),
      },
    ],
  }

  return <ReactECharts option={option} style={{ height, width: '100%' }} notMerge />
}

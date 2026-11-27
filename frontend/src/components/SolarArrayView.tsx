import { Sun, Zap } from 'lucide-react'
import type { Inverter, InverterReading, Panel, PanelReading } from '@/types/v2'

interface SolarArrayViewProps {
  panels: Panel[]
  inverters: Inverter[]
  readingsByPanel: Map<string, PanelReading[]>
  latestInvBySn: Map<string, InverterReading>
  totalPowerW: number
}

export function SolarArrayView({
  panels,
  inverters,
  readingsByPanel,
  latestInvBySn,
  totalPowerW,
}: SolarArrayViewProps) {
  const invOrder = new Map(inverters.map((inv, idx) => [inv.id, inv.display_order ?? idx]))

  const orderedPanels = [...panels].sort((a, b) => {
    const orderDiff = (invOrder.get(a.inverter_id) ?? 99) - (invOrder.get(b.inverter_id) ?? 99)
    if (orderDiff !== 0) return orderDiff
    return a.channel_index - b.channel_index
  })

  // Group into arrays of 4: Array 1 (PV1 - PV4), Array 2 (PV5 - PV8), ...
  const arrays: Array<{ label: string; items: Array<{ panel: Panel; pvNum: number }> }> = []
  for (let i = 0; i < orderedPanels.length; i += 4) {
    const slice = orderedPanels.slice(i, i + 4).map((panel, offset) => ({
      panel,
      pvNum: i + offset + 1,
    }))
    const startPv = i + 1
    const endPv = i + slice.length
    arrays.push({
      label: `Array ${Math.floor(i / 4) + 1} (PV${startPv}${endPv > startPv ? ` – PV${endPv}` : ''})`,
      items: slice,
    })
  }

  // Average inverter temperature if available
  const temps = Array.from(latestInvBySn.values())
    .map((r) => r.temperature_c)
    .filter((t): t is number => t != null)
  const avgTemp = temps.length > 0 ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : null

  // Sum panel power if available, otherwise fall back to total AC inverter power
  let panelSumW = 0
  let panelsWithPower = 0
  orderedPanels.forEach((p) => {
    const hist = readingsByPanel.get(p.id) ?? []
    const latest = hist[hist.length - 1]
    if (latest?.power_w != null) {
      panelSumW += Number(latest.power_w)
      panelsWithPower += 1
    }
  })

  const displayTotalW = panelsWithPower > 0 ? panelSumW : totalPowerW
  const avgPanelW =
    orderedPanels.length > 0 ? Math.round(displayTotalW / orderedPanels.length) : 0
  const isGenerating = displayTotalW > 0

  return (
    <div className="relative overflow-hidden rounded-2xl border border-sky-400/30 bg-gradient-to-b from-sky-500 via-sky-600 to-blue-800 p-4 sm:p-6 text-white shadow-xl">
      {/* Subtle Sun Glow */}
      <div className="pointer-events-none absolute -top-16 -left-16 h-56 w-56 rounded-full bg-amber-300/30 blur-3xl" />

      {/* Top Sky Header */}
      <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 self-start sm:self-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/25 ring-2 ring-amber-300/50 shadow-lg shadow-amber-400/20">
            <Sun className="h-7 w-7 text-amber-300" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold leading-tight">
              {avgTemp != null ? `${avgTemp}°C` : isGenerating ? 'Active' : 'Standby'}
            </div>
            <div className="text-xs sm:text-sm text-sky-100/90">
              {isGenerating ? 'Generating' : 'Night / Standby'}
            </div>
          </div>
        </div>

        {/* Total Solar Output Hero Badge */}
        <div className="w-full sm:w-auto sm:min-w-[260px] rounded-2xl border border-sky-300/40 bg-slate-950/65 backdrop-blur-md px-6 py-3.5 text-center shadow-lg">
          <div className="flex items-center justify-center gap-2 text-xs font-medium text-sky-200">
            <Zap className="h-4 w-4 text-amber-400 fill-amber-400" />
            <span>Total Solar Output</span>
          </div>
          <div className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-0.5">
            {displayTotalW >= 1000
              ? `${(displayTotalW / 1000).toFixed(2)} kW`
              : `${Math.round(displayTotalW)} W`}
          </div>
          <div className="text-xs text-sky-200/80 mt-0.5">
            ({orderedPanels.length} {orderedPanels.length === 1 ? 'Panel' : 'Panels'}
            {avgPanelW > 0 ? ` × ~${avgPanelW} W` : ''})
          </div>
        </div>

        <div className="hidden sm:block w-28" />
      </div>

      {/* Solar Arrays (4 panels per rack) */}
      <div className="relative space-y-6">
        {arrays.map((arr) => (
          <div key={arr.label} className="space-y-2.5">
            <div className="flex justify-center">
              <div className="rounded-full border border-sky-300/40 bg-slate-950/70 backdrop-blur-sm px-5 py-1 text-xs sm:text-sm font-semibold tracking-wide text-white shadow">
                {arr.label}
              </div>
            </div>

            <div className="rounded-xl border-2 border-slate-300/40 bg-slate-900/50 p-2 sm:p-2.5 shadow-inner">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
                {arr.items.map(({ panel, pvNum }) => {
                  const history = readingsByPanel.get(panel.id) ?? []
                  const latest = history[history.length - 1]
                  const powerW = latest?.power_w
                  const isNormal = powerW != null && powerW > 0

                  return (
                    <div
                      key={panel.id}
                      className="relative overflow-hidden rounded-lg border-2 border-sky-200/60 bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-950 p-3 sm:p-4 min-h-[126px] flex items-center justify-center shadow-md"
                    >
                      {/* Solar cell grid lines */}
                      <div
                        className="pointer-events-none absolute inset-0 opacity-30"
                        style={{
                          backgroundImage:
                            'linear-gradient(to right, rgba(191,219,254,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(191,219,254,0.6) 1px, transparent 1px)',
                          backgroundSize: '24px 24px',
                        }}
                      />

                      {/* Frosted reading card */}
                      <div className="relative z-10 w-full rounded-lg border border-sky-300/35 bg-slate-950/70 backdrop-blur-sm px-3 py-2.5 text-center shadow">
                        <div className="text-xs font-semibold text-sky-200 tracking-wide">
                          PV{pvNum}
                          {panel.name && panel.name !== `PV${pvNum}` ? (
                            <span className="text-[10px] text-sky-300/75 font-normal block truncate">
                              {panel.name}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white my-0.5">
                          {powerW != null ? (
                            <>
                              {Math.round(powerW)} <span className="text-base font-semibold">W</span>
                            </>
                          ) : (
                            <span className="text-xl text-slate-300">— W</span>
                          )}
                        </div>
                        <div className="flex items-center justify-center gap-1.5 text-xs">
                          <span
                            className={`inline-block h-2.5 w-2.5 rounded-full ${
                              isNormal
                                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]'
                                : 'bg-slate-400'
                            }`}
                          />
                          <span className={isNormal ? 'text-emerald-300 font-medium' : 'text-slate-300'}>
                            {isNormal ? 'Normal' : powerW === 0 ? 'Idle' : 'No PV data'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

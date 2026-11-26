export function SolarPanelGraphic({ active = true }: { active?: boolean }) {
  return (
    <svg
      viewBox="0 0 96 64"
      className="h-14 w-20 shrink-0 drop-shadow-md"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="pvGrad" x1="0" y1="0" x2="96" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={active ? '#2563eb' : '#334155'} />
          <stop offset="100%" stopColor={active ? '#1d4ed8' : '#1e293b'} />
        </linearGradient>
      </defs>
      <polygon
        points="14,8 90,8 82,56 6,56"
        fill="url(#pvGrad)"
        stroke={active ? '#93c5fd' : '#64748b'}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <line x1="33" y1="8" x2="25" y2="56" stroke="#bfdbfe" strokeOpacity="0.45" strokeWidth="1.2" />
      <line x1="52" y1="8" x2="44" y2="56" stroke="#bfdbfe" strokeOpacity="0.45" strokeWidth="1.2" />
      <line x1="71" y1="8" x2="63" y2="56" stroke="#bfdbfe" strokeOpacity="0.45" strokeWidth="1.2" />
      <line x1="11.3" y1="24" x2="87.3" y2="24" stroke="#bfdbfe" strokeOpacity="0.45" strokeWidth="1.2" />
      <line x1="8.6" y1="40" x2="84.6" y2="40" stroke="#bfdbfe" strokeOpacity="0.45" strokeWidth="1.2" />
    </svg>
  )
}

export function MicroinverterGraphic({ online = false }: { online?: boolean }) {
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
        online
          ? 'border-sky-400/40 bg-sky-500/20 text-sky-400'
          : 'border-slate-600/40 bg-slate-800/70 text-slate-400'
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="M8 5V3M12 5V3M16 5V3M8 21v-2M16 21v-2" />
        <path d="M9 12h2l1-2 1 4 1-2h1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export function PanelSparkline({ values, active }: { values: number[]; active: boolean }) {
  const pts = values.length >= 2 ? values : [0, 0]
  const max = Math.max(...pts, 1)
  const w = 240
  const h = 36
  const coords = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * w
    const y = h - (Math.max(0, v) / max) * (h - 6) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const linePath = `M ${coords.join(' L ')}`
  const areaPath = `${linePath} L ${w},${h} L 0,${h} Z`
  const stroke = active ? '#10b981' : '#475569'
  const fill = active ? 'rgba(16, 185, 129, 0.22)' : 'rgba(71, 85, 105, 0.12)'

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-9 block" preserveAspectRatio="none">
      <path d={areaPath} fill={fill} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

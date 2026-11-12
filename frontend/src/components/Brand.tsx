import { useId } from 'react'

export function Logo({ size = 36 }: { size?: number }) {
  const id = `rv-gold-${useId().replace(/:/g, '')}`
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#0b1a2c" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="none" stroke="#d4a845" strokeOpacity="0.35" />
      <path d="M8 26V15a8 8 0 0 1 16 0v11z" fill={`url(#${id})`} />
      <path d="M12.5 18h7M12.5 21.5h7" stroke="#0b1a2c" strokeWidth="1.8" strokeLinecap="round" />
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ecd697" />
          <stop offset="1" stopColor="#c08f2e" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Logo />
      <div className="leading-tight">
        <div className={`font-display text-lg font-semibold tracking-tight ${light ? 'text-white' : 'text-night-900'}`}>
          ReceiptVault
        </div>
        <div className={`font-arabic text-[11px] ${light ? 'text-gold-300/80' : 'text-gold-600'}`} dir="rtl">
          خزنة الإيصالات
        </div>
      </div>
    </div>
  )
}

const FILLER: [number, number, number][] = [
  [0, 46, 70], [50, 30, 110], [84, 40, 80], [230, 36, 120], [270, 28, 150], [302, 44, 95], [350, 26, 175],
  [380, 40, 130], [424, 30, 190], [458, 46, 140], [508, 26, 210], [624, 30, 200], [658, 42, 150], [704, 28, 230],
  [736, 38, 160], [778, 34, 120], [816, 28, 140], [910, 40, 130], [954, 30, 95], [1070, 36, 115], [1110, 44, 85], [1158, 42, 60],
]

export function Skyline({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 1200 260" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden="true">
      <g fill="currentColor">
        {FILLER.map(([x, w, h]) => (
          <rect key={x} x={x} y={260 - h} width={w} height={h} />
        ))}
        {/* Burj Al Arab */}
        <path d="M140 260V92q58 22 76 168z" />
        <rect x="136" y="70" width="4" height="190" />
        {/* Burj Khalifa */}
        <path d="M540 260v-90h12v-50h10V70h8V30h4l1-30 1 30h4v40h8v50h10v50h12v90z" />
        {/* Emirates Towers */}
        <path d="M850 260V92l20-32v200zM878 260V112l20-26v174z" />
        {/* Dubai Frame */}
        <path d="M990 260V118h72v142h-12V130h-48v130z" />
      </g>
    </svg>
  )
}

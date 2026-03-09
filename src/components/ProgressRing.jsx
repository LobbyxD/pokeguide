import React from 'react'

export default function ProgressRing({ percent = 0, size = 60, strokeWidth = 5, color }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.max(0, Math.min(100, percent)) / 100)

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      {/* Background ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={strokeWidth}
      />
      {/* Progress ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color || 'var(--game-color)'}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
      {/* Label */}
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          transform: 'rotate(90deg)',
          transformOrigin: `${size / 2}px ${size / 2}px`,
          fill: 'var(--text-primary)',
          fontSize: size * 0.22,
          fontWeight: 700,
          fontFamily: 'Segoe UI, sans-serif',
        }}
      >
        {Math.round(percent)}%
      </text>
    </svg>
  )
}

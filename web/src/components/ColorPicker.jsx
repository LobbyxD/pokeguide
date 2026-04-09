import React, { useState, useRef, useEffect } from 'react'
import { Check } from './Icons.jsx'

const SWATCHES = [
  // Reds / Fire
  '#e53e3e', '#c0392b', '#ff6b6b', '#e8472a',
  // Oranges
  '#dd6b20', '#f6993f', '#e67e22',
  // Yellows / Electric
  '#d69e2e', '#f6e05e', '#f9ca24',
  // Greens / Grass
  '#38a169', '#48bb78', '#27ae60', '#2ecc71',
  // Teals / Water
  '#2b9a9a', '#38b2ac', '#00b5d8',
  // Blues / Water
  '#2b6cb0', '#3182ce', '#4299e1', '#0078d4',
  // Purples / Psychic
  '#6b46c1', '#805ad5', '#9f7aea', '#553c9a',
  // Pinks / Fairy
  '#d53f8c', '#ed64a6', '#f687b3',
  // Grays / Steel
  '#4a5568', '#718096', '#a0aec0',
  // Dark / Dark type
  '#2d3748', '#1a202c',
]

function isValidHex(str) {
  return /^#[0-9a-fA-F]{6}$/.test(str)
}

export default function ColorPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [hexInput, setHexInput] = useState(value || '#e53e3e')
  const ref = useRef(null)

  // Sync hex input when value changes externally
  useEffect(() => {
    if (isValidHex(value)) setHexInput(value)
  }, [value])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const pick = (color) => {
    setHexInput(color)
    onChange(color)
  }

  const handleHexCommit = () => {
    const v = hexInput.startsWith('#') ? hexInput : '#' + hexInput
    if (isValidHex(v)) { onChange(v); setHexInput(v) }
    else setHexInput(value) // revert
  }

  const current = isValidHex(value) ? value : '#e53e3e'

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-input)', border: '1px solid var(--border-color)',
          borderRadius: 6, padding: '5px 10px 5px 6px', cursor: 'pointer',
          transition: 'border-color 0.15s',
        }}
      >
        <span style={{
          width: 20, height: 20, borderRadius: 4,
          background: current,
          display: 'inline-block', flexShrink: 0,
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.3)',
        }} />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace', letterSpacing: '0.03em' }}>
          {current.toUpperCase()}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200,
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          borderRadius: 10, padding: 12, width: 220,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          {/* Swatch grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5, marginBottom: 10,
          }}>
            {SWATCHES.map(color => (
              <button
                key={color}
                type="button"
                title={color}
                onClick={() => pick(color)}
                style={{
                  width: 24, height: 24, borderRadius: 5,
                  background: color, border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  outline: color === current ? `2px solid ${color}` : 'none',
                  outlineOffset: 2,
                  transition: 'transform 0.1s',
                  boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.2)',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                {color === current && <Check size={11} style={{ color: '#fff', filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.8))' }} />}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--border-color)', margin: '8px 0' }} />

          {/* Hex input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 16, height: 16, borderRadius: 3, background: current,
              flexShrink: 0, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.3)',
            }} />
            <input
              value={hexInput}
              onChange={e => setHexInput(e.target.value)}
              onBlur={handleHexCommit}
              onKeyDown={e => { if (e.key === 'Enter') { handleHexCommit(); setOpen(false) } }}
              placeholder="#ffffff"
              spellCheck={false}
              style={{
                flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                borderRadius: 5, padding: '4px 8px', fontSize: 12, color: 'var(--text-primary)',
                fontFamily: 'monospace', outline: 'none',
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

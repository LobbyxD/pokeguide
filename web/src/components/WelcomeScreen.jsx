import React, { useState, useEffect } from 'react'
import { Plus, Globe } from './Icons.jsx'

const OFFICIAL_PRESETS_URL = 'https://raw.githubusercontent.com/LobbyxD/pokeguide/main/presets/index.json'

// Colour hints per preset filename keyword so cards feel distinct
const PRESET_COLORS = {
  'fire-red': '#e53e3e',
  leafgreen: '#38a169',
  ruby: '#c05621',
  sapphire: '#2b6cb0',
  emerald: '#276749',
  gold: '#d69e2e',
  silver: '#718096',
  crystal: '#00b5d8',
  diamond: '#9f7aea',
  pearl: '#f687b3',
  platinum: '#4a5568',
  black: '#2d3748',
  white: '#e2e8f0',
  sword: '#3182ce',
  shield: '#e53e3e',
  scarlet: '#c53030',
  violet: '#6b46c1',
  sun: '#dd6b20',
  moon: '#553c9a',
  x: '#2b6cb0',
  y: '#c05621',
  default: '#e53e3e',
}

function presetColor(filename) {
  if (!filename) return PRESET_COLORS.default
  const key = Object.keys(PRESET_COLORS).find(k => filename.toLowerCase().includes(k))
  return key ? PRESET_COLORS[key] : PRESET_COLORS.default
}

function PokeballIcon({ color, size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="19" stroke={color} strokeWidth="2" fill="none" opacity="0.15" />
      <path d="M1 20 Q1 10 10 5 Q15 2 20 1 Q25 2 30 5 Q39 10 39 20" fill={color} opacity="0.2" />
      <line x1="1" y1="20" x2="39" y2="20" stroke={color} strokeWidth="2" opacity="0.5" />
      <circle cx="20" cy="20" r="5" fill={color} opacity="0.7" />
      <circle cx="20" cy="20" r="3" fill="white" opacity="0.6" />
    </svg>
  )
}

export default function WelcomeScreen({ onLoadPreset, onBuildOwn }) {
  const [presets, setPresets] = useState(null) // null = loading
  const [error, setError] = useState(false)
  const [loadingId, setLoadingId] = useState(null)

  useEffect(() => {
    fetch(OFFICIAL_PRESETS_URL)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => setPresets(data))
      .catch(() => { setError(true); setPresets([]) })
  }, [])

  const handlePreset = async (item) => {
    if (loadingId) return
    setLoadingId(item.filename)
    try {
      const url = `https://raw.githubusercontent.com/LobbyxD/pokeguide/main/presets/${item.filename}.pgpreset`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const preset = await res.json()
      await onLoadPreset(preset)
    } catch (e) {
      alert('Failed to load preset: ' + e.message)
    }
    setLoadingId(null)
  }

  // At most 3 presets + 1 "Build Your Own" = 4 cards
  const visiblePresets = (presets || []).slice(0, 3)

  return (
    <div style={s.page}>
      <div style={s.inner}>
        {/* Header */}
        <div style={s.header}>
          <img src="/app-icon.png" alt="" style={s.logo} onError={e => { e.target.style.display = 'none' }} />
          <div style={s.title}>Welcome to PokeGuide</div>
          <div style={s.sub}>Pick a game to get started, or build your own.</div>
        </div>

        {/* Cards grid */}
        <div style={s.grid}>
          {/* Preset cards */}
          {presets === null ? (
            // Loading skeletons
            [0, 1, 2].map(i => (
              <div key={i} style={{ ...s.card, ...s.skeleton }} />
            ))
          ) : error && visiblePresets.length === 0 ? (
            <div style={{ ...s.card, ...s.errorCard }}>
              <Globe size={22} style={{ opacity: 0.4, marginBottom: 8 }} />
              <div style={s.cardTitle}>Couldn't load presets</div>
              <div style={s.cardDesc}>Check your internet connection.</div>
            </div>
          ) : (
            visiblePresets.map(item => {
              const color = presetColor(item.filename)
              const busy = loadingId === item.filename
              return (
                <button key={item.filename} className="welcome-card-hover" style={{ ...s.card, ...s.presetCard }} onClick={() => handlePreset(item)} disabled={!!loadingId}>
                  <div style={{ ...s.cardAccent, background: color }} />
                  <div style={s.cardIconWrap}>
                    {busy
                      ? <div style={{ ...s.spinner, borderTopColor: color }} />
                      : <PokeballIcon color={color} size={44} />
                    }
                  </div>
                  <div style={s.cardTitle}>{item.name}</div>
                  <div style={s.cardDesc}>{item.description || 'Official preset'}</div>
                  {item.author && <div style={s.cardAuthor}>by {item.author}</div>}
                  <div style={{ ...s.cardCta, color }}>
                    {busy ? 'Loading…' : 'Play'}
                  </div>
                </button>
              )
            })
          )}

          {/* "Build Your Own" card — always last */}
          <button className="welcome-card-hover" style={{ ...s.card, ...s.buildCard }} onClick={onBuildOwn} disabled={!!loadingId}>
            <div style={s.buildIconWrap}>
              <Plus size={28} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div style={{ ...s.cardTitle, color: 'var(--text-secondary)' }}>Build Your Own</div>
            <div style={s.cardDesc}>Create a custom game with your own steps, map, and Pokédex.</div>
          </button>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '100%', padding: '24px 16px', background: 'var(--bg-primary)',
  },
  inner: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 32, width: '100%', maxWidth: 900,
  },
  header: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center',
  },
  logo: { width: 56, height: 56, imageRendering: 'pixelated', marginBottom: 4 },
  title: { fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' },
  sub: { fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
    gap: 14, width: '100%',
  },
  card: {
    position: 'relative', display: 'flex', flexDirection: 'column',
    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
    borderRadius: 14, padding: '20px 18px 18px', cursor: 'pointer',
    textAlign: 'left', transition: 'transform 0.15s, box-shadow 0.15s',
    overflow: 'hidden',
  },
  skeleton: {
    height: 180, cursor: 'default',
    background: 'linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-tertiary) 50%, var(--bg-secondary) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s infinite',
  },
  errorCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: 160, cursor: 'default',
    color: 'var(--text-muted)', gap: 4,
  },
  presetCard: {
    gap: 4,
  },
  cardAccent: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: '14px 14px 0 0',
  },
  cardIconWrap: {
    marginBottom: 10, marginTop: 6,
    display: 'flex', alignItems: 'center',
  },
  spinner: {
    width: 36, height: 36, borderRadius: '50%',
    border: '3px solid var(--border-color)',
    borderTopColor: 'var(--game-color)',
    animation: 'spin 0.7s linear infinite',
  },
  cardTitle: {
    fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.3,
  },
  cardDesc: {
    fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, flex: 1,
  },
  cardAuthor: {
    fontSize: 11, color: 'var(--text-muted)', marginTop: 6, opacity: 0.7,
  },
  cardCta: {
    fontSize: 13, fontWeight: 700, marginTop: 12,
  },
  buildCard: {
    gap: 4, alignItems: 'center', justifyContent: 'center', textAlign: 'center',
    minHeight: 160, border: '2px dashed var(--border-color)',
    background: 'transparent',
  },
  buildIconWrap: {
    width: 52, height: 52, borderRadius: '50%',
    background: 'var(--bg-tertiary)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
}

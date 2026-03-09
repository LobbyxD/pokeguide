import React, { useState, useEffect } from 'react'
import { X } from './Icons.jsx'

const THEMES = [
  { id: '', label: 'Dark', description: 'Classic deep navy dark theme' },
  { id: 'midnight', label: 'Midnight', description: 'Ultra-dark deep space theme' },
  { id: 'forest', label: 'Forest', description: 'Nature-inspired green dark theme' },
  { id: 'crimson', label: 'Crimson', description: 'Rich red-tinted dark theme' },
]

function rgbaToHex(rgba) {
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (!match) return rgba
  const r = parseInt(match[1]).toString(16).padStart(2, '0')
  const g = parseInt(match[2]).toString(16).padStart(2, '0')
  const b = parseInt(match[3]).toString(16).padStart(2, '0')
  return `#${r}${g}${b}`
}

function hexToRgba(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default function OptionsModal({ onClose, onThemeChange }) {
  const [activeTab, setActiveTab] = useState('appearance')
  const [theme, setTheme] = useState('')
  const [mapSettings, setMapSettings] = useState({
    highlightFill: '#4299e1',
    highlightFillOpacity: 0.3,
    highlightStroke: '#4299e1',
    questMarkerColor: '#f6ad55',
    questMarkerOpacity: 0.9,
  })
  const [updateStatus, setUpdateStatus] = useState('')

  useEffect(() => {
    try {
      const settings = JSON.parse(localStorage.getItem('pg_settings') || '{}')
      setTheme(settings.theme || '')

      const ms = JSON.parse(localStorage.getItem('pg_map_settings') || '{}')
      setMapSettings(prev => ({ ...prev, ...ms }))
    } catch {}
  }, [])

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onUpdateAvailable(() => setUpdateStatus('Update available! Click to download.'))
      window.electronAPI.onUpdateDownloaded(() => setUpdateStatus('Update downloaded. Restart to apply.'))
    }
  }, [])

  const handleThemeChange = (t) => {
    setTheme(t)
    onThemeChange(t)
    try {
      const settings = JSON.parse(localStorage.getItem('pg_settings') || '{}')
      settings.theme = t
      localStorage.setItem('pg_settings', JSON.stringify(settings))
    } catch {}
  }

  const handleMapSettingChange = (key, value) => {
    const updated = { ...mapSettings, [key]: value }
    setMapSettings(updated)
    localStorage.setItem('pg_map_settings', JSON.stringify(updated))

    // Apply immediately
    if (key === 'questMarkerColor') {
      document.documentElement.style.setProperty('--quest-marker-color', value)
    }
    if (key === 'highlightFill') {
      const rgba = hexToRgba(value, updated.highlightFillOpacity)
      document.documentElement.style.setProperty('--highlight-fill', rgba)
    }
    if (key === 'highlightFillOpacity') {
      const rgba = hexToRgba(updated.highlightFill, value)
      document.documentElement.style.setProperty('--highlight-fill', rgba)
    }
    if (key === 'highlightStroke') {
      document.documentElement.style.setProperty('--highlight-stroke', value)
    }
  }

  const handleResetAll = () => {
    if (window.confirm('Reset all settings? This cannot be undone.')) {
      localStorage.removeItem('pg_settings')
      localStorage.removeItem('pg_map_settings')
      document.body.removeAttribute('data-theme')
      onThemeChange('')
      setTheme('')
      setMapSettings({
        highlightFill: '#4299e1',
        highlightFillOpacity: 0.3,
        highlightStroke: '#4299e1',
        questMarkerColor: '#f6ad55',
        questMarkerOpacity: 0.9,
      })
    }
  }

  const tabs = [
    { id: 'appearance', label: 'Appearance' },
    { id: 'map', label: 'Map' },
    { id: 'data', label: 'Data' },
    { id: 'updates', label: 'Updates' },
    { id: 'about', label: 'About' },
  ]

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <span style={styles.title}>Options</span>
          <button style={styles.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>

        <div style={styles.tabs}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              style={{
                ...styles.tab,
                ...(activeTab === tab.id ? styles.tabActive : {}),
              }}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={styles.content}>
          {activeTab === 'appearance' && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Theme</h3>
              <div style={styles.themeGrid}>
                {THEMES.map(t => (
                  <button
                    key={t.id}
                    style={{
                      ...styles.themeCard,
                      ...(theme === t.id ? styles.themeCardActive : {}),
                    }}
                    onClick={() => handleThemeChange(t.id)}
                  >
                    <div style={{
                      ...styles.themePreview,
                      background: t.id === '' ? '#1a1a2e'
                        : t.id === 'midnight' ? '#0d0d1a'
                        : t.id === 'forest' ? '#1a2e1a'
                        : '#2e1a1a',
                      border: theme === t.id ? '2px solid var(--game-color)' : '2px solid transparent',
                    }}>
                      <div style={{
                        width: 20, height: 4, borderRadius: 2, marginBottom: 4,
                        background: t.id === '' ? '#16213e'
                          : t.id === 'midnight' ? '#0a0a14'
                          : t.id === 'forest' ? '#162614'
                          : '#261414',
                      }} />
                      <div style={{ width: 28, height: 3, borderRadius: 2, background: 'var(--game-color)', marginBottom: 3 }} />
                      <div style={{ width: 24, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
                    </div>
                    <span style={styles.themeLabel}>{t.label}</span>
                    <span style={styles.themeDesc}>{t.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'map' && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Map Colors</h3>
              <div style={styles.settingRow}>
                <label style={styles.label}>Highlight Fill Color</label>
                <input
                  type="color"
                  value={mapSettings.highlightFill}
                  onChange={e => handleMapSettingChange('highlightFill', e.target.value)}
                  style={styles.colorInput}
                />
              </div>
              <div style={styles.settingRow}>
                <label style={styles.label}>Highlight Fill Opacity</label>
                <div style={styles.sliderRow}>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={mapSettings.highlightFillOpacity}
                    onChange={e => handleMapSettingChange('highlightFillOpacity', parseFloat(e.target.value))}
                    style={styles.slider}
                  />
                  <span style={styles.sliderVal}>{mapSettings.highlightFillOpacity.toFixed(2)}</span>
                </div>
              </div>
              <div style={styles.settingRow}>
                <label style={styles.label}>Highlight Stroke Color</label>
                <input
                  type="color"
                  value={mapSettings.highlightStroke}
                  onChange={e => handleMapSettingChange('highlightStroke', e.target.value)}
                  style={styles.colorInput}
                />
              </div>
              <div style={styles.settingRow}>
                <label style={styles.label}>Quest Marker Color</label>
                <input
                  type="color"
                  value={mapSettings.questMarkerColor}
                  onChange={e => handleMapSettingChange('questMarkerColor', e.target.value)}
                  style={styles.colorInput}
                />
              </div>
              <div style={styles.settingRow}>
                <label style={styles.label}>Quest Marker Opacity</label>
                <div style={styles.sliderRow}>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={mapSettings.questMarkerOpacity}
                    onChange={e => handleMapSettingChange('questMarkerOpacity', parseFloat(e.target.value))}
                    style={styles.slider}
                  />
                  <span style={styles.sliderVal}>{mapSettings.questMarkerOpacity.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Data Storage</h3>
              <p style={styles.para}>
                All app data is stored in a single location:<br />
                <span style={{ display: 'inline-block', marginTop: 6, fontSize: 12, color: '#e2e8f0', background: '#2d2d2d', padding: '3px 8px', borderRadius: 4, fontFamily: 'monospace', border: '1px solid var(--border-color)' }}>
                  %AppData%\PokeGuide
                </span>
              </p>
              <p style={styles.para}>
                This includes your game progress, settings, custom maps, and fetched Pokédex data.
              </p>
              <div style={styles.divider} />
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Folders</div>
                <div style={styles.dataRow}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>App Data Folder</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Settings, progress, map data</div>
                  </div>
                  <button
                    style={styles.actionBtn}
                    onClick={() => window.electronAPI?.openDataFolder()}
                  >
                    Open
                  </button>
                </div>
                <div style={styles.dataRow}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>Pokédex Cache</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>pokemon-data\ — JSON files from PokeAPI</div>
                  </div>
                  <button
                    style={styles.actionBtn}
                    onClick={async () => {
                      if (window.electronAPI) {
                        const dir = await window.electronAPI.getPokemonDataDir()
                        window.electronAPI.openPath(dir)
                      }
                    }}
                  >
                    Open
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'updates' && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Updates</h3>
              <p style={styles.para}>Current version: <strong>1.0.0</strong></p>
              {updateStatus && (
                <div style={styles.updateStatus}>{updateStatus}</div>
              )}
              <button
                style={styles.actionBtn}
                onClick={() => {
                  if (window.electronAPI) {
                    window.electronAPI.checkForUpdates()
                    setUpdateStatus('Checking for updates...')
                  } else {
                    setUpdateStatus('Not available in browser mode.')
                  }
                }}
              >
                Check for Updates
              </button>
              {updateStatus === 'Update available! Click to download.' && (
                <button
                  style={{ ...styles.actionBtn, marginTop: 8, background: 'var(--game-color)' }}
                  onClick={() => window.electronAPI?.startUpdate()}
                >
                  Download Update
                </button>
              )}
              {updateStatus === 'Update downloaded. Restart to apply.' && (
                <button
                  style={{ ...styles.actionBtn, marginTop: 8, background: '#38a169' }}
                  onClick={() => window.electronAPI?.restartApp()}
                >
                  Restart & Apply
                </button>
              )}
            </div>
          )}

          {activeTab === 'about' && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>About PokeGuide</h3>
              <div style={styles.aboutCard}>
                <img
                  src="/app-icon.png"
                  alt="PokeGuide"
                  style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'contain', flexShrink: 0 }}
                  onError={e => { e.target.style.display = 'none' }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>PokeGuide</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Version 1.0.0</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>by R2D2 Games</div>
                </div>
              </div>
              <p style={styles.para}>
                A desktop companion app for Pokemon games. Track your walkthrough progress,
                explore maps, browse the Pokédex, and reference type charts.
              </p>
              <div style={styles.divider} />
              <button
                style={{ ...styles.actionBtn, background: '#e53e3e', marginTop: 16 }}
                onClick={handleResetAll}
              >
                Reset All Settings
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    backdropFilter: 'blur(4px)',
  },
  modal: {
    width: 540,
    maxHeight: '80vh',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-color)',
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    transition: 'background 0.15s, color 0.15s',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid var(--border-color)',
    padding: '0 16px',
  },
  tab: {
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'var(--text-secondary)',
    padding: '10px 14px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  tabActive: {
    color: 'var(--game-color)',
    borderBottom: '2px solid var(--game-color)',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
  },
  section: {},
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  themeGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  themeCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: 12,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    transition: 'all 0.15s',
    textAlign: 'center',
  },
  themeCardActive: {
    border: '1px solid var(--game-color)',
    background: 'var(--bg-hover)',
  },
  themePreview: {
    width: 60,
    height: 40,
    borderRadius: 6,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: 8,
    marginBottom: 4,
  },
  themeLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  themeDesc: {
    fontSize: 11,
    color: 'var(--text-muted)',
  },
  settingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: '1px solid var(--border-color)',
  },
  label: {
    fontSize: 13,
    color: 'var(--text-primary)',
  },
  colorInput: {
    width: 40,
    height: 30,
    padding: 2,
    background: 'transparent',
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    cursor: 'pointer',
  },
  sliderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  slider: {
    width: 120,
    accentColor: 'var(--game-color)',
  },
  sliderVal: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    width: 30,
  },
  para: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    marginBottom: 12,
  },
  updateStatus: {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    borderRadius: 6,
    padding: '8px 12px',
    fontSize: 13,
    color: 'var(--text-primary)',
    marginBottom: 12,
  },
  actionBtn: {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 6,
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },
  aboutCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  aboutLogo: {
    width: 56,
    height: 56,
    borderRadius: 12,
    background: 'var(--game-color)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    fontWeight: 800,
  },
  divider: {
    height: 1,
    background: 'var(--border-color)',
    margin: '16px 0 0',
  },
  dataRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    gap: 12,
  },
}

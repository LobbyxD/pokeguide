import React, { useState, useEffect } from 'react'
import { X } from './Icons.jsx'
import { useDialog } from './Dialog.jsx'
import { saveSettingsToCloud, saveMapSettingsToCloud } from '../utils/cloudSync.js'

const THEMES = [
  { id: '', label: 'Dark', description: 'Classic deep navy dark theme' },
  { id: 'midnight', label: 'Midnight', description: 'Ultra-dark deep space theme' },
  { id: 'forest', label: 'Forest', description: 'Nature-inspired green dark theme' },
  { id: 'crimson', label: 'Crimson', description: 'Rich red-tinted dark theme' },
]

function hexToRgba(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default function OptionsModal({ onClose, onThemeChange, user }) {
  const { confirm } = useDialog()
  const [activeTab, setActiveTab] = useState('appearance')
  const [theme, setTheme] = useState('')
  const [mapSettings, setMapSettings] = useState({
    highlightFill: '#4299e1',
    highlightFillOpacity: 0.3,
    highlightStroke: '#4299e1',
    questMarkerColor: '#f6ad55',
    questMarkerOpacity: 0.9,
  })

  useEffect(() => {
    try {
      const settings = JSON.parse(localStorage.getItem('pg_settings') || '{}')
      setTheme(settings.theme || '')
      const ms = JSON.parse(localStorage.getItem('pg_map_settings') || '{}')
      setMapSettings(prev => ({ ...prev, ...ms }))
    } catch {}
  }, [])

  const handleThemeChange = (t) => {
    setTheme(t)
    onThemeChange(t)
    try {
      const settings = JSON.parse(localStorage.getItem('pg_settings') || '{}')
      settings.theme = t
      localStorage.setItem('pg_settings', JSON.stringify(settings))
      if (user) saveSettingsToCloud(user.id, settings)
    } catch {}
  }

  const handleMapSettingChange = (key, value) => {
    const updated = { ...mapSettings, [key]: value }
    setMapSettings(updated)
    localStorage.setItem('pg_map_settings', JSON.stringify(updated))
    if (user) saveMapSettingsToCloud(user.id, updated)
    if (key === 'questMarkerColor') {
      document.documentElement.style.setProperty('--quest-marker-color', value)
    }
    if (key === 'highlightFill') {
      document.documentElement.style.setProperty('--highlight-fill', hexToRgba(value, updated.highlightFillOpacity))
    }
    if (key === 'highlightFillOpacity') {
      document.documentElement.style.setProperty('--highlight-fill', hexToRgba(updated.highlightFill, value))
    }
    if (key === 'highlightStroke') {
      document.documentElement.style.setProperty('--highlight-stroke', value)
    }
  }

  const handleResetAll = async () => {
    const ok = await confirm('All appearance and map settings will be reset to their defaults.', {
      title: 'Reset All Settings', danger: true, confirmLabel: 'Reset',
    })
    if (ok) {
      const defaultSettings = { theme: '' }
      const defaultMapSettings = { highlightFill: '#4299e1', highlightFillOpacity: 0.3, highlightStroke: '#4299e1', questMarkerColor: '#f6ad55', questMarkerOpacity: 0.9 }
      localStorage.removeItem('pg_settings')
      localStorage.removeItem('pg_map_settings')
      document.body.removeAttribute('data-theme')
      onThemeChange('')
      setTheme('')
      setMapSettings(defaultMapSettings)
      if (user) {
        saveSettingsToCloud(user.id, defaultSettings)
        saveMapSettingsToCloud(user.id, defaultMapSettings)
      }
    }
  }

  const tabs = [
    { id: 'appearance', label: 'Appearance' },
    { id: 'map', label: 'Map' },
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
            <button key={tab.id}
              style={{ ...styles.tab, ...(activeTab === tab.id ? styles.tabActive : {}) }}
              onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>

        <div style={styles.content}>
          {activeTab === 'appearance' && (
            <div>
              <h3 style={styles.sectionTitle}>Theme</h3>
              <div style={styles.themeGrid}>
                {THEMES.map(t => (
                  <button key={t.id}
                    style={{ ...styles.themeCard, ...(theme === t.id ? styles.themeCardActive : {}) }}
                    onClick={() => handleThemeChange(t.id)}>
                    <div style={{
                      ...styles.themePreview,
                      background: t.id === '' ? '#1a1a2e' : t.id === 'midnight' ? '#0d0d1a' : t.id === 'forest' ? '#1a2e1a' : '#2e1a1a',
                      border: theme === t.id ? '2px solid var(--game-color)' : '2px solid transparent',
                    }}>
                      <div style={{ width: 20, height: 4, borderRadius: 2, marginBottom: 4, background: 'rgba(255,255,255,0.1)' }} />
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
            <div>
              <h3 style={styles.sectionTitle}>Map Colors</h3>
              {[
                { key: 'highlightFill', label: 'Highlight Fill Color', type: 'color' },
                { key: 'highlightFillOpacity', label: 'Fill Opacity', type: 'range' },
                { key: 'highlightStroke', label: 'Highlight Stroke Color', type: 'color' },
                { key: 'questMarkerColor', label: 'Quest Marker Color', type: 'color' },
                { key: 'questMarkerOpacity', label: 'Marker Opacity', type: 'range' },
              ].map(({ key, label, type }) => (
                <div key={key} style={styles.settingRow}>
                  <label style={styles.label}>{label}</label>
                  {type === 'color' ? (
                    <input type="color" value={mapSettings[key]}
                      onChange={e => handleMapSettingChange(key, e.target.value)}
                      style={styles.colorInput} />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="range" min="0" max="1" step="0.05"
                        value={mapSettings[key]}
                        onChange={e => handleMapSettingChange(key, parseFloat(e.target.value))}
                        style={{ width: 120, accentColor: 'var(--game-color)' }} />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 30 }}>
                        {mapSettings[key].toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'about' && (
            <div>
              <h3 style={styles.sectionTitle}>About PokeGuide</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <img src="/app-icon.png" alt="PokeGuide"
                  style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'contain' }}
                  onError={e => { e.target.style.display = 'none' }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>PokeGuide</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Web Version</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>by R2D2 Games</div>
                </div>
              </div>
              <p style={styles.para}>
                A companion app for Pokemon games. Track your walkthrough progress, explore maps,
                browse the Pokédex, and reference type charts.
              </p>
              <div style={{ height: 1, background: 'var(--border-color)', margin: '16px 0' }} />
              <button style={{ ...styles.actionBtn, background: '#e53e3e', marginTop: 4 }} onClick={handleResetAll}>
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
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, backdropFilter: 'blur(4px)' },
  modal: { width: 'min(520px, 96vw)', maxHeight: '85vh', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-color)' },
  title: { fontSize: 16, fontWeight: 600 },
  closeBtn: { background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', borderRadius: 4 },
  tabs: { display: 'flex', borderBottom: '1px solid var(--border-color)', padding: '0 16px' },
  tab: { background: 'transparent', border: 'none', borderBottom: '2px solid transparent', color: 'var(--text-secondary)', padding: '10px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  tabActive: { color: 'var(--game-color)', borderBottom: '2px solid var(--game-color)' },
  content: { flex: 1, overflowY: 'auto', padding: '20px' },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  themeGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  themeCard: { background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 12, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' },
  themeCardActive: { border: '1px solid var(--game-color)', background: 'var(--bg-hover)' },
  themePreview: { width: 60, height: 40, borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', padding: 8, marginBottom: 4 },
  themeLabel: { fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' },
  themeDesc: { fontSize: 11, color: 'var(--text-muted)' },
  settingRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)' },
  label: { fontSize: 13, color: 'var(--text-primary)' },
  colorInput: { width: 40, height: 30, padding: 2, background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer' },
  para: { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 },
  actionBtn: { background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500 },
}

import React from 'react'
import ProgressRing from './ProgressRing.jsx'
import { useStorageValue } from '../utils/store.js'

const WalkthroughIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
  </svg>
)
const MapIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
    <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
  </svg>
)
const PokedexIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
  </svg>
)
const TypesIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
)
const ManageIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <line x1="21" y1="12" x2="19" y2="12"/><line x1="5" y1="12" x2="3" y2="12"/>
    <line x1="12" y1="21" x2="12" y2="19"/><line x1="12" y1="5" x2="12" y2="3"/>
    <line x1="18.36" y1="5.64" x2="16.95" y2="7.05"/><line x1="7.05" y1="16.95" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="18.36" x2="16.95" y2="16.95"/><line x1="7.05" y1="7.05" x2="5.64" y2="5.64"/>
  </svg>
)
const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>
    <circle cx="8" cy="6" r="2" fill="currentColor" stroke="none"/>
    <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none"/>
    <circle cx="10" cy="18" r="2" fill="currentColor" stroke="none"/>
  </svg>
)

const NAV_ITEMS = [
  { id: 'walkthrough', label: 'Walkthrough', Icon: WalkthroughIcon, shortcut: '1' },
  { id: 'map', label: 'Map', Icon: MapIcon, shortcut: '2' },
  { id: 'pokedex', label: 'Pokédex', Icon: PokedexIcon, shortcut: '3' },
  { id: 'types', label: 'Type Chart', Icon: TypesIcon, shortcut: '4' },
  { id: 'manage', label: 'Manage', Icon: ManageIcon, shortcut: '5' },
]

export default function Sidebar({ games, selectedGame, onSelectGame, activeView, onNavigate, onOpenOptions }) {
  const rawStep = useStorageValue(selectedGame ? `pg_step_progress_${selectedGame.id}` : null, '0')
  const progress = (() => {
    if (!selectedGame?.steps?.length) return 0
    const idx = parseInt(rawStep || '0')
    return Math.round((idx / selectedGame.steps.length) * 100)
  })()

  return (
    <div style={styles.sidebar}>
      <div style={styles.gameHeader}>
        {selectedGame && (
          <div style={styles.activeGame}>
            <ProgressRing percent={progress} size={48} strokeWidth={3} />
            <div style={styles.gameInfo}>
              <div style={styles.gameName} title={selectedGame.title}>{selectedGame.title}</div>
              <div style={styles.gameRegion}>{selectedGame.region} · {progress}%</div>
            </div>
          </div>
        )}
      </div>

      <div style={styles.gameList}>
        {games.map(game => {
          const isActive = selectedGame?.id === game.id
          return (
            <button
              key={game.id}
              style={{
                ...styles.gameItem,
                ...(isActive ? { background: game.color + '18', borderLeftColor: game.color, color: 'var(--text-primary)' } : {}),
              }}
              onClick={() => onSelectGame(game)}
              title={game.title}
            >
              <span style={{ ...styles.gameColorDot, background: game.color }} />
              <span style={styles.gameItemLabel}>{game.title}</span>
            </button>
          )
        })}
      </div>

      <div style={styles.divider} />

      <nav style={styles.nav}>
        {NAV_ITEMS.map(({ id, label, Icon, shortcut }) => {
          const isActive = activeView === id
          return (
            <button
              key={id}
              style={{
                ...styles.navItem,
                ...(isActive ? {
                  background: (selectedGame?.color || '#4299e1') + '18',
                  color: selectedGame?.color || '#4299e1',
                  borderLeftColor: selectedGame?.color || '#4299e1',
                } : {}),
              }}
              onClick={() => onNavigate(id)}
              title={`${label} (${shortcut})`}
            >
              <span style={styles.navIcon}><Icon /></span>
              <span style={styles.navLabel}>{label}</span>
              <span style={styles.navShortcut}>{shortcut}</span>
            </button>
          )
        })}
      </nav>

      <div style={styles.spacer} />

      <button style={styles.optionsBtn} onClick={onOpenOptions} title="Options (Ctrl+,)">
        <span style={styles.navIcon}><SettingsIcon /></span>
        <span style={{ flex: 1, textAlign: 'left' }}>Options</span>
        <span style={styles.navShortcut}>Ctrl+,</span>
      </button>
    </div>
  )
}

const styles = {
  sidebar: { width: 'var(--sidebar-width)', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 },
  gameHeader: { padding: '12px 12px 10px', borderBottom: '1px solid var(--border-color)' },
  activeGame: { display: 'flex', alignItems: 'center', gap: 10 },
  gameInfo: { flex: 1, overflow: 'hidden' },
  gameName: { fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  gameRegion: { fontSize: 11, color: 'var(--text-muted)', marginTop: 1 },
  gameList: { display: 'flex', flexDirection: 'column', padding: '4px 0', borderBottom: '1px solid var(--border-color)' },
  gameItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'transparent', color: 'var(--text-secondary)', textAlign: 'left', fontSize: 12, cursor: 'pointer', transition: 'background 0.15s, color 0.15s', border: 'none', borderLeft: '3px solid transparent', width: '100%', fontWeight: 500 },
  gameColorDot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  gameItemLabel: { flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  divider: { height: 1, background: 'var(--border-color)' },
  nav: { display: 'flex', flexDirection: 'column', padding: '4px 0' },
  navItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'background 0.15s, color 0.15s', border: 'none', borderLeft: '3px solid transparent', fontSize: 13, textAlign: 'left', width: '100%', fontWeight: 500 },
  navIcon: { width: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  navLabel: { flex: 1 },
  navShortcut: { fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: 4, fontFamily: 'monospace', border: '1px solid var(--border-color)' },
  spacer: { flex: 1 },
  optionsBtn: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', transition: 'background 0.15s, color 0.15s', border: 'none', borderTop: '1px solid var(--border-color)', borderLeft: '3px solid transparent', fontSize: 13, width: '100%' },
}

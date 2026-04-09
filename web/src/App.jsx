import React, { useState, useEffect, useCallback, useRef } from 'react'
import { DialogProvider } from './components/Dialog.jsx'
import Sidebar, { NAV_ITEMS } from './components/Sidebar.jsx'
import OptionsModal from './components/OptionsModal.jsx'
import AuthPage from './components/AuthPage.jsx'
import WalkthroughView from './views/WalkthroughView.jsx'
import MapView from './views/MapView.jsx'
import PokedexView from './views/PokedexView.jsx'
import TypeChartView from './views/TypeChartView.jsx'
import ManageView from './views/ManageView.jsx'
import { Menu, X, LogOut, User } from './components/Icons.jsx'
import WelcomeScreen from './components/WelcomeScreen.jsx'
import { onAuthChange, signOutUser } from './firebase.js'
import { loadUserData, saveGamesToCloud, saveProgressToCloud, saveSettingsToCloud, saveUserProfile } from './utils/cloudSync.js'
import { idbGetGames, idbSetGames, idbSetMap, idbSet } from './utils/idb.js'

export default function App() {
  const [user, setUser] = useState(undefined) // undefined = loading, null = signed out
  const [activeView, setActiveView] = useState('walkthrough')
  const [selectedGame, setSelectedGame] = useState(null)
  const [games, setGames] = useState([])
  const [showOptions, setShowOptions] = useState(false)
  const [fetchKey, setFetchKey] = useState(0)
  const [pokedexInitialSearch, setPokedexInitialSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [syncingGames, setSyncingGames] = useState(false)
  const [manageOpenPresets, setManageOpenPresets] = useState(false)

  // ── Auth state ──────────────────────────────────────────────
  useEffect(() => {
    return onAuthChange(async (u) => {
      setUser(u)
      if (u) {
        // Save profile (no-op for Supabase — stored in auth.user_metadata)
        await saveUserProfile(u.id, {})
        // Load user data from Supabase into IDB/localStorage
        await loadUserData(u.id)
        // Now read games from IDB
        try {
          const loadedGames = (await idbGetGames()) || []
          setGames(loadedGames)
          setSelectedGame(loadedGames[0] || null)
        } catch {
          setGames([])
          setSelectedGame(null)
        }
      } else if (u === null) {
        // Signed out — clear local state
        setGames([])
        setSelectedGame(null)
      }
    })
  }, [])

  // ── Apply game color ────────────────────────────────────────
  useEffect(() => {
    if (selectedGame) {
      document.documentElement.style.setProperty('--game-color', selectedGame.color)
      document.documentElement.style.setProperty('--accent', selectedGame.color)
    }
  }, [selectedGame])

  // ── Apply saved theme ───────────────────────────────────────
  useEffect(() => {
    try {
      const settings = JSON.parse(localStorage.getItem('pg_settings') || '{}')
      if (settings.theme) document.body.setAttribute('data-theme', settings.theme)
    } catch {}
  }, [])

  // ── Apply map settings CSS vars ─────────────────────────────
  useEffect(() => {
    try {
      const ms = JSON.parse(localStorage.getItem('pg_map_settings') || '{}')
      if (ms.questMarkerColor) document.documentElement.style.setProperty('--quest-marker-color', ms.questMarkerColor)
      if (ms.highlightFill) document.documentElement.style.setProperty('--highlight-fill', ms.highlightFill)
      if (ms.highlightStroke) document.documentElement.style.setProperty('--highlight-stroke', ms.highlightStroke)
    } catch {}
  }, [showOptions])

  // ── Navigation ──────────────────────────────────────────────
  const navigate = useCallback((view) => setActiveView(view), [])

  // ── Keyboard shortcuts ──────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === '1') navigate('walkthrough')
      else if (e.key === '2') navigate('map')
      else if (e.key === '3') navigate('pokedex')
      else if (e.key === '4') navigate('types')
      else if (e.key === '5') navigate('manage')
      else if (e.key === ',' && e.ctrlKey) { e.preventDefault(); setShowOptions(true) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])

  // ── Save games + sync to cloud ──────────────────────────────
  const handleSaveGames = useCallback(async (newGames) => {
    setGames(newGames)
    await idbSetGames(newGames)
    if (selectedGame) {
      const updated = newGames.find(g => g.id === selectedGame.id)
      if (!updated) setSelectedGame(newGames.length > 0 ? newGames[0] : null)
      else if (updated.color !== selectedGame.color) setSelectedGame(updated)
    } else if (newGames.length > 0) {
      setSelectedGame(newGames[0])
    }
    // Sync to cloud
    if (user) {
      setSyncingGames(true)
      await saveGamesToCloud(user.id, newGames).finally(() => setSyncingGames(false))
    }
  }, [selectedGame, user])

  const handleSelectGame = useCallback((game) => {
    setSelectedGame(game)
    setFetchKey(k => k + 1)
  }, [])

  const handleNavigateToPokemon = useCallback((pokemonName) => {
    setPokedexInitialSearch(pokemonName)
    navigate('pokedex')
  }, [navigate])

  const handleLoadPreset = useCallback(async (preset) => {
    const id = `custom-game-${Date.now()}`
    const GAME_TEMPLATE = { id: '', title: 'New Game', region: 'Kanto', generation: 1, color: '#e53e3e', pokedexFile: '', versionSlug: '', steps: [] }
    const gameData = { ...GAME_TEMPLATE, ...preset.game, id }
    // Steps may live in preset.steps (desktop/official format) or already in preset.game
    if (preset.steps) {
      gameData.steps = preset.steps.steps || []
      gameData.stepLocs = preset.steps.stepLocs || {}
    }
    const newGames = [...games, gameData]
    await handleSaveGames(newGames)
    if (preset.map) await idbSetMap(id, preset.map)
    if (preset.pokedex && gameData.pokedexFile) {
      await idbSet(id, preset.pokedex)
      localStorage.removeItem(`pg_pokedex_${id}`)
    }
    handleSelectGame(gameData)
    navigate('walkthrough')
  }, [games, handleSaveGames, handleSelectGame, navigate])

  const handleSignOut = async () => {
    localStorage.clear()
    await signOutUser()
  }

  // ── Loading state ───────────────────────────────────────────
  if (user === undefined) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--border-color)', borderTop: '3px solid var(--game-color)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          Loading...
        </div>
      </div>
    )
  }

  // ── Not signed in → landing page ───────────────────────────
  if (!user) {
    return (
      <DialogProvider>
        <AuthPage />
      </DialogProvider>
    )
  }

  // ── Main app ────────────────────────────────────────────────
  const renderView = () => {
    // Always allow Manage view — it handles the empty-game state itself
    if (activeView === 'manage') {
      return <ManageView games={games} selectedGame={selectedGame} onSaveGames={handleSaveGames} onSelectGame={handleSelectGame}
        openPresets={manageOpenPresets} onOpenPresetsConsumed={() => setManageOpenPresets(false)} />
    }

    if (!selectedGame) return (
      <WelcomeScreen
        onLoadPreset={handleLoadPreset}
        onBuildOwn={() => navigate('manage')}
      />
    )

    switch (activeView) {
      case 'walkthrough':
        return <WalkthroughView game={selectedGame} games={games} onSaveGames={handleSaveGames} user={user} />
      case 'map':
        return <MapView game={selectedGame} onNavigateToPokemon={handleNavigateToPokemon} />
      case 'pokedex':
        return <PokedexView game={selectedGame} fetchKey={fetchKey}
          initialSearch={pokedexInitialSearch} onInitialSearchConsumed={() => setPokedexInitialSearch('')} />
      case 'types':
        return <TypeChartView />
      default:
        return null
    }
  }

  return (
    <DialogProvider>
      <div className="app-layout">
        {/* ── Top bar (visible on all sizes) ── */}
        <header className="app-topbar">
          {/* Hamburger — mobile only */}
          <button className="hamburger-btn" style={topbarStyles.hamburger}
            onClick={() => setSidebarOpen(o => !o)} aria-label="Menu">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Logo */}
          <img src="/app-icon.png" alt="PokeGuide" style={topbarStyles.logo}
            onError={e => { e.target.style.display = 'none' }} />
          <span style={topbarStyles.appName}>PokeGuide</span>

          {syncingGames && (
            <span style={topbarStyles.syncDot} title="Saving to cloud..." />
          )}

          <div style={{ flex: 1 }} />

          {/* User info + sign out */}
          <div style={topbarStyles.userRow}>
            {user.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt={user.user_metadata?.full_name || ''} style={topbarStyles.avatar} />
            ) : (
              <div style={topbarStyles.avatarFallback}><User size={14} /></div>
            )}
            <span style={topbarStyles.userName}>{user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'User'}</span>
            <button style={topbarStyles.signOutBtn} onClick={handleSignOut} title="Sign out">
              <LogOut size={14} />
            </button>
          </div>
        </header>

        {/* ── Sidebar backdrop (mobile) ── */}
        <div className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
          onClick={() => setSidebarOpen(false)} />

        {/* ── Body ── */}
        <div className="app-body">
          {/* ── Sidebar ── */}
          <div className={`app-sidebar ${sidebarOpen ? 'open' : ''}`}>
            <Sidebar
              games={games}
              selectedGame={selectedGame}
              onSelectGame={handleSelectGame}
              activeView={activeView}
              onNavigate={navigate}
              onOpenOptions={() => setShowOptions(true)}
              onClose={() => setSidebarOpen(false)}
            />
          </div>

          {/* ── Main content ── */}
          <main className="app-content">
            {renderView()}
          </main>
        </div>

        {/* ── Mobile bottom nav ── */}
        <nav className="mobile-nav">
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <button key={id} className={`mobile-nav-btn ${activeView === id ? 'active' : ''}`}
              onClick={() => { navigate(id); setSidebarOpen(false) }}
              style={{ color: activeView === id ? (selectedGame?.color || 'var(--game-color)') : undefined }}>
              <Icon size={20} />
              <span style={{ fontSize: 10 }}>{label}</span>
            </button>
          ))}
        </nav>

        {/* ── Options modal ── */}
        {showOptions && (
          <OptionsModal
            onClose={() => setShowOptions(false)}
            onThemeChange={(theme) => {
              if (theme) document.body.setAttribute('data-theme', theme)
              else document.body.removeAttribute('data-theme')
              if (user) {
                try {
                  const settings = JSON.parse(localStorage.getItem('pg_settings') || '{}')
                  saveSettingsToCloud(user.id, settings)
                } catch {}
              }
            }}
          />
        )}
      </div>
    </DialogProvider>
  )
}

const topbarStyles = {
  hamburger: {
    background: 'transparent', border: 'none', color: 'var(--text-secondary)',
    cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center',
    borderRadius: 6,
  },
  logo: { width: 28, height: 28, imageRendering: 'pixelated', flexShrink: 0 },
  appName: { fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' },
  syncDot: {
    width: 8, height: 8, borderRadius: '50%',
    background: 'var(--game-color)', animation: 'pulse 1s infinite',
  },
  userRow: { display: 'flex', alignItems: 'center', gap: 8 },
  avatar: { width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' },
  avatarFallback: {
    width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-tertiary)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)',
  },
  userName: { fontSize: 12, color: 'var(--text-secondary)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  signOutBtn: {
    background: 'transparent', border: 'none', color: 'var(--text-muted)',
    cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center',
    borderRadius: 4, transition: 'color 0.15s',
  },
}


import React, { useState, useEffect, useCallback, useRef } from 'react'
import { DialogProvider } from './components/Dialog.jsx'
import Sidebar, { NAV_ITEMS, MOBILE_NAV_ITEMS } from './components/Sidebar.jsx'
import OptionsModal from './components/OptionsModal.jsx'
import AuthPage from './components/AuthPage.jsx'
import WalkthroughView from './views/WalkthroughView.jsx'
import MapView from './views/MapView.jsx'
import PokedexView from './views/PokedexView.jsx'
import TypeChartView from './views/TypeChartView.jsx'
import ManageView from './views/ManageView.jsx'
import { Menu, X, LogOut, User } from './components/Icons.jsx'

const GamesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2"/>
    <line x1="12" y1="10" x2="12" y2="14"/><line x1="10" y1="12" x2="14" y2="12"/>
    <circle cx="7" cy="12" r="1" fill="currentColor" stroke="none"/>
  </svg>
)
import WelcomeScreen from './components/WelcomeScreen.jsx'
import { onAuthChange, signOutUser } from './firebase.js'
import { loadUserData, saveGamesToCloud, saveMapToCloud, pushLocalDataToCloud, saveUserProfile } from './utils/cloudSync.js'
import { idbGetGames, idbSetGames, idbSetMap, idbSet, idbClearAll } from './utils/idb.js'
import { mapData as defaultMapData } from './data/index.js'
import { generatePokedex, hasPokedexData } from './utils/pokedex.js'

// Remove only app data — preserve Supabase's sb-* auth keys so the session survives a refresh
function clearAppLocalStorage() {
  const toRemove = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key.startsWith('sb-')) toRemove.push(key)
  }
  toRemove.forEach(k => localStorage.removeItem(k))
}

export default function App() {
  const [user, setUser] = useState(undefined) // undefined = loading, null = signed out
  const [dataLoading, setDataLoading] = useState(true)
  const [activeView, setActiveView] = useState(() => {
    const saved = localStorage.getItem('pg_last_view')
    const valid = ['walkthrough', 'map', 'pokedex', 'types', 'manage']
    return valid.includes(saved) ? saved : 'walkthrough'
  })
  const [selectedGame, setSelectedGame] = useState(null)
  const [games, setGames] = useState([])
  const [showOptions, setShowOptions] = useState(false)
  const [fetchKey, setFetchKey] = useState(0)
  const [pokedexInitialSearch, setPokedexInitialSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [syncingGames, setSyncingGames] = useState(false)
  const [manageOpenPresets, setManageOpenPresets] = useState(false)
  // pokedexGen: null | { gameId, gameName, current, total }
  const [pokedexGen, setPokedexGen] = useState(null)
  const currentUserIdRef = useRef(undefined)

  // ── Auth state ──────────────────────────────────────────────
  useEffect(() => {
    return onAuthChange(async (u) => {
      const newId = u?.id ?? null
      const prevId = currentUserIdRef.current

      // Skip if the user hasn't actually changed (e.g. TOKEN_REFRESHED, same session refresh)
      if (newId === prevId) return
      currentUserIdRef.current = newId

      setUser(u)
      if (u) {
        setDataLoading(true)
        // Only wipe local data when switching to a *different* account.
        // On a same-browser refresh prevId is undefined → don't wipe, we'll merge from cloud.
        const switchingAccounts = prevId !== undefined && prevId !== null && prevId !== newId
        if (switchingAccounts) {
          await idbClearAll()
          clearAppLocalStorage()
        }

        // Load from Supabase — if a row exists it overwrites local, if not we keep what's local
        await loadUserData(u.id)

        // Read games from IDB (may be from cloud restore or pre-existing local data)
        let loadedGames = []
        try {
          loadedGames = (await idbGetGames()) || []
          setGames(loadedGames)
          setSelectedGame(loadedGames[0] || null)
        } catch {
          setGames([])
          setSelectedGame(null)
        }

        setDataLoading(false)

        // If cloud has no data yet, push all local data up so it's persisted
        pushLocalDataToCloud(u.id, loadedGames, defaultMapData)

        // Auto-generate Pokédex for any game that has pokedexFile but no cached data
        for (const game of loadedGames) {
          if (!game.pokedexFile) continue
          const alreadyHas = await hasPokedexData(game)
          if (alreadyHas) continue
          const total = game.totalPokemon || 151
          setPokedexGen({ gameId: game.id, gameName: game.title, current: 0, total })
          await generatePokedex(game, (current, total) => {
            setPokedexGen({ gameId: game.id, gameName: game.title, current, total })
          })
          setPokedexGen(null)
          setFetchKey(k => k + 1) // tell PokedexView to reload now that data exists
        }
      } else if (u === null) {
        // Signed out — clear everything
        await idbClearAll()
        clearAppLocalStorage()
        setGames([])
        setSelectedGame(null)
        setDataLoading(false)
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
  const navigate = useCallback((view) => {
    setActiveView(view)
    localStorage.setItem('pg_last_view', view)
  }, [])

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
    if (preset.map) {
      await idbSetMap(id, preset.map)
      if (user) saveMapToCloud(user.id, id, preset.map)
    }
    if (preset.pokedex && gameData.pokedexFile) {
      await idbSet(id, preset.pokedex)
      localStorage.removeItem(`pg_pokedex_${id}`)
    }
    handleSelectGame(gameData)
    navigate('walkthrough')
  }, [games, handleSaveGames, handleSelectGame, navigate, user])

  const handleSignOut = async () => {
    await signOutUser()
    // onAuthChange(null) will fire and clear IDB + localStorage
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
    if (dataLoading) return <AppSkeleton />

    // Always allow Manage view — it handles the empty-game state itself
    if (activeView === 'manage') {
      return <ManageView games={games} selectedGame={selectedGame} onSaveGames={handleSaveGames} onSelectGame={handleSelectGame}
        openPresets={manageOpenPresets} onOpenPresetsConsumed={() => setManageOpenPresets(false)} user={user} />
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
        return <MapView game={selectedGame} onNavigateToPokemon={handleNavigateToPokemon} user={user} />
      case 'pokedex':
        return <PokedexView game={selectedGame} fetchKey={fetchKey}
          initialSearch={pokedexInitialSearch} onInitialSearchConsumed={() => setPokedexInitialSearch('')}
          autoGen={pokedexGen?.gameId === selectedGame?.id ? pokedexGen : null} />
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
          {MOBILE_NAV_ITEMS.map(({ id, label, Icon }) => (
            <button key={id} className={`mobile-nav-btn ${activeView === id ? 'active' : ''}`}
              onClick={() => { navigate(id); setSidebarOpen(false) }}
              style={{ color: activeView === id ? (selectedGame?.color || 'var(--game-color)') : undefined }}>
              <Icon size={20} />
              <span style={{ fontSize: 10 }}>{label}</span>
            </button>
          ))}
          {/* Games button — opens sidebar where game switcher + Manage live */}
          <button className={`mobile-nav-btn ${sidebarOpen ? 'active' : ''}`}
            onClick={() => setSidebarOpen(o => !o)}
            style={{ color: sidebarOpen ? (selectedGame?.color || 'var(--game-color)') : undefined }}>
            <GamesIcon />
            <span style={{ fontSize: 10 }}>Games</span>
          </button>
        </nav>

        {/* ── Options modal ── */}
        {showOptions && (
          <OptionsModal
            onClose={() => setShowOptions(false)}
            user={user}
            onThemeChange={(theme) => {
              if (theme) document.body.setAttribute('data-theme', theme)
              else document.body.removeAttribute('data-theme')
            }}
          />
        )}

        {/* ── Pokédex generation toast ── */}
        {pokedexGen && <PokedexToast toast={pokedexGen} />}
      </div>
    </DialogProvider>
  )
}

function PokedexToast({ toast }) {
  const pct = toast.total > 0 ? Math.round((toast.current / toast.total) * 100) : 0
  return (
    <div style={{
      position: 'fixed', bottom: 80, right: 20, zIndex: 99999,
      background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
      borderRadius: 12, padding: '12px 16px', width: 260,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'var(--game-color)', animation: 'pulse 1s infinite', flexShrink: 0,
        }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
          Building Pokédex
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          {pct}%
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
        {toast.gameName} · {toast.current} / {toast.total} Pokémon
      </div>
      <div style={{ height: 4, background: 'var(--bg-tertiary)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', background: 'var(--game-color)', borderRadius: 2,
          width: `${pct}%`, transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  )
}

function AppSkeleton() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -600px 0 }
          100% { background-position: 600px 0 }
        }
        .skel {
          background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-tertiary) 50%, var(--bg-secondary) 75%);
          background-size: 600px 100%;
          animation: shimmer 1.4s infinite linear;
          border-radius: 6px;
        }
      `}</style>
      {/* Fake sidebar + content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar skeleton */}
        <div style={{ width: 220, flexShrink: 0, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="skel" style={{ height: 14, width: '60%' }} />
          {[1,2,3].map(i => (
            <div key={i} style={{ borderRadius: 8, padding: '10px 12px', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="skel" style={{ height: 13, width: '80%' }} />
              <div className="skel" style={{ height: 10, width: '50%' }} />
            </div>
          ))}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px' }}>
                <div className="skel" style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0 }} />
                <div className="skel" style={{ height: 12, flex: 1 }} />
              </div>
            ))}
          </div>
        </div>
        {/* Main content skeleton */}
        <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="skel" style={{ height: 28, width: 200 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} className="skel" style={{ height: 52, width: '100%', borderRadius: 8 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
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


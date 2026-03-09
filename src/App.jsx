import React, { useState, useEffect, useCallback, useRef } from 'react'
import { DialogProvider } from './components/Dialog.jsx'
import TitleBar from './components/TitleBar.jsx'
import Sidebar from './components/Sidebar.jsx'
import OptionsModal from './components/OptionsModal.jsx'
import WalkthroughView from './views/WalkthroughView.jsx'
import MapView from './views/MapView.jsx'
import PokedexView from './views/PokedexView.jsx'
import TypeChartView from './views/TypeChartView.jsx'
import ManageView from './views/ManageView.jsx'
import { defaultGames } from './data/index.js'

const VIEWS = ['walkthrough', 'map', 'pokedex', 'types', 'manage']

export default function App() {
  const [activeView, setActiveView] = useState('walkthrough')
  const [selectedGame, setSelectedGame] = useState(null)
  const [games, setGames] = useState([])
  const [showOptions, setShowOptions] = useState(false)
  const [fetchKey, setFetchKey] = useState(0)
  const [pokedexInitialSearch, setPokedexInitialSearch] = useState('')
  const [updateInfo, setUpdateInfo] = useState(null)      // { version } when update available
  const [updateProgress, setUpdateProgress] = useState(null) // 0-100 while downloading

  const historyRef = useRef([])
  const historyIndexRef = useRef(-1)
  const navigatingRef = useRef(false)

  // Load games from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pg_games')
      const loadedGames = stored ? JSON.parse(stored) : defaultGames
      setGames(loadedGames)
      setSelectedGame(loadedGames[0])
    } catch {
      setGames(defaultGames)
      setSelectedGame(defaultGames[0])
    }
  }, [])

  // Apply game color
  useEffect(() => {
    if (selectedGame) {
      document.documentElement.style.setProperty('--game-color', selectedGame.color)
      document.documentElement.style.setProperty('--accent', selectedGame.color)
    }
  }, [selectedGame])

  // Auto-updater listeners
  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.onUpdateAvailable((info) => setUpdateInfo(info))
    window.electronAPI.onUpdateProgress((p) => setUpdateProgress(Math.round(p.percent)))
    // Catch updates that fired before React mounted (race condition on startup)
    window.electronAPI.getPendingUpdate().then((info) => {
      if (info) setUpdateInfo(info)
    })
  }, [])

  // Apply saved theme
  useEffect(() => {
    try {
      const settings = JSON.parse(localStorage.getItem('pg_settings') || '{}')
      if (settings.theme) {
        document.body.setAttribute('data-theme', settings.theme)
      }
    } catch {}
  }, [])

  // Apply map settings CSS vars
  useEffect(() => {
    try {
      const mapSettings = JSON.parse(localStorage.getItem('pg_map_settings') || '{}')
      if (mapSettings.questMarkerColor) {
        document.documentElement.style.setProperty('--quest-marker-color', mapSettings.questMarkerColor)
      }
      if (mapSettings.highlightFill) {
        document.documentElement.style.setProperty('--highlight-fill', mapSettings.highlightFill)
      }
      if (mapSettings.highlightStroke) {
        document.documentElement.style.setProperty('--highlight-stroke', mapSettings.highlightStroke)
      }
    } catch {}
  }, [showOptions])

  const navigate = useCallback((view) => {
    if (navigatingRef.current) return
    setActiveView(view)
    // Push to history
    const hist = historyRef.current
    const idx = historyIndexRef.current
    // Truncate forward history
    historyRef.current = hist.slice(0, idx + 1)
    historyRef.current.push(view)
    historyIndexRef.current = historyRef.current.length - 1
  }, [])

  const goBack = useCallback(() => {
    if (historyIndexRef.current > 0) {
      navigatingRef.current = true
      historyIndexRef.current--
      setActiveView(historyRef.current[historyIndexRef.current])
      setTimeout(() => { navigatingRef.current = false }, 100)
    }
  }, [])

  const goForward = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      navigatingRef.current = true
      historyIndexRef.current++
      setActiveView(historyRef.current[historyIndexRef.current])
      setTimeout(() => { navigatingRef.current = false }, 100)
    }
  }, [])

  // Initialize history
  useEffect(() => {
    historyRef.current = ['walkthrough']
    historyIndexRef.current = 0
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (e.key === '1') navigate('walkthrough')
      else if (e.key === '2') navigate('map')
      else if (e.key === '3') navigate('pokedex')
      else if (e.key === '4') navigate('types')
      else if (e.key === '5') navigate('manage')
      else if (e.key === ',' && e.ctrlKey) {
        e.preventDefault()
        setShowOptions(true)
      }
      else if (e.altKey && e.key === 'ArrowLeft') goBack()
      else if (e.altKey && e.key === 'ArrowRight') goForward()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, goBack, goForward])

  // Mouse button navigation (buttons 3/4)
  useEffect(() => {
    const handler = (e) => {
      if (e.button === 3) goBack()
      else if (e.button === 4) goForward()
    }
    window.addEventListener('mouseup', handler)
    return () => window.removeEventListener('mouseup', handler)
  }, [goBack, goForward])

  const handleSaveGames = (newGames) => {
    setGames(newGames)
    localStorage.setItem('pg_games', JSON.stringify(newGames))
    // Only update selectedGame if it was removed or its color changed (avoid unnecessary re-renders while editing)
    if (selectedGame) {
      const updated = newGames.find(g => g.id === selectedGame.id)
      if (!updated) {
        setSelectedGame(newGames.length > 0 ? newGames[0] : null)
      } else if (updated.color !== selectedGame.color) {
        setSelectedGame(updated)
      }
    } else if (newGames.length > 0) {
      setSelectedGame(newGames[0])
    }
  }

  const handleSelectGame = (game) => {
    setSelectedGame(game)
    setFetchKey(k => k + 1)
  }

  const handleNavigateToPokemon = (pokemonName) => {
    setPokedexInitialSearch(pokemonName)
    navigate('pokedex')
  }

  const renderView = () => {
    if (!selectedGame) return null
    switch (activeView) {
      case 'walkthrough':
        return <WalkthroughView game={selectedGame} games={games} onSaveGames={handleSaveGames} />
      case 'map':
        return <MapView game={selectedGame} onNavigateToPokemon={handleNavigateToPokemon} />
      case 'pokedex':
        return <PokedexView game={selectedGame} fetchKey={fetchKey} initialSearch={pokedexInitialSearch} onInitialSearchConsumed={() => setPokedexInitialSearch('')} />
      case 'types':
        return <TypeChartView />
      case 'manage':
        return <ManageView games={games} selectedGame={selectedGame} onSaveGames={handleSaveGames} onSelectGame={handleSelectGame} />
      default:
        return null
    }
  }

  return (
    <DialogProvider>
    <div className="app-layout">
      <TitleBar />
      <div className="app-body">
        <Sidebar
          games={games}
          selectedGame={selectedGame}
          onSelectGame={handleSelectGame}
          activeView={activeView}
          onNavigate={navigate}
          onOpenOptions={() => setShowOptions(true)}
        />
        <main className="app-content">
          {renderView()}
        </main>
      </div>
      {showOptions && (
        <OptionsModal
          onClose={() => setShowOptions(false)}
          onThemeChange={(theme) => {
            if (theme) {
              document.body.setAttribute('data-theme', theme)
            } else {
              document.body.removeAttribute('data-theme')
            }
          }}
        />
      )}

      {updateInfo && (
        <div style={updateStyles.overlay}>
          <div style={updateStyles.modal}>
            <div style={updateStyles.icon}>↑</div>
            {updateProgress === null ? (
              <>
                <div style={updateStyles.title}>Update Available</div>
                <div style={updateStyles.sub}>Version {updateInfo.version} is ready to install.</div>
                <div style={updateStyles.sub2}>The app will restart automatically when done.</div>
                <div style={updateStyles.actions}>
                  <button
                    style={updateStyles.btnPrimary}
                    onClick={() => {
                      setUpdateProgress(0)
                      window.electronAPI.startUpdate()
                    }}
                  >
                    Update Now
                  </button>
                  <button style={updateStyles.btnSecondary} onClick={() => setUpdateInfo(null)}>
                    Later
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={updateStyles.title}>Downloading Update...</div>
                <div style={updateStyles.progressBar}>
                  <div style={{ ...updateStyles.progressFill, width: `${updateProgress}%` }} />
                </div>
                <div style={updateStyles.progressLabel}>{updateProgress}%</div>
                <div style={updateStyles.sub2}>The app will restart automatically when done.</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
    </DialogProvider>
  )
}

const updateStyles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    backdropFilter: 'blur(4px)',
  },
  modal: {
    width: 340,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 14,
    padding: '28px 28px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'var(--game-color)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    fontWeight: 800,
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: 700,
    marginBottom: 8,
    color: 'var(--text-primary)',
  },
  sub: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    marginBottom: 4,
  },
  sub2: {
    fontSize: 12,
    color: 'var(--text-muted)',
    marginTop: 8,
  },
  actions: {
    display: 'flex',
    gap: 10,
    marginTop: 20,
    width: '100%',
  },
  btnPrimary: {
    flex: 1,
    background: 'var(--game-color)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 0',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnSecondary: {
    flex: 1,
    background: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '10px 0',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  },
  progressBar: {
    width: '100%',
    height: 6,
    background: 'var(--bg-tertiary)',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 16,
  },
  progressFill: {
    height: '100%',
    background: 'var(--game-color)',
    borderRadius: 3,
    transition: 'width 0.3s ease',
  },
  progressLabel: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    marginTop: 8,
    fontWeight: 600,
  },
}

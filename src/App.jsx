import React, { useState, useEffect, useCallback, useRef } from 'react'
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
    // Update selectedGame if it was modified
    if (selectedGame) {
      const updated = newGames.find(g => g.id === selectedGame.id)
      if (updated) setSelectedGame(updated)
      else if (newGames.length > 0) setSelectedGame(newGames[0])
      else setSelectedGame(null)
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
    </div>
  )
}

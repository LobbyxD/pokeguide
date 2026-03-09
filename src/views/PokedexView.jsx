import React, { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from '../components/Icons.jsx'
import { writeStorage, removeStorage } from '../utils/store.js'
import TypeBadge, { TYPE_COLORS } from '../components/TypeBadge.jsx'

const ALL_TYPES = Object.keys(TYPE_COLORS)

const STAT_COLORS = {
  hp: '#e53e3e', attack: '#dd6b20', defense: '#d69e2e',
  special_attack: '#3182ce', special_defense: '#2b6cb0', speed: '#38a169',
}

const STAT_LABELS = {
  hp: 'HP', attack: 'Atk', defense: 'Def',
  special_attack: 'SpAtk', special_defense: 'SpDef', speed: 'Speed',
}

function TypePill({ type }) {
  return <TypeBadge type={type} height={18} />
}

function SkeletonCard() {
  return (
    <div style={styles.card}>
      <div style={{ width: 64, height: 64, background: 'var(--bg-tertiary)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
      <div style={{ width: 40, height: 10, background: 'var(--bg-tertiary)', borderRadius: 4, marginTop: 4 }} />
      <div style={{ width: 70, height: 12, background: 'var(--bg-tertiary)', borderRadius: 4 }} />
    </div>
  )
}

// Custom in-app confirmation dialog
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div style={styles.dialogOverlay}>
      <div style={styles.dialog}>
        <div style={styles.dialogIcon}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f6ad55" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <div style={styles.dialogTitle}>Regenerate Pokédex?</div>
        <div style={styles.dialogMsg}>{message}</div>
        <div style={styles.dialogBtns}>
          <button style={styles.dialogCancel} onClick={onCancel}>Cancel</button>
          <button style={styles.dialogConfirm} onClick={onConfirm}>Regenerate</button>
        </div>
      </div>
    </div>
  )
}

export default function PokedexView({ game, fetchKey, initialSearch, onInitialSearchConsumed }) {
  const [pokemon, setPokemon] = useState([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genProgress, setGenProgress] = useState({ current: 0, total: 0 })
  const [search, setSearch] = useState('')
  const [typeFilters, setTypeFilters] = useState([])
  const [selectedPokemon, setSelectedPokemon] = useState(null)
  const [dataDir, setDataDir] = useState(null)
  const [hasData, setHasData] = useState(false)
  const [error, setError] = useState(null)
  const [showRegenConfirm, setShowRegenConfirm] = useState(false)

  // Apply initialSearch from Map navigation — consume immediately so it doesn't re-trigger
  useEffect(() => {
    if (initialSearch) {
      setSearch(initialSearch)
      setSelectedPokemon(null)
      if (onInitialSearchConsumed) onInitialSearchConsumed()
    }
  }, [initialSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getPokemonDataDir().then(dir => setDataDir(dir))
    }
  }, [])

  const loadPokemon = useCallback(async () => {
    if (!dataDir || !game?.pokedexFile) return
    setLoading(true)
    setError(null)
    try {
      const cacheKey = `pg_pokedex_${game.id}`
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const data = JSON.parse(cached)
        if (data && data.length > 0) {
          setPokemon(data)
          setHasData(true)
          setLoading(false)
          return
        }
      }
      if (window.electronAPI?.readPokemonFile) {
        const data = await window.electronAPI.readPokemonFile(dataDir, game.pokedexFile + '.json')
        if (data && data.length > 0) {
          writeStorage(cacheKey, JSON.stringify(data))
          setPokemon(data)
          setHasData(true)
          setLoading(false)
          return
        }
      }
      setPokemon([])
      setHasData(false)
    } catch (e) {
      console.error('loadPokemon error:', e)
      setPokemon([])
      setHasData(false)
    }
    setLoading(false)
  }, [dataDir, game?.id, game?.pokedexFile])

  useEffect(() => {
    if (!dataDir || !game?.pokedexFile) return
    loadPokemon()
  }, [dataDir, game?.id, fetchKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!window.electronAPI) return
    const unsub = window.electronAPI.onPokemonProgress((data) => {
      setGenProgress(data)
    })
    return () => { if (typeof unsub === 'function') unsub() }
  }, [])

  const runGenerate = async () => {
    if (!window.electronAPI || !dataDir) return
    setGenerating(true)
    setGenProgress({ current: 0, total: game.totalPokemon || 151 })
    setError(null)
    let generatedOk = false
    try {
      await window.electronAPI.generatePokemon({
        versionSlug: game.versionSlug,
        pokedexFile: game.pokedexFile,
        totalPokemon: game.totalPokemon || 151,
        outputDir: dataDir,
      })
      generatedOk = true
    } catch (e) {
      setError(e.message || 'Generation failed')
    } finally {
      setGenerating(false)
    }
    if (generatedOk) {
      removeStorage(`pg_pokedex_${game.id}`)
      setLoading(true)
      try {
        const data = window.electronAPI.readPokemonFile
          ? await window.electronAPI.readPokemonFile(dataDir, game.pokedexFile + '.json')
          : null
        if (data && data.length > 0) {
          writeStorage(`pg_pokedex_${game.id}`, JSON.stringify(data))
          setPokemon(data)
          setHasData(true)
        } else {
          setError('Generation complete but data could not be loaded. Try re-generating.')
        }
      } catch (e) {
        setError('Failed to load generated data: ' + e.message)
      } finally {
        setLoading(false)
      }
    }
  }

  const handleGenerate = runGenerate

  const handleRegenerate = async () => {
    removeStorage(`pg_pokedex_${game.id}`)
    if (window.electronAPI?.deletePokemonFile && dataDir) {
      await window.electronAPI.deletePokemonFile(dataDir, game.pokedexFile + '.json')
    }
    setPokemon([])
    setHasData(false)
    setShowRegenConfirm(false)
    await runGenerate()
  }

  const toggleTypeFilter = (type) => {
    setTypeFilters(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  const filteredPokemon = pokemon.filter(p => {
    if (!search) {
      return typeFilters.length === 0 || typeFilters.some(t => p.types?.includes(t))
    }
    const q = search.toLowerCase()
    const matchName = p.name.toLowerCase().includes(q)
    const matchId = String(p.id).includes(q)
    const matchLocation = (p.locations || []).some(loc => loc.area.toLowerCase().includes(q))
    const matchSearch = matchName || matchId || matchLocation
    const matchType = typeFilters.length === 0 || typeFilters.some(t => p.types?.includes(t))
    return matchSearch && matchType
  })

  const isLocationSearch = search.length > 1 && !pokemon.some(p => p.name.toLowerCase().includes(search.toLowerCase())) &&
    filteredPokemon.some(p => (p.locations || []).some(loc => loc.area.toLowerCase().includes(search.toLowerCase())))

  // Auto-select if search matches exactly one pokemon
  useEffect(() => {
    if (initialSearch && filteredPokemon.length === 1 && !selectedPokemon) {
      setSelectedPokemon(filteredPokemon[0])
    }
  }, [filteredPokemon.length, initialSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  if (selectedPokemon) {
    return (
      <PokemonDetail
        pokemon={selectedPokemon}
        allPokemon={pokemon}
        onBack={() => { setSelectedPokemon(null); setSearch('') }}
        onNavigate={setSelectedPokemon}
        game={game}
      />
    )
  }

  return (
    <div style={styles.container}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
          <input
            style={styles.searchInput}
            placeholder="Search by name, #, or location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {hasData && !generating && (
            <button
              style={styles.regenBtn}
              onClick={() => setShowRegenConfirm(true)}
              disabled={generating || loading}
              title="Delete and re-fetch Pokédex data"
            >
              <RefreshCw size={13} />
              <span>Regenerate</span>
            </button>
          )}
        </div>
        {isLocationSearch && (
          <div style={styles.locationBadge}>
            Showing Pokémon found in "{search}"
          </div>
        )}
        <div style={styles.typeFilters}>
          {ALL_TYPES.map(type => (
            <button
              key={type}
              style={{
                ...styles.typeBtn,
                background: typeFilters.includes(type) ? TYPE_COLORS[type] + '33' : 'transparent',
                border: typeFilters.includes(type)
                  ? `2px solid ${TYPE_COLORS[type]}`
                  : `1px solid ${TYPE_COLORS[type]}44`,
                opacity: typeFilters.length > 0 && !typeFilters.includes(type) ? 0.45 : 1,
              }}
              onClick={() => toggleTypeFilter(type)}
              title={type}
            >
              <TypeBadge type={type} height={14} />
            </button>
          ))}
          {typeFilters.length > 0 && (
            <button style={styles.clearBtn} onClick={() => setTypeFilters([])}>✕ Clear</button>
          )}
        </div>
      </div>

      {/* Generation progress bar */}
      {generating && (
        <div style={styles.genProgress}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>
              {genProgress.total > 0 && genProgress.current >= genProgress.total ? 'Finalizing...' : 'Generating Pokédex data...'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
              {genProgress.current} / {genProgress.total}
            </span>
          </div>
          <div style={styles.progressTrack}>
            <div style={{
              ...styles.progressFill,
              width: `${genProgress.total > 0 ? (genProgress.current / genProgress.total * 100) : 0}%`,
            }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {genProgress.total > 0 ? `${Math.round(genProgress.current / genProgress.total * 100)}% complete` : 'Starting...'}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={styles.errorBanner}>
          <span>⚠ {error}</span>
          <button style={{ marginLeft: 12, fontSize: 12, background: 'none', border: 'none', color: '#fc8181', cursor: 'pointer' }} onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* No data state */}
      {!loading && !generating && !hasData && game?.pokedexFile && (
        <div style={styles.noData}>
          <div style={{ marginBottom: 16, color: 'var(--text-muted)', opacity: 0.5 }}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>No Pokédex data yet</div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 13 }}>
            Fetch data for {game.title} from PokéAPI to get started.
          </div>
          <button style={styles.generateBtn} onClick={handleGenerate} disabled={!window.electronAPI}>
            Generate Pokédex ({game.totalPokemon || 151} Pokémon)
          </button>
          {!window.electronAPI && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Available in Electron only</p>
          )}
        </div>
      )}

      {/* Pokemon grid */}
      {(hasData || loading) && (
        <>
          {hasData && !loading && (
            <div style={{ padding: '6px 16px', fontSize: 11, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
              {filteredPokemon.length} of {pokemon.length} Pokémon
            </div>
          )}
          <div style={styles.grid}>
            {loading && Array.from({ length: 24 }).map((_, i) => <SkeletonCard key={i} />)}
            {!loading && filteredPokemon.map(p => (
              <PokemonCard key={p.id} pokemon={p} onClick={() => setSelectedPokemon(p)} />
            ))}
            {!loading && filteredPokemon.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-secondary)', padding: 40 }}>
                No Pokémon match your search
              </div>
            )}
          </div>
        </>
      )}

      {/* Custom confirm dialog */}
      {showRegenConfirm && (
        <ConfirmDialog
          message="This will delete the existing Pokédex data and re-fetch everything from PokéAPI. This cannot be undone."
          onConfirm={handleRegenerate}
          onCancel={() => setShowRegenConfirm(false)}
        />
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .poke-card:hover { transform: translateY(-2px); border-color: var(--game-color) !important; box-shadow: 0 4px 16px rgba(0,0,0,0.3); }
      `}</style>
    </div>
  )
}

function PokemonCard({ pokemon, onClick }) {
  return (
    <div className="poke-card" style={styles.card} onClick={onClick}>
      <img
        src={pokemon.sprite || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`}
        alt={pokemon.name}
        style={styles.sprite}
        loading="lazy"
      />
      <div style={styles.cardId}>#{String(pokemon.id).padStart(3, '0')}</div>
      <div style={styles.cardName}>{pokemon.name}</div>
      <div style={styles.cardTypes}>
        {(pokemon.types || []).map(t => <TypePill key={t} type={t} />)}
      </div>
    </div>
  )
}

function PokemonDetail({ pokemon, allPokemon, onBack, onNavigate, game }) {
  const stats = pokemon.stats || {}

  return (
    <div style={styles.detailContainer}>
      <div style={styles.detailHeader}>
        <button style={styles.backBtn} onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
            <path d="M10 4L6 8l4 4" />
          </svg>
          Back to Pokédex
        </button>
        <span style={{ fontSize: 14, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          #{String(pokemon.id).padStart(3, '0')}
        </span>
      </div>

      <div style={styles.detailBody}>
        <div style={styles.detailMain}>
          {/* Hero */}
          <div style={styles.detailHero}>
            <div style={styles.spriteWrapper}>
              <img
                src={pokemon.sprite || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`}
                alt={pokemon.name}
                style={styles.detailSprite}
              />
            </div>
            <div>
              <h2 style={styles.detailName}>
                {pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1)}
              </h2>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {(pokemon.types || []).map(t => <TypePill key={t} type={t} />)}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={styles.statsSection}>
            <div style={styles.sectionTitle}>Base Stats</div>
            {Object.entries(STAT_LABELS).map(([key, label]) => {
              const val = stats[key] || 0
              const pct = Math.round((val / 255) * 100)
              return (
                <div key={key} style={styles.statRow}>
                  <span style={styles.statLabel}>{label}</span>
                  <span style={styles.statVal}>{val}</span>
                  <div style={styles.statBar}>
                    <div style={{ ...styles.statFill, width: `${pct}%`, background: STAT_COLORS[key] }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Evolution chain */}
          {pokemon.evolution?.chain && pokemon.evolution.chain.length > 1 && (
            <div style={styles.evoSection}>
              <div style={styles.sectionTitle}>Evolution Chain</div>
              <div style={styles.evoChain}>
                {pokemon.evolution.chain.map((evoName, idx) => {
                  const evoPokemon = allPokemon.find(p => p.name.toLowerCase() === evoName.toLowerCase())
                  const detail = pokemon.evolution.details?.[idx]
                  return (
                    <React.Fragment key={evoName}>
                      {idx > 0 && (
                        <div style={styles.evoArrow}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                            <path d="M4 8h8M8 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          {detail && <div style={styles.evoMethod}>{detail}</div>}
                        </div>
                      )}
                      <div
                        style={{
                          ...styles.evoCard,
                          ...(evoName.toLowerCase() === pokemon.name.toLowerCase() ? styles.evoCardActive : {}),
                          cursor: evoPokemon ? 'pointer' : 'default',
                        }}
                        onClick={() => evoPokemon && onNavigate(evoPokemon)}
                      >
                        <img
                          src={evoPokemon?.sprite || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${evoPokemon?.id || 0}.png`}
                          alt={evoName}
                          style={{ width: 52, height: 52 }}
                        />
                        <span style={styles.evoName}>{evoName}</span>
                      </div>
                    </React.Fragment>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Locations */}
        {pokemon.locations && pokemon.locations.length > 0 && (
          <div style={styles.locationsSection}>
            <div style={styles.sectionTitle}>Locations in {game?.title}</div>
            <table style={styles.locTable}>
              <thead>
                <tr>
                  <th style={styles.th}>Area</th>
                  <th style={styles.th}>Method</th>
                  <th style={styles.th}>Level</th>
                </tr>
              </thead>
              <tbody>
                {pokemon.locations.map((loc, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'var(--bg-card)' : 'transparent' }}>
                    <td style={styles.td}>{loc.area}</td>
                    <td style={styles.td}>{loc.method}</td>
                    <td style={styles.td}>
                      {loc.min_level === loc.max_level
                        ? `Lv.${loc.min_level}`
                        : `Lv.${loc.min_level}–${loc.max_level}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  topBar: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    padding: '8px 12px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    borderRadius: 6,
    color: 'var(--text-primary)',
    fontSize: 13,
    outline: 'none',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  },
  locationBadge: {
    display: 'inline-block',
    background: 'var(--game-color)22',
    color: 'var(--game-color)',
    border: '1px solid var(--game-color)44',
    borderRadius: 6,
    padding: '3px 10px',
    fontSize: 11,
    fontWeight: 600,
    marginBottom: 8,
  },
  typeFilters: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
  },
  typeBtn: {
    padding: '3px 5px',
    borderRadius: 6,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    transition: 'opacity 0.15s, border-color 0.15s',
  },
  clearBtn: {
    background: 'transparent',
    border: '1px solid var(--border-color)',
    color: 'var(--text-secondary)',
    borderRadius: 10,
    padding: '3px 10px',
    fontSize: 10,
    cursor: 'pointer',
  },
  genProgress: {
    padding: '12px 16px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-color)',
    flexShrink: 0,
  },
  progressTrack: {
    height: 6,
    background: 'var(--bg-tertiary)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'var(--game-color)',
    borderRadius: 3,
    transition: 'width 0.3s ease',
  },
  errorBanner: {
    background: '#e53e3e18',
    color: '#fc8181',
    border: '1px solid #e53e3e33',
    padding: '8px 16px',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  noData: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    padding: 40,
  },
  generateBtn: {
    background: 'var(--game-color)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 24px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  regenBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 6,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    flexShrink: 0,
    whiteSpace: 'nowrap',
    transition: 'all 0.15s',
  },
  grid: {
    flex: 1,
    overflowY: 'auto',
    padding: 16,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
    gap: 10,
    alignContent: 'start',
  },
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 10,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  sprite: {
    width: 64,
    height: 64,
  },
  cardId: {
    fontSize: 10,
    color: 'var(--text-muted)',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  cardName: {
    fontSize: 12,
    fontWeight: 600,
    textAlign: 'center',
    textTransform: 'capitalize',
    color: 'var(--text-primary)',
  },
  cardTypes: {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 2,
  },
  detailContainer: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  detailHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 20px',
    borderBottom: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
    justifyContent: 'space-between',
  },
  backBtn: {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 6,
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.15s',
  },
  detailBody: {
    flex: 1,
    overflowY: 'auto',
    padding: 24,
    display: 'flex',
    gap: 24,
    flexWrap: 'wrap',
    alignContent: 'start',
  },
  detailMain: {
    flex: '1 1 320px',
    minWidth: 280,
  },
  detailHero: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    marginBottom: 24,
    padding: 16,
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
  },
  spriteWrapper: {
    background: 'var(--bg-secondary)',
    borderRadius: 12,
    padding: 8,
    border: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  detailSprite: {
    width: 128,
    height: 128,
  },
  detailName: {
    fontSize: 26,
    fontWeight: 700,
    textTransform: 'capitalize',
    letterSpacing: -0.5,
  },
  statsSection: {
    marginBottom: 20,
    padding: 16,
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  statRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    width: 52,
    textAlign: 'right',
    fontWeight: 500,
  },
  statVal: {
    fontSize: 12,
    fontWeight: 700,
    width: 30,
    textAlign: 'right',
    fontFamily: 'monospace',
    color: 'var(--text-primary)',
  },
  statBar: {
    flex: 1,
    height: 6,
    background: 'var(--bg-tertiary)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  statFill: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.6s ease',
  },
  evoSection: {
    marginBottom: 20,
    padding: 16,
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
  },
  evoChain: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  evoArrow: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    padding: '0 4px',
  },
  evoMethod: {
    fontSize: 10,
    color: 'var(--text-muted)',
    textAlign: 'center',
    maxWidth: 60,
    marginTop: 2,
  },
  evoCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
    transition: 'all 0.15s',
  },
  evoCardActive: {
    border: '2px solid var(--game-color)',
    background: 'var(--game-color)18',
  },
  evoName: {
    fontSize: 11,
    textTransform: 'capitalize',
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
  locationsSection: {
    flex: '1 1 300px',
    minWidth: 260,
  },
  locTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 12,
    background: 'var(--bg-card)',
    borderRadius: 10,
    overflow: 'hidden',
    border: '1px solid var(--border-color)',
  },
  th: {
    padding: '8px 12px',
    background: 'var(--bg-secondary)',
    color: 'var(--text-muted)',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  td: {
    padding: '7px 12px',
    color: 'var(--text-secondary)',
    borderBottom: '1px solid var(--border-color)',
    textTransform: 'capitalize',
  },
  // Confirm dialog
  dialogOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 8000,
  },
  dialog: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: '28px 32px',
    maxWidth: 380,
    width: '90%',
    textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  dialogIcon: {
    marginBottom: 12,
    display: 'flex',
    justifyContent: 'center',
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: 700,
    marginBottom: 10,
    color: 'var(--text-primary)',
  },
  dialogMsg: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    lineHeight: 1.55,
    marginBottom: 24,
  },
  dialogBtns: {
    display: 'flex',
    gap: 10,
    justifyContent: 'center',
  },
  dialogCancel: {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 7,
    padding: '8px 22px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  dialogConfirm: {
    background: '#e53e3e',
    color: '#fff',
    border: 'none',
    borderRadius: 7,
    padding: '8px 22px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
}

import React, { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from '../components/Icons.jsx'
import { writeStorage, removeStorage } from '../utils/store.js'
import TypeBadge, { TYPE_COLORS } from '../components/TypeBadge.jsx'
import { idbGet, idbSet, idbDelete } from '../utils/idb.js'

const ALL_TYPES = Object.keys(TYPE_COLORS)

const STAT_COLORS = {
  hp: '#e53e3e', attack: '#dd6b20', defense: '#d69e2e',
  special_attack: '#3182ce', special_defense: '#2b6cb0', speed: '#38a169',
}
const STAT_LABELS = {
  hp: 'HP', attack: 'Atk', defense: 'Def',
  special_attack: 'SpAtk', special_defense: 'SpDef', speed: 'Speed',
}

function TypePill({ type }) { return <TypeBadge type={type} height={18} /> }

function SkeletonCard() {
  return (
    <div style={styles.card}>
      <div style={{ width: 64, height: 64, background: 'var(--bg-tertiary)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
      <div style={{ width: 40, height: 10, background: 'var(--bg-tertiary)', borderRadius: 4, marginTop: 4 }} />
      <div style={{ width: 70, height: 12, background: 'var(--bg-tertiary)', borderRadius: 4 }} />
    </div>
  )
}

// ── Direct PokeAPI generation (web version) ──────────────────

async function fetchOnePokemon(id, versionGroup) {
  const [specRes, pkRes] = await Promise.all([
    fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`),
    fetch(`https://pokeapi.co/api/v2/pokemon/${id}`),
  ])
  if (!specRes.ok || !pkRes.ok) return null

  const [spec, pk] = await Promise.all([specRes.json(), pkRes.json()])

  // Types
  const types = pk.types.map(t => t.type.name)

  // Stats
  const stats = {}
  pk.stats.forEach(s => {
    stats[s.stat.name.replace('-', '_')] = s.base_stat
  })

  // Abilities
  const abilities = pk.abilities.map(a => a.ability.name)

  // Locations in version
  let locations = []
  try {
    const encRes = await fetch(pk.location_area_encounters)
    if (encRes.ok) {
      const encData = await encRes.json()
      locations = encData
        .filter(e => !versionGroup || e.version_details.some(vd => vd.version.name === versionGroup))
        .map(e => {
          const vd = versionGroup
            ? e.version_details.find(v => v.version.name === versionGroup) || e.version_details[0]
            : e.version_details[0]
          const method = e.encounter_details?.[0]?.method?.name || 'walk'
          const min = vd?.encounter_details?.[0]?.min_level || 0
          const max = vd?.encounter_details?.[0]?.max_level || 0
          return { area: e.location_area.name.replace(/-/g, ' '), method, min_level: min, max_level: max }
        })
    }
  } catch {}

  // Evolution chain
  let evolution = null
  try {
    const chainUrl = spec.evolution_chain?.url
    if (chainUrl) {
      const chainRes = await fetch(chainUrl)
      if (chainRes.ok) {
        const chainData = await chainRes.json()
        const chain = []
        const details = []
        let node = chainData.chain
        while (node) {
          chain.push(node.species.name)
          if (node.evolution_details?.[0]) {
            const d = node.evolution_details[0]
            if (d.min_level) details.push(`Lv.${d.min_level}`)
            else if (d.item) details.push(d.item.name)
            else if (d.trigger?.name) details.push(d.trigger.name)
            else details.push('?')
          } else {
            details.push(null)
          }
          node = node.evolves_to?.[0] || null
        }
        evolution = { chain, details }
      }
    }
  } catch {}

  return {
    id,
    name: pk.name,
    sprite: pk.sprites.front_default,
    types,
    stats,
    abilities,
    locations,
    evolution,
  }
}

export default function PokedexView({ game, fetchKey, initialSearch, onInitialSearchConsumed }) {
  const [pokemon, setPokemon] = useState([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genProgress, setGenProgress] = useState({ current: 0, total: 0 })
  const [search, setSearch] = useState('')
  const [typeFilters, setTypeFilters] = useState([])
  const [selectedPokemon, setSelectedPokemon] = useState(null)
  const [hasData, setHasData] = useState(false)
  const [error, setError] = useState(null)
  const [showRegenConfirm, setShowRegenConfirm] = useState(false)

  // Apply initial search from MapView navigation
  useEffect(() => {
    if (initialSearch) {
      setSearch(initialSearch)
      setSelectedPokemon(null)
      if (onInitialSearchConsumed) onInitialSearchConsumed()
    }
  }, [initialSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadPokemon = useCallback(async () => {
    if (!game?.pokedexFile) return
    setLoading(true)
    setError(null)
    try {
      // Check localStorage cache first
      const cacheKey = `pg_pokedex_${game.id}`
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const data = JSON.parse(cached)
        if (data?.length > 0) { setPokemon(data); setHasData(true); setLoading(false); return }
      }
      // Try IndexedDB
      const idbData = await idbGet(game.id)
      if (idbData?.length > 0) {
        writeStorage(cacheKey, JSON.stringify(idbData))
        setPokemon(idbData); setHasData(true); setLoading(false); return
      }
      setPokemon([]); setHasData(false)
    } catch {
      setPokemon([]); setHasData(false)
    }
    setLoading(false)
  }, [game?.id, game?.pokedexFile])

  useEffect(() => {
    loadPokemon()
  }, [game?.id, fetchKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const runGenerate = async () => {
    if (!game) return
    const total = game.totalPokemon || 151
    setGenerating(true)
    setGenProgress({ current: 0, total })
    setError(null)
    const results = []
    const versionSlug = game.versionSlug || ''

    // Fetch pokemon in batches of 5
    const BATCH = 5
    for (let i = 1; i <= total; i += BATCH) {
      const batch = Array.from({ length: Math.min(BATCH, total - i + 1) }, (_, j) => i + j)
      try {
        const batchResults = await Promise.all(batch.map(id => fetchOnePokemon(id, versionSlug)))
        batchResults.forEach(p => { if (p) results.push(p) })
      } catch (e) {
        // Continue on individual failures
      }
      setGenProgress({ current: Math.min(i + BATCH - 1, total), total })
    }

    if (results.length === 0) {
      setError('Could not fetch Pokédex data. Check your internet connection.')
      setGenerating(false)
      return
    }

    // Save to IndexedDB + localStorage
    await idbSet(game.id, results)
    const cacheKey = `pg_pokedex_${game.id}`
    writeStorage(cacheKey, JSON.stringify(results))
    setPokemon(results)
    setHasData(true)
    setGenerating(false)
  }

  const handleRegenerate = async () => {
    const cacheKey = `pg_pokedex_${game.id}`
    removeStorage(cacheKey)
    await idbDelete(game.id)
    setPokemon([])
    setHasData(false)
    setShowRegenConfirm(false)
    await runGenerate()
  }

  const toggleTypeFilter = (type) => {
    setTypeFilters(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])
  }

  const filteredPokemon = pokemon.filter(p => {
    if (!search) return typeFilters.length === 0 || typeFilters.some(t => p.types?.includes(t))
    const q = search.toLowerCase()
    const matchName = p.name.toLowerCase().includes(q)
    const matchId = String(p.id).includes(q)
    const matchLocation = (p.locations || []).some(loc => loc.area.toLowerCase().includes(q))
    const matchSearch = matchName || matchId || matchLocation
    const matchType = typeFilters.length === 0 || typeFilters.some(t => p.types?.includes(t))
    return matchSearch && matchType
  })

  const isLocationSearch = search.length > 1 &&
    !pokemon.some(p => p.name.toLowerCase().includes(search.toLowerCase())) &&
    filteredPokemon.some(p => (p.locations || []).some(loc => loc.area.toLowerCase().includes(search.toLowerCase())))

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
      <div style={styles.topBar} className="pdx-topbar">
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }} className="pdx-search-row">
          <input style={styles.searchInput}
            placeholder="Search by name, #, or location..."
            value={search} onChange={e => setSearch(e.target.value)} />
          {hasData && !generating && (
            <button style={styles.regenBtn} className="pdx-regen" onClick={() => setShowRegenConfirm(true)} disabled={generating || loading} title="Re-fetch Pokédex data">
              <RefreshCw size={13} /><span>Regenerate</span>
            </button>
          )}
        </div>
        {isLocationSearch && (
          <div style={styles.locationBadge}>Showing Pokémon found in "{search}"</div>
        )}
        <div style={styles.typeFilters}>
          {ALL_TYPES.map(type => (
            <button key={type}
              style={{ ...styles.typeBtn, background: typeFilters.includes(type) ? TYPE_COLORS[type] + '33' : 'transparent', border: typeFilters.includes(type) ? `2px solid ${TYPE_COLORS[type]}` : `1px solid ${TYPE_COLORS[type]}44`, opacity: typeFilters.length > 0 && !typeFilters.includes(type) ? 0.45 : 1 }}
              onClick={() => toggleTypeFilter(type)} title={type}>
              <TypeBadge type={type} height={14} />
            </button>
          ))}
          {typeFilters.length > 0 && (
            <button style={styles.clearBtn} onClick={() => setTypeFilters([])}>✕ Clear</button>
          )}
        </div>
      </div>

      {/* Generation progress */}
      {generating && (
        <div style={styles.genProgress}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Fetching Pokédex data from PokéAPI...</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{genProgress.current} / {genProgress.total}</span>
          </div>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: `${genProgress.total > 0 ? (genProgress.current / genProgress.total * 100) : 0}%` }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {genProgress.total > 0 ? `${Math.round(genProgress.current / genProgress.total * 100)}% complete` : 'Starting...'}
          </div>
        </div>
      )}

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
            Fetch data for {game.title} from PokéAPI to get started.<br />
            Requires an internet connection.
          </div>
          <button style={styles.generateBtn} onClick={runGenerate}>
            Generate Pokédex ({game.totalPokemon || 151} Pokémon)
          </button>
        </div>
      )}

      {!game?.pokedexFile && !loading && !generating && (
        <div style={styles.noData}>
          <div style={{ fontSize: 16, color: 'var(--text-muted)' }}>No game selected or game has no Pokédex configured.</div>
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
          <div style={styles.grid} className="pdx-grid">
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

      {/* Regen confirm dialog */}
      {showRegenConfirm && (
        <div style={styles.dialogOverlay}>
          <div style={styles.dialog}>
            <div style={styles.dialogIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f6ad55" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div style={styles.dialogTitle}>Regenerate Pokédex?</div>
            <div style={styles.dialogMsg}>This will delete the existing data and re-fetch everything from PokéAPI.</div>
            <div style={styles.dialogBtns}>
              <button style={styles.dialogCancel} onClick={() => setShowRegenConfirm(false)}>Cancel</button>
              <button style={styles.dialogConfirm} onClick={handleRegenerate}>Regenerate</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .poke-card:hover{transform:translateY(-2px);border-color:var(--game-color)!important;box-shadow:0 4px 16px rgba(0,0,0,0.3);}
        @media(max-width:768px){
          .pdx-grid{grid-template-columns:repeat(auto-fill,minmax(90px,1fr))!important;padding:10px!important;}
          .pdx-topbar{padding:8px 10px!important;}
          .pdx-search-row{flex-wrap:wrap;}
          .pdx-regen{display:none!important;}
          .pdx-detail-body{flex-direction:column!important;padding:12px!important;gap:16px!important;}
          .pdx-detail-hero{flex-direction:column!important;align-items:center!important;text-align:center;padding:12px!important;}
          .pdx-detail-main{min-width:0!important;width:100%;}
          .pdx-locations{min-width:0!important;width:100%;}
        }
      `}</style>
    </div>
  )
}

function PokemonCard({ pokemon, onClick }) {
  return (
    <div className="poke-card" style={styles.card} onClick={onClick}>
      <img src={pokemon.sprite || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`}
        alt={pokemon.name} style={styles.sprite} loading="lazy" />
      <div style={styles.cardId}>#{String(pokemon.id).padStart(3, '0')}</div>
      <div style={styles.cardName}>{pokemon.name}</div>
      <div style={styles.cardTypes}>{(pokemon.types || []).map(t => <TypePill key={t} type={t} />)}</div>
    </div>
  )
}

function PokemonDetail({ pokemon, allPokemon, onBack, onNavigate, game }) {
  const stats = pokemon.stats || {}
  return (
    <div style={styles.detailContainer}>
      <div style={styles.detailHeader}>
        <button style={styles.backBtn} onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}><path d="M10 4L6 8l4 4"/></svg>
          Back to Pokédex
        </button>
        <span style={{ fontSize: 14, color: 'var(--text-muted)', fontFamily: 'monospace' }}>#{String(pokemon.id).padStart(3, '0')}</span>
      </div>
      <div style={styles.detailBody} className="pdx-detail-body">
        <div style={styles.detailMain} className="pdx-detail-main">
          <div style={styles.detailHero} className="pdx-detail-hero">
            <div style={styles.spriteWrapper}>
              <img src={pokemon.sprite || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`}
                alt={pokemon.name} style={styles.detailSprite} />
            </div>
            <div>
              <h2 style={styles.detailName}>{pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1)}</h2>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {(pokemon.types || []).map(t => <TypePill key={t} type={t} />)}
              </div>
              {pokemon.abilities?.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                  {pokemon.abilities.map(a => a.charAt(0).toUpperCase() + a.slice(1).replace(/-/g, ' ')).join(' / ')}
                </div>
              )}
            </div>
          </div>

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

          {pokemon.evolution?.chain?.length > 1 && (
            <div style={styles.evoSection}>
              <div style={styles.sectionTitle}>Evolution Chain</div>
              <div style={styles.evoChain}>
                {pokemon.evolution.chain.map((evoName, idx) => {
                  const evoPoke = allPokemon.find(p => p.name.toLowerCase() === evoName.toLowerCase())
                  const detail = pokemon.evolution.details?.[idx]
                  return (
                    <React.Fragment key={evoName}>
                      {idx > 0 && (
                        <div style={styles.evoArrow}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><path d="M4 8h8M8 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          {detail && <div style={styles.evoMethod}>{detail}</div>}
                        </div>
                      )}
                      <div style={{ ...styles.evoCard, ...(evoName.toLowerCase() === pokemon.name.toLowerCase() ? styles.evoCardActive : {}), cursor: evoPoke ? 'pointer' : 'default' }}
                        onClick={() => evoPoke && onNavigate(evoPoke)}>
                        <img src={evoPoke?.sprite || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${evoPoke?.id || 0}.png`}
                          alt={evoName} style={{ width: 52, height: 52 }} />
                        <span style={styles.evoName}>{evoName}</span>
                      </div>
                    </React.Fragment>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {pokemon.locations?.length > 0 && (
          <div style={styles.locationsSection} className="pdx-locations">
            <div style={styles.sectionTitle}>Locations in {game?.title}</div>
            <table style={styles.locTable}>
              <thead><tr><th style={styles.th}>Area</th><th style={styles.th}>Method</th><th style={styles.th}>Level</th></tr></thead>
              <tbody>
                {pokemon.locations.map((loc, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'var(--bg-card)' : 'transparent' }}>
                    <td style={styles.td}>{loc.area}</td>
                    <td style={styles.td}>{loc.method}</td>
                    <td style={styles.td}>{loc.min_level === loc.max_level ? `Lv.${loc.min_level}` : `Lv.${loc.min_level}–${loc.max_level}`}</td>
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
  container: { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  topBar: { padding: '12px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', flexShrink: 0 },
  searchInput: { flex: 1, minWidth: 0, width: '100%', padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 13, outline: 'none' },
  locationBadge: { display: 'inline-block', background: 'var(--game-color)22', color: 'var(--game-color)', border: '1px solid var(--game-color)44', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600, marginBottom: 8 },
  typeFilters: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  typeBtn: { padding: '3px 5px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center' },
  clearBtn: { background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 10, padding: '3px 10px', fontSize: 10, cursor: 'pointer' },
  genProgress: { padding: '12px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', flexShrink: 0 },
  progressTrack: { height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', background: 'var(--game-color)', borderRadius: 3, transition: 'width 0.3s ease' },
  errorBanner: { background: '#e53e3e18', color: '#fc8181', border: '1px solid #e53e3e33', padding: '8px 16px', fontSize: 13, display: 'flex', alignItems: 'center', flexShrink: 0 },
  noData: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', textAlign: 'center', padding: 40 },
  generateBtn: { background: 'var(--game-color)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  regenBtn: { display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' },
  grid: { flex: 1, overflowY: 'auto', padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, alignContent: 'start' },
  card: { background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', transition: 'all 0.2s ease' },
  sprite: { width: 64, height: 64 },
  cardId: { fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 },
  cardName: { fontSize: 12, fontWeight: 600, textAlign: 'center', textTransform: 'capitalize', color: 'var(--text-primary)' },
  cardTypes: { display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', marginTop: 2 },
  detailContainer: { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  detailHeader: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', flexShrink: 0, justifyContent: 'space-between' },
  backBtn: { background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center' },
  detailBody: { flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', gap: 24, flexWrap: 'wrap', alignContent: 'start' },
  detailMain: { flex: '1 1 300px', minWidth: 260 },
  detailHero: { display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24, padding: 16, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12 },
  spriteWrapper: { background: 'var(--bg-secondary)', borderRadius: 12, padding: 8 },
  detailSprite: { width: 96, height: 96, imageRendering: 'pixelated' },
  detailName: { fontSize: 22, fontWeight: 700, textTransform: 'capitalize', margin: 0 },
  statsSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  statRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 },
  statLabel: { width: 50, fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0, textAlign: 'right' },
  statVal: { width: 28, fontSize: 12, fontWeight: 600, fontFamily: 'monospace', flexShrink: 0, textAlign: 'right' },
  statBar: { flex: 1, height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' },
  statFill: { height: '100%', borderRadius: 3, transition: 'width 0.5s ease' },
  evoSection: { marginBottom: 24 },
  evoChain: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  evoArrow: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  evoMethod: { fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 48, wordBreak: 'break-all' },
  evoCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', transition: 'all 0.15s' },
  evoCardActive: { border: '2px solid var(--game-color)', background: 'var(--game-color)11' },
  evoName: { fontSize: 11, color: 'var(--text-secondary)', textTransform: 'capitalize' },
  locationsSection: { flex: '1 1 260px', minWidth: 240 },
  locTable: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '6px 8px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--border-color)', textAlign: 'left' },
  td: { padding: '6px 8px', fontSize: 12, color: 'var(--text-secondary)', borderRadius: 2 },
  dialogOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(3px)' },
  dialog: { width: 'min(360px, 92vw)', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 14, padding: '28px 24px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' },
  dialogIcon: { marginBottom: 14 },
  dialogTitle: { fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 },
  dialogMsg: { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 20 },
  dialogBtns: { display: 'flex', gap: 10, width: '100%' },
  dialogCancel: { flex: 1, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 0', fontSize: 13, cursor: 'pointer' },
  dialogConfirm: { flex: 1, background: 'var(--game-color)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
}

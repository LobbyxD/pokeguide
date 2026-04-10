import React, { useState, useEffect, useRef } from 'react'
import { Plus, X, ChevronUp, ChevronDown, Check, Loader, Settings, Map, Download, Upload, Package, Globe, MapPin, Pencil, RotateCcw } from '../components/Icons.jsx'
import ColorPicker from '../components/ColorPicker.jsx'
import { mapData as defaultMapData } from '../data/index.js'
import { useDialog } from '../components/Dialog.jsx'
import { idbGet, idbSet, idbSetMap, idbGetMap } from '../utils/idb.js'
import { saveMapToCloud } from '../utils/cloudSync.js'

const OFFICIAL_PRESETS_URL = 'https://raw.githubusercontent.com/LobbyxD/pokeguide/main/presets/index.json'

const SLUG_TO_TOTAL = {
  red:151,blue:151,yellow:151,firered:151,leafgreen:151,
  gold:251,silver:251,crystal:251,heartgold:251,soulsilver:251,
  ruby:386,sapphire:386,emerald:386,
  diamond:493,pearl:493,platinum:493,
  black:649,white:649,'black-2':649,'white-2':649,
  x:721,y:721,'omega-ruby':721,'alpha-sapphire':721,
  sun:802,moon:802,'ultra-sun':807,'ultra-moon':807,
  sword:898,shield:898,'brilliant-diamond':898,'shining-pearl':898,
  scarlet:1025,violet:1025,
}
const SLUG_TO_GEN = {
  red:1,blue:1,yellow:1,firered:1,leafgreen:1,
  gold:2,silver:2,crystal:2,heartgold:2,soulsilver:2,
  ruby:3,sapphire:3,emerald:3,
  diamond:4,pearl:4,platinum:4,
  black:5,white:5,'black-2':5,'white-2':5,
  x:6,y:6,'omega-ruby':6,'alpha-sapphire':6,
  sun:7,moon:7,'ultra-sun':7,'ultra-moon':7,
  sword:8,shield:8,'brilliant-diamond':8,'shining-pearl':8,
  scarlet:9,violet:9,
}
const SLUG_TO_REGION = {
  red:'Kanto',blue:'Kanto',yellow:'Kanto',firered:'Kanto',leafgreen:'Kanto',
  gold:'Johto',silver:'Johto',crystal:'Johto',heartgold:'Johto',soulsilver:'Johto',
  ruby:'Hoenn',sapphire:'Hoenn',emerald:'Hoenn','omega-ruby':'Hoenn','alpha-sapphire':'Hoenn',
  diamond:'Sinnoh',pearl:'Sinnoh',platinum:'Sinnoh','brilliant-diamond':'Sinnoh','shining-pearl':'Sinnoh',
  black:'Unova',white:'Unova','black-2':'Unova','white-2':'Unova',
  x:'Kalos',y:'Kalos',
  sun:'Alola',moon:'Alola','ultra-sun':'Alola','ultra-moon':'Alola',
  sword:'Galar',shield:'Galar',
  scarlet:'Paldea',violet:'Paldea',
}


const GAME_TEMPLATE = { id:'', title:'New Game', region:'Kanto', generation:1, color:'#e53e3e', pokedexFile:'', versionSlug:'', steps:[] }

// ── Browser download helper ───────────────────────────────────
function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename + '.pgpreset'; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── Browser file picker ───────────────────────────────────────
function pickFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.pgpreset,.json'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) { resolve(null); return }
      try {
        const text = await file.text()
        resolve(JSON.parse(text))
      } catch { resolve(null) }
    }
    input.click()
  })
}

export default function ManageView({ games, selectedGame, onSaveGames, onSelectGame, openPresets, onOpenPresetsConsumed, user }) {
  const { confirm, alert } = useDialog()
  const [activeGame, setActiveGame] = useState(selectedGame || games[0] || null)
  const [activeTab, setActiveTab] = useState('game')
  const [editingStepIdx, setEditingStepIdx] = useState(null)
  const [editingStepText, setEditingStepText] = useState('')
  const [editingStepLoc, setEditingStepLoc] = useState('')
  const [locInput, setLocInput] = useState('')
  const [locOpen, setLocOpen] = useState(false)
  const [mapAreas, setMapAreas] = useState([])
  const [newStepText, setNewStepText] = useState('')
  const [newStepLoc, setNewStepLoc] = useState('')
  const [newLocOpen, setNewLocOpen] = useState(false)
  const [addingNew, setAddingNew] = useState(() => games.length === 0)
  const [presetBusy, setPresetBusy] = useState(false)
  const [officialPresets, setOfficialPresets] = useState(null)
  const [officialLoading, setOfficialLoading] = useState(false)
  const [officialError, setOfficialError] = useState(null)

  const fetchOfficialPresets = async () => {
    if (officialLoading) return
    setOfficialLoading(true); setOfficialError(null)
    try {
      const res = await fetch(OFFICIAL_PRESETS_URL)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setOfficialPresets(await res.json())
    } catch {
      setOfficialError('Could not load official presets. Check your internet connection.')
      setOfficialPresets([])
    }
    setOfficialLoading(false)
  }

  // Auto-fetch presets whenever the New Game panel opens
  useEffect(() => {
    if (addingNew) fetchOfficialPresets()
  }, [addingNew]) // eslint-disable-line react-hooks/exhaustive-deps

  // When App tells us to open the preset picker (e.g. from welcome screen "Browse Official Presets")
  useEffect(() => {
    if (openPresets) {
      setAddingNew(true)
      if (onOpenPresetsConsumed) onOpenPresetsConsumed()
    }
  }, [openPresets]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadOfficialPreset = async (item) => {
    setOfficialLoading(true)
    try {
      const url = `https://raw.githubusercontent.com/LobbyxD/pokeguide/main/presets/${item.filename}.pgpreset`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Failed to download preset (HTTP ${res.status})`)
      const preset = await res.json()
      setOfficialLoading(false)
      await createFromPreset(preset)
    } catch (e) {
      setOfficialLoading(false)
      await alert(e.message, { title: 'Failed to Load Preset', type: 'error' })
    }
  }

  // Load map areas for location autocomplete
  useEffect(() => {
    if (!activeGame) { setMapAreas([]); return }
    idbGetMap(activeGame.id).then(mapObj => {
      const areas = mapObj?.areas || defaultMapData[activeGame.id]?.areas || []
      setMapAreas(areas)
    }).catch(() => setMapAreas(defaultMapData[activeGame.id]?.areas || []))
  }, [activeGame?.id])

  const handleSlugChange = (slug) => {
    if (!activeGame) return
    const s = slug.toLowerCase().trim()
    const updates = { versionSlug: slug }
    const gen = SLUG_TO_GEN[s] ?? null
    if (gen !== null) updates.generation = gen
    const total = SLUG_TO_TOTAL[s]
    if (total !== undefined) updates.totalPokemon = total
    const region = SLUG_TO_REGION[s]
    if (region) updates.region = region
    // Auto-fill pokedexFile only if still empty or matches previous slug
    if (!activeGame.pokedexFile || activeGame.pokedexFile === activeGame.versionSlug) {
      updates.pokedexFile = slug
    }
    updateGame(activeGame.id, updates)
  }

  const getLocSuggestions = (query) => {
    if (!query) return []
    const q = query.toLowerCase()
    return mapAreas.filter(a => a.name?.toLowerCase().includes(q)).map(a => a.name).slice(0, 7)
  }

  const updateGame = (id, updates) => {
    const newGames = games.map(g => g.id === id ? { ...g, ...updates } : g)
    onSaveGames(newGames)
    if (activeGame?.id === id) setActiveGame(prev => ({ ...prev, ...updates }))
  }

  const addGame = () => setAddingNew(true)

  const createBlankGame = () => {
    const id = `custom-game-${Date.now()}`
    const newGame = { ...GAME_TEMPLATE, id, title: 'New Game ' + (games.length + 1) }
    onSaveGames([...games, newGame])
    setActiveGame(newGame); setAddingNew(false)
  }

  const createFromPreset = async (preset) => {
    setPresetBusy(true)
    try {
      const id = `custom-game-${Date.now()}`
      const gameBase = { ...GAME_TEMPLATE, ...preset.game, id }
      // Steps may live in preset.steps (desktop/official format) or already in preset.game
      if (preset.steps) {
        gameBase.steps = preset.steps.steps || []
        gameBase.stepLocs = preset.steps.stepLocs || {}
      }
      const gameData = gameBase
      const newGames = [...games, gameData]
      onSaveGames(newGames)
      if (preset.map) {
        await idbSetMap(id, preset.map)
        if (user) saveMapToCloud(user.id, id, preset.map)
      }
      if (preset.pokedex && gameData.pokedexFile) {
        await idbSet(id, preset.pokedex)
        localStorage.removeItem(`pg_pokedex_${id}`)
      }
      setActiveGame(gameData); setAddingNew(false)
    } catch (e) {
      await alert(e.message, { title: 'Failed to Create Game', type: 'error' })
    }
    setPresetBusy(false)
  }

  const deleteGame = async (gameId) => {
    const ok = await confirm('This game and all its steps will be permanently removed.', {
      title: 'Delete Game', danger: true, confirmLabel: 'Delete',
    })
    if (!ok) return
    const newGames = games.filter(g => g.id !== gameId)
    onSaveGames(newGames)
    if (activeGame?.id === gameId) setActiveGame(newGames[0] || null)
  }

  const handleFieldChange = (field, value) => {
    if (!activeGame) return
    updateGame(activeGame.id, { [field]: value })
  }

  const addStep = () => {
    if (!newStepText.trim() || !activeGame) return
    const newSteps = [...(activeGame.steps || []), newStepText.trim()]
    const updates = { steps: newSteps }
    if (newStepLoc.trim()) {
      const newIdx = newSteps.length - 1
      updates.stepLocs = { ...(activeGame.stepLocs || {}), [newIdx]: newStepLoc.trim() }
    }
    updateGame(activeGame.id, updates)
    setNewStepText(''); setNewStepLoc('')
  }

  const deleteStep = (idx) => {
    if (!activeGame) return
    const newSteps = activeGame.steps.filter((_, i) => i !== idx)
    const oldLocs = activeGame.stepLocs || {}
    const newStepLocs = {}
    for (const [k, v] of Object.entries(oldLocs)) {
      const ki = parseInt(k)
      if (ki === idx) continue
      newStepLocs[ki > idx ? ki - 1 : ki] = v
    }
    updateGame(activeGame.id, { steps: newSteps, stepLocs: newStepLocs })
    if (editingStepIdx === idx) setEditingStepIdx(null)
  }

  const moveStep = (idx, dir) => {
    if (!activeGame) return
    const steps = [...activeGame.steps]
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= steps.length) return
    const tmp = steps[idx]; steps[idx] = steps[newIdx]; steps[newIdx] = tmp
    const newStepLocs = { ...(activeGame.stepLocs || {}) }
    const tmpLoc = newStepLocs[idx]
    if (newStepLocs[newIdx] !== undefined) { newStepLocs[idx] = newStepLocs[newIdx] } else { delete newStepLocs[idx] }
    if (tmpLoc !== undefined) { newStepLocs[newIdx] = tmpLoc } else { delete newStepLocs[newIdx] }
    updateGame(activeGame.id, { steps, stepLocs: newStepLocs })
    if (editingStepIdx === idx) setEditingStepIdx(newIdx)
  }

  const startEditStep = (idx) => {
    setEditingStepIdx(idx)
    setEditingStepText(activeGame.steps[idx])
    const loc = activeGame.stepLocs?.[idx] || ''
    setEditingStepLoc(loc); setLocInput(loc)
  }

  const saveEditStep = () => {
    if (editingStepIdx === null || !activeGame) return
    const newSteps = activeGame.steps.map((s, i) => i === editingStepIdx ? editingStepText : s)
    const newStepLocs = { ...(activeGame.stepLocs || {}) }
    if (editingStepLoc.trim()) newStepLocs[editingStepIdx] = editingStepLoc.trim()
    else delete newStepLocs[editingStepIdx]
    updateGame(activeGame.id, { steps: newSteps, stepLocs: newStepLocs })
    setEditingStepIdx(null); setEditingStepText(''); setEditingStepLoc(''); setLocInput('')
  }

  const selectAndSet = (game) => { setActiveGame(game); onSelectGame(game); setAddingNew(false) }

  // ── Browser export helpers ────────────────────────────────
  const buildMapData = async (gameId) => {
    try {
      const stored = await idbGetMap(gameId)
      if (stored) return stored
      const def = defaultMapData[gameId]
      return def ? { areas: def.areas, width: def.width, height: def.height } : null
    } catch { return null }
  }

  const exportFull = async () => {
    if (!activeGame) return
    setPresetBusy(true)
    try {
      const pokedex = await idbGet(activeGame.id) || null
      const safeName = activeGame.title.replace(/[^a-z0-9]/gi, '_')
      const exportId = activeGame.versionSlug || activeGame.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const { id: _id, ...gameWithoutId } = activeGame
      const preset = {
        presetVersion: 1, type: 'full', name: activeGame.title,
        game: { ...gameWithoutId, id: exportId },
        map: await buildMapData(activeGame.id),
        steps: { steps: activeGame.steps || [], stepLocs: activeGame.stepLocs || {} },
        pokedex,
      }
      downloadJSON(preset, safeName)
    } catch (e) { await alert(e.message, { title: 'Export Failed', type: 'error' }) }
    setPresetBusy(false)
  }

  const exportMap = async () => {
    if (!activeGame) return
    const map = await buildMapData(activeGame.id)
    if (!map) { await alert('No map data found for this game.', { title: 'Nothing to Export' }); return }
    const exportId = activeGame.versionSlug || activeGame.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const preset = { presetVersion: 1, type: 'map', name: activeGame.title + ' Map', game: { id: exportId, title: activeGame.title }, map }
    downloadJSON(preset, activeGame.title.replace(/[^a-z0-9]/gi, '_') + '_map')
  }

  const exportSteps = async () => {
    if (!activeGame) return
    if (!(activeGame.steps || []).length) { await alert('This game has no steps to export.', { title: 'Nothing to Export' }); return }
    const exportId = activeGame.versionSlug || activeGame.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const preset = { presetVersion: 1, type: 'steps', name: activeGame.title + ' Steps', game: { id: exportId, title: activeGame.title }, steps: { steps: activeGame.steps || [], stepLocs: activeGame.stepLocs || {} } }
    downloadJSON(preset, activeGame.title.replace(/[^a-z0-9]/gi, '_') + '_steps')
  }

  const importFull = async () => {
    if (!activeGame) return
    const preset = await pickFile()
    if (!preset) return
    if (preset.type !== 'full') { await alert(`This file is a "${preset.type}" preset, not a full preset.`, { title: 'Wrong Preset Type' }); return }
    const merge = { ...(preset.game || {}), id: activeGame.id, title: activeGame.title }
    delete merge.steps; delete merge.stepLocs
    if (preset.steps) { merge.steps = preset.steps.steps || []; merge.stepLocs = preset.steps.stepLocs || {} }
    updateGame(activeGame.id, merge)
    if (preset.map) await idbSetMap(activeGame.id, preset.map)
    if (preset.pokedex && activeGame.pokedexFile) {
      await idbSet(activeGame.id, preset.pokedex)
      localStorage.removeItem(`pg_pokedex_${activeGame.id}`)
    }
    await alert('Preset imported successfully.', { title: 'Import Complete', type: 'success' })
  }

  const importMap = async () => {
    if (!activeGame) return
    const preset = await pickFile()
    if (!preset) return
    if (!preset.map) { await alert('This preset does not contain map data.', { title: 'No Map Data' }); return }
    await idbSetMap(activeGame.id, preset.map)
    setMapAreas(preset.map.areas || [])
    await alert('Map imported.', { title: 'Done', type: 'success' })
  }

  const importSteps = async () => {
    if (!activeGame) return
    const preset = await pickFile()
    if (!preset) return
    if (!preset.steps) { await alert('This preset does not contain step data.', { title: 'No Step Data' }); return }
    const ok = await confirm(`Replace all steps with ${(preset.steps.steps || []).length} imported steps?`, { title: 'Import Steps', confirmLabel: 'Import' })
    if (!ok) return
    updateGame(activeGame.id, { steps: preset.steps.steps || [], stepLocs: preset.steps.stepLocs || {} })
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="mgv-container" style={styles.container}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -400px 0 }
          100% { background-position: 400px 0 }
        }
        .mgv-quick-btn:hover { border-color: var(--game-color) !important; background: var(--bg-tertiary) !important; }
        .mgv-preset-card:hover { border-color: var(--game-color) !important; background: var(--bg-tertiary) !important; }
        @media (max-width: 768px) {
          .mgv-container { flex-direction: column !important; }
          .mgv-left {
            width: 100% !important;
            height: auto !important;
            flex-shrink: 0 !important;
            border-right: none !important;
            border-bottom: 1px solid var(--border-color) !important;
            flex-direction: row !important;
            overflow: hidden !important;
          }
          .mgv-left-header { padding: 8px 10px !important; flex-shrink: 0; }
          .mgv-game-list {
            flex: 1 !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            display: flex !important;
            flex-direction: row !important;
            padding: 6px 6px !important;
            gap: 6px !important;
          }
          .mgv-game-card {
            min-width: 110px !important;
            max-width: 150px !important;
            flex-shrink: 0 !important;
            border-left: 3px solid transparent !important;
            border-bottom: none !important;
            border-radius: 6px !important;
            padding: 8px 10px !important;
          }
          .mgv-game-card-meta { display: none !important; }
          .mgv-right { min-height: 0; }
        }
      `}</style>
      {/* Left panel */}
      <div className="mgv-left" style={styles.leftPanel}>
        <div className="mgv-left-header" style={styles.leftHeader}>
          <span style={styles.leftTitle}>Games</span>
          <button style={{ ...styles.addBtn, display: 'flex', alignItems: 'center', gap: 4 }} onClick={addGame}>
            <Plus size={12} /> Add
          </button>
        </div>
        <div className="mgv-game-list" style={styles.gameList}>
          {games.map(game => (
            <div key={game.id}
              className="mgv-game-card"
              style={{ ...styles.gameCard, ...(activeGame?.id === game.id ? styles.gameCardActive : {}), borderLeft: `4px solid ${game.color}` }}
              onClick={() => selectAndSet(game)}>
              <div style={styles.gameCardHeader}>
                <span style={styles.gameCardTitle}>{game.title}</span>
                <button style={styles.deleteBtn} onClick={(e) => { e.stopPropagation(); deleteGame(game.id) }} title="Delete">
                  <X size={13} />
                </button>
              </div>
              <div className="mgv-game-card-meta" style={styles.gameCardMeta}>
                <span style={styles.gameMeta}>{game.region}</span>
                <span style={styles.gameMeta}>{(game.steps || []).length} steps</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="mgv-right" style={{ ...styles.rightPanel, position: 'relative' }}>

        {/* Add-new overlay */}
        {addingNew && (
          <div style={styles.presetOverlay}>
            <div style={styles.presetPanel}>
              {/* Header */}
              <div style={styles.presetPanelHeader}>
                <div>
                  <div style={styles.rightTitle}>Add New Game</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Choose a starting point for your game</div>
                </div>
                {games.length > 0 && (
                  <button style={styles.closeIconBtn} onClick={() => setAddingNew(false)}><X size={16} /></button>
                )}
              </div>

              <div style={styles.presetPanelContent}>
                {/* Quick-start row */}
                <div style={styles.quickStartRow}>
                  <button className="mgv-quick-btn" style={styles.quickBtn} onClick={createBlankGame} disabled={presetBusy}>
                    <div style={{ ...styles.quickIcon, background: 'rgba(255,255,255,0.06)' }}><Plus size={20} /></div>
                    <div style={styles.quickLabel}>Blank Game</div>
                    <div style={styles.quickSub}>Start from scratch</div>
                  </button>
                  <button className="mgv-quick-btn" style={styles.quickBtn}
                    onClick={async () => { const p = await pickFile(); if (p) await createFromPreset(p) }}
                    disabled={presetBusy}>
                    <div style={{ ...styles.quickIcon, background: 'rgba(255,255,255,0.06)' }}><Upload size={20} /></div>
                    <div style={styles.quickLabel}>Import File</div>
                    <div style={styles.quickSub}>.pgpreset or .json</div>
                  </button>
                </div>

                {/* Official Presets */}
                <div style={styles.presetSectionLabel}>
                  <Globe size={11} />
                  Official Presets
                  {officialLoading && <Loader size={11} style={{ marginLeft: 6 }} />}
                  {!officialLoading && officialPresets && (
                    <button style={styles.refreshBtn} onClick={fetchOfficialPresets} title="Refresh">
                      <RotateCcw size={11} />
                    </button>
                  )}
                </div>

                {officialLoading && !officialPresets ? (
                  // Skeleton cards while loading
                  <div style={styles.presetGrid}>
                    {[1,2,3,4].map(i => (
                      <div key={i} style={{ ...styles.presetCard, cursor: 'default', gap: 8 }}>
                        <div style={skeletonStyle} />
                        <div style={{ ...skeletonStyle, width: '60%', height: 10 }} />
                      </div>
                    ))}
                  </div>
                ) : officialError ? (
                  <div style={styles.errorRow}>
                    <span>{officialError}</span>
                    <button style={styles.retryBtn} onClick={fetchOfficialPresets}>Retry</button>
                  </div>
                ) : officialPresets?.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '8px 0' }}>No official presets found.</div>
                ) : officialPresets ? (
                  <div style={styles.presetGrid}>
                    {officialPresets.map(item => (
                      <button key={item.filename} className="mgv-preset-card" style={styles.presetCard}
                        disabled={officialLoading || presetBusy}
                        onClick={() => loadOfficialPreset(item)}>
                        <div style={styles.presetCardTop}>
                          <span style={styles.presetCardTitle}>{item.title || item.name}</span>
                          {(officialLoading || presetBusy) && <Loader size={12} style={{ flexShrink: 0 }} />}
                        </div>
                        {item.description && (
                          <div style={styles.presetCardDesc}>{item.description}</div>
                        )}
                        {item.author && (
                          <div style={styles.presetCardAuthor}>by {item.author}</div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* No game selected */}
        {!activeGame && !addingNew && (
          <div style={styles.emptyState}>
            <div style={{ marginBottom: 12, color: 'var(--text-muted)', opacity: 0.4 }}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No game selected</div>
            <button style={{ ...styles.addBtn, padding: '9px 20px', fontSize: 13 }} onClick={addGame}>
              <Plus size={14} /> Add a Game
            </button>
          </div>
        )}

        {/* Game detail panel */}
        {activeGame && !addingNew && (
          <div style={styles.gameDetail}>
            {/* Tabs */}
            <div style={styles.tabs}>
              {[
                { id: 'game', label: 'Game Info', Icon: Settings },
                { id: 'steps', label: `Steps (${(activeGame.steps || []).length})` },
                { id: 'presets', label: 'Presets', Icon: Package },
              ].map(({ id, label }) => (
                <button key={id}
                  style={{ ...styles.tab, ...(activeTab === id ? styles.tabActive : {}) }}
                  onClick={() => setActiveTab(id)}>
                  {label}
                </button>
              ))}
            </div>

            <div style={styles.tabContent}>
              {/* ── Game Info tab ── */}
              {activeTab === 'game' && (
                <div style={styles.fields}>
                  <Field label="Title">
                    <input style={styles.input} value={activeGame.title || ''} onChange={e => handleFieldChange('title', e.target.value)} placeholder="Game title" />
                  </Field>
                  <Field label="Region">
                    <input style={styles.input} value={activeGame.region || ''} onChange={e => handleFieldChange('region', e.target.value)} placeholder="Kanto" />
                  </Field>
                  <Field label="Version Slug">
                    <input style={styles.input} value={activeGame.versionSlug || ''} onChange={e => handleSlugChange(e.target.value)} placeholder="firered, emerald, sword…" />
                  </Field>
                  <Field label="Generation">
                    <input style={{ ...styles.input, width: 80 }} type="number" min={1} max={9}
                      value={activeGame.generation || 1} onChange={e => handleFieldChange('generation', parseInt(e.target.value) || 1)} />
                  </Field>
                  <Field label="Total Pokémon">
                    <input style={{ ...styles.input, width: 80 }} type="number" min={1}
                      value={activeGame.totalPokemon || 151} onChange={e => handleFieldChange('totalPokemon', parseInt(e.target.value) || 151)} />
                  </Field>
                  <Field label="Pokédex File Key">
                    <input style={styles.input} value={activeGame.pokedexFile || ''} onChange={e => handleFieldChange('pokedexFile', e.target.value)} placeholder="firered (used as cache key)" />
                  </Field>
                  <Field label="Accent Color">
                    <ColorPicker value={activeGame.color || '#e53e3e'} onChange={color => handleFieldChange('color', color)} />
                  </Field>
                </div>
              )}

              {/* ── Steps tab ── */}
              {activeTab === 'steps' && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Add step */}
                  <div style={{ ...styles.addStepRow, flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input style={{ ...styles.input, flex: 1 }} value={newStepText}
                        onChange={e => setNewStepText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addStep()}
                        placeholder="Add a new step…" />
                      <button style={styles.addStepBtn} onClick={addStep} disabled={!newStepText.trim()}>Add</button>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <div style={styles.locInputWrap}>
                        <MapPin size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <input style={{ ...styles.input, flex: 1, fontSize: 12, border: 'none', padding: '0', background: 'transparent', outline: 'none' }}
                          value={newStepLoc}
                          onChange={e => { setNewStepLoc(e.target.value); setNewLocOpen(true) }}
                          onFocus={() => setNewLocOpen(true)}
                          onBlur={() => setTimeout(() => setNewLocOpen(false), 150)}
                          placeholder="Location (optional)" />
                      </div>
                      {newLocOpen && getLocSuggestions(newStepLoc).length > 0 && (
                        <div style={styles.locDropdown}>
                          {getLocSuggestions(newStepLoc).map(s => (
                            <div key={s} style={styles.locItem} onMouseDown={() => { setNewStepLoc(s); setNewLocOpen(false) }}>{s}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Steps list */}
                  <div style={styles.stepsList}>
                    {(activeGame.steps || []).length === 0 ? (
                      <div style={styles.emptySteps}>No steps yet. Add some above.</div>
                    ) : (
                      (activeGame.steps || []).map((step, idx) => (
                        <div key={idx} style={styles.stepItem}>
                          {editingStepIdx === idx ? (
                            <div style={styles.stepEditArea}>
                              <textarea style={styles.stepEditInput} value={editingStepText}
                                onChange={e => setEditingStepText(e.target.value)} rows={3}
                                autoFocus />
                              {/* Location input */}
                              <div style={{ position: 'relative', marginTop: 4 }}>
                                <div style={styles.locInputWrap}>
                                  <MapPin size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                  <input style={{ ...styles.input, flex: 1, fontSize: 12, border: 'none', padding: '0', background: 'transparent', outline: 'none' }}
                                    value={locInput}
                                    onChange={e => { setLocInput(e.target.value); setEditingStepLoc(e.target.value); setLocOpen(true) }}
                                    onFocus={() => setLocOpen(true)}
                                    onBlur={() => setTimeout(() => setLocOpen(false), 150)}
                                    placeholder="Location (optional)" />
                                  {locInput && (
                                    <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 2px', display: 'flex' }}
                                      onMouseDown={() => { setLocInput(''); setEditingStepLoc('') }}>
                                      <X size={11} />
                                    </button>
                                  )}
                                </div>
                                {locOpen && getLocSuggestions(locInput).length > 0 && (
                                  <div style={styles.locDropdown}>
                                    {getLocSuggestions(locInput).map(s => (
                                      <div key={s} style={styles.locItem}
                                        onMouseDown={() => { setLocInput(s); setEditingStepLoc(s); setLocOpen(false) }}>
                                        {s}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                <button style={styles.saveStepBtn} onClick={saveEditStep}><Check size={12} /> Save</button>
                                <button style={styles.cancelStepBtn} onClick={() => { setEditingStepIdx(null); setLocInput('') }}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div style={styles.stepNum}>{idx + 1}</div>
                              <div style={styles.stepBody}>
                                <div style={styles.stepText}>{step}</div>
                                {(activeGame.stepLocs?.[idx] || activeGame.stepLocs?.[String(idx)]) && (
                                  <div style={styles.stepLoc}>
                                    <MapPin size={10} style={{ flexShrink: 0 }} />
                                    {activeGame.stepLocs[idx] || activeGame.stepLocs[String(idx)]}
                                  </div>
                                )}
                              </div>
                              <div style={styles.stepActions}>
                                <button style={styles.stepBtn} onClick={() => moveStep(idx, -1)} disabled={idx === 0} title="Move up"><ChevronUp size={12}/></button>
                                <button style={styles.stepBtn} onClick={() => moveStep(idx, 1)} disabled={idx === (activeGame.steps || []).length - 1} title="Move down"><ChevronDown size={12}/></button>
                                <button style={styles.stepBtn} onClick={() => startEditStep(idx)} title="Edit"><Pencil size={12}/></button>
                                <button style={{ ...styles.stepBtn, color: '#e53e3e' }} onClick={() => deleteStep(idx)} title="Delete"><X size={12}/></button>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ── Presets tab ── */}
              {activeTab === 'presets' && (
                <div style={styles.presetTab}>
                  <div style={styles.presetTabSection}>
                    <div style={styles.presetTabTitle}>Export</div>
                    {[
                      { label: 'Export Full Preset', desc: 'Game + steps + map + Pokédex', action: exportFull, icon: <Download size={14}/> },
                      { label: 'Export Map', desc: 'Map areas only', action: exportMap, icon: <Map size={14}/> },
                      { label: 'Export Steps', desc: 'Walkthrough steps only', action: exportSteps, icon: <Download size={14}/> },
                    ].map(({ label, desc, action, icon }) => (
                      <button key={label} style={styles.presetActionBtn} onClick={action} disabled={presetBusy}>
                        <span style={styles.presetActionIcon}>{icon}</span>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div style={styles.presetTabSection}>
                    <div style={styles.presetTabTitle}>Import</div>
                    {[
                      { label: 'Import Full Preset', desc: 'Replace game with preset data', action: importFull, icon: <Upload size={14}/> },
                      { label: 'Import Map', desc: 'Replace map data', action: importMap, icon: <Map size={14}/> },
                      { label: 'Import Steps', desc: 'Replace walkthrough steps', action: importSteps, icon: <Upload size={14}/> },
                    ].map(({ label, desc, action, icon }) => (
                      <button key={label} style={styles.presetActionBtn} onClick={action} disabled={presetBusy}>
                        <span style={styles.presetActionIcon}>{icon}</span>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
      <label style={{ width: 120, flexShrink: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</label>
      {children}
    </div>
  )
}

const skeletonStyle = {
  height: 14, borderRadius: 4, width: '100%',
  background: 'linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-hover, rgba(255,255,255,0.08)) 50%, var(--bg-tertiary) 75%)',
  backgroundSize: '400px 100%',
  animation: 'shimmer 1.3s infinite linear',
}

const styles = {
  container: { height: '100%', display: 'flex', overflow: 'hidden' },
  leftPanel: { width: 220, flexShrink: 0, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  leftHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 12px 10px', borderBottom: '1px solid var(--border-color)' },
  leftTitle: { fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 },
  addBtn: { background: 'var(--game-color)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 },
  gameList: { flex: 1, overflowY: 'auto', padding: '4px 0' },
  gameCard: { padding: '10px 12px', cursor: 'pointer', borderLeft: '4px solid transparent', borderBottom: '1px solid var(--border-color)', background: 'transparent', transition: 'background 0.1s' },
  gameCardActive: { background: 'var(--bg-hover)' },
  gameCardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  gameCardTitle: { fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  deleteBtn: { background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0 },
  gameCardMeta: { display: 'flex', gap: 8, marginTop: 3 },
  gameMeta: { fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: 4 },
  rightPanel: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  presetOverlay: { position: 'absolute', inset: 0, background: 'var(--bg-primary)', zIndex: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  presetPanel: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  presetPanelHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' },
  presetPanelContent: { flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 },
  rightTitle: { fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' },
  closeIconBtn: { background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', borderRadius: 6 },
  quickStartRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  quickBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 12, cursor: 'pointer', color: 'var(--text-primary)', transition: 'border-color 0.15s, background 0.15s' },
  quickIcon: { width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--game-color)' },
  quickLabel: { fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' },
  quickSub: { fontSize: 11, color: 'var(--text-muted)' },
  presetSectionLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 },
  refreshBtn: { background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center', borderRadius: 4, marginLeft: 2 },
  presetGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 },
  presetCard: { display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s, background 0.15s', color: 'var(--text-primary)' },
  presetCardTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  presetCardTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flex: 1 },
  presetCardDesc: { fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 },
  presetCardAuthor: { fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' },
  errorRow: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#fc8181', padding: '8px 0' },
  retryBtn: { background: 'transparent', border: '1px solid #fc8181', color: '#fc8181', borderRadius: 5, padding: '3px 10px', fontSize: 11, cursor: 'pointer' },
  presetTypeBadge: { fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: 4, textTransform: 'uppercase' },
  emptyState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', textAlign: 'center', padding: 40, gap: 8 },
  gameDetail: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  tabs: { display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', padding: '0 16px' },
  tab: { background: 'transparent', border: 'none', borderBottom: '2px solid transparent', color: 'var(--text-secondary)', padding: '10px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' },
  tabActive: { color: 'var(--game-color)', borderBottom: '2px solid var(--game-color)' },
  tabContent: { flex: 1, overflowY: 'auto', padding: '16px 20px' },
  fields: { display: 'flex', flexDirection: 'column' },
  input: { background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', padding: '6px 10px', fontSize: 13, outline: 'none', flex: 1 },
  addStepRow: { display: 'flex', gap: 8, padding: '12px 0 8px', flexShrink: 0 },
  addStepBtn: { background: 'var(--game-color)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  stepsList: {},
  emptySteps: { color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '32px 0' },
  stepItem: { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' },
  stepNum: { width: 22, height: 22, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-tertiary)', borderRadius: 4, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginTop: 1 },
  stepBody: { flex: 1, minWidth: 0 },
  stepText: { fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 },
  stepLoc: { display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-muted)', marginTop: 3 },
  locInputWrap: { display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '5px 10px' },
  stepActions: { display: 'flex', gap: 2, flexShrink: 0 },
  stepBtn: { background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '3px 5px', borderRadius: 4, fontSize: 11, display: 'flex', alignItems: 'center' },
  stepEditArea: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },
  stepEditInput: { background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', padding: '8px 10px', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit' },
  locDropdown: { position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 6, zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.4)', overflow: 'hidden', marginTop: 2 },
  locItem: { padding: '7px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' },
  saveStepBtn: { background: 'var(--game-color)', color: '#fff', border: 'none', borderRadius: 5, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 },
  cancelStepBtn: { background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 5, padding: '4px 10px', fontSize: 12, cursor: 'pointer' },
  presetTab: { display: 'flex', flexDirection: 'column', gap: 24 },
  presetTabSection: { display: 'flex', flexDirection: 'column', gap: 8 },
  presetTabTitle: { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  presetActionBtn: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-primary)', transition: 'all 0.15s', textAlign: 'left', width: '100%' },
  presetActionIcon: { width: 28, height: 28, borderRadius: 6, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--game-color)' },
}

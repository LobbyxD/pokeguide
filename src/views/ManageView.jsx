import React, { useState, useEffect } from 'react'
import { Plus, X, ChevronUp, ChevronDown, Check, Loader, Sparkles, Settings, Map, Download, Upload, Package, FolderOpen } from '../components/Icons.jsx'
import { mapData as defaultMapData } from '../data/index.js'
import { useDialog } from '../components/Dialog.jsx'

const SLUG_TO_TOTAL = {
  // Gen 1
  red: 151, blue: 151, yellow: 151, firered: 151, leafgreen: 151,
  // Gen 2
  gold: 251, silver: 251, crystal: 251, heartgold: 251, soulsilver: 251,
  // Gen 3
  ruby: 386, sapphire: 386, emerald: 386,
  // Gen 4
  diamond: 493, pearl: 493, platinum: 493,
  // Gen 5
  black: 649, white: 649, 'black-2': 649, 'white-2': 649,
  // Gen 6
  x: 721, y: 721, 'omega-ruby': 721, 'alpha-sapphire': 721,
  // Gen 7
  sun: 802, moon: 802, 'ultra-sun': 807, 'ultra-moon': 807,
  // Gen 8
  sword: 898, shield: 898, 'brilliant-diamond': 898, 'shining-pearl': 898,
  // Gen 9
  scarlet: 1025, violet: 1025,
}

const SLUG_TO_GEN = {
  // Gen 1
  red: 1, blue: 1, yellow: 1, firered: 1, leafgreen: 1,
  // Gen 2
  gold: 2, silver: 2, crystal: 2, heartgold: 2, soulsilver: 2,
  // Gen 3
  ruby: 3, sapphire: 3, emerald: 3,
  // Gen 4
  diamond: 4, pearl: 4, platinum: 4,
  // Gen 5
  black: 5, white: 5, 'black-2': 5, 'white-2': 5,
  // Gen 6
  x: 6, y: 6, 'omega-ruby': 6, 'alpha-sapphire': 6,
  // Gen 7
  sun: 7, moon: 7, 'ultra-sun': 7, 'ultra-moon': 7,
  // Gen 8
  sword: 8, shield: 8, 'brilliant-diamond': 8, 'shining-pearl': 8,
  // Gen 9
  scarlet: 9, violet: 9,
}

const GEN_TO_TOTAL = { 1: 151, 2: 251, 3: 386, 4: 493, 5: 649, 6: 721, 7: 807, 8: 898, 9: 1025 }

function detectGeneration(versionSlug) {
  if (!versionSlug) return null
  return SLUG_TO_GEN[versionSlug.toLowerCase().trim()] ?? null
}

function detectTotal(versionSlug, generation) {
  if (versionSlug) {
    const slug = versionSlug.toLowerCase().trim()
    if (SLUG_TO_TOTAL[slug] !== undefined) return SLUG_TO_TOTAL[slug]
  }
  return GEN_TO_TOTAL[generation] || 151
}

const GAME_TEMPLATE = {
  id: '',
  title: 'New Game',
  region: 'Kanto',
  generation: 1,
  color: '#e53e3e',
  pokedexFile: '',
  versionSlug: '',
  steps: [],
}

export default function ManageView({ games, selectedGame, onSaveGames, onSelectGame }) {
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
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiPromptText, setAiPromptText] = useState('')
  const [aiResult, setAiResult] = useState(null)
  const [addingNew, setAddingNew] = useState(false)
  const [presets, setPresets] = useState([])
  const [dataDir, setDataDir] = useState(null)
  const [presetBusy, setPresetBusy] = useState(false)

  // Load presets list and dataDir once
  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.listPresets().then(setPresets).catch(() => {})
    window.electronAPI.getPokemonDataDir().then(setDataDir).catch(() => {})
  }, [])

  const refreshPresets = () => {
    if (window.electronAPI) window.electronAPI.listPresets().then(setPresets).catch(() => {})
  }

  // Load map areas for the active game (for location autocomplete)
  useEffect(() => {
    if (!activeGame) { setMapAreas([]); return }
    try {
      const stored = localStorage.getItem(`pg_map_${activeGame.id}`)
      const areas = stored ? JSON.parse(stored).areas : defaultMapData[activeGame.id]?.areas
      setMapAreas(areas || [])
    } catch {
      setMapAreas(defaultMapData[activeGame.id]?.areas || [])
    }
  }, [activeGame?.id])

  // Auto-detect generation and totalPokemon from versionSlug
  useEffect(() => {
    if (!activeGame) return
    const updates = {}
    const detectedGen = detectGeneration(activeGame.versionSlug)
    if (detectedGen !== null && detectedGen !== activeGame.generation) {
      updates.generation = detectedGen
    }
    const gen = detectedGen ?? activeGame.generation
    const detectedTotal = detectTotal(activeGame.versionSlug, gen)
    if (detectedTotal !== activeGame.totalPokemon) {
      updates.totalPokemon = detectedTotal
    }
    if (Object.keys(updates).length > 0) {
      updateGame(activeGame.id, updates)
    }
  }, [activeGame?.id, activeGame?.versionSlug])

  const getLocSuggestions = (query) => {
    if (!query) return []
    const q = query.toLowerCase()
    return mapAreas.filter(a => a.name && a.name.toLowerCase().includes(q)).map(a => a.name).slice(0, 7)
  }

  const updateGame = (id, updates) => {
    const newGames = games.map(g => g.id === id ? { ...g, ...updates } : g)
    onSaveGames(newGames)
    if (activeGame?.id === id) {
      setActiveGame(prev => ({ ...prev, ...updates }))
    }
  }

  const addGame = () => {
    refreshPresets()
    setAddingNew(true)
  }

  const createBlankGame = () => {
    const id = `custom-game-${Date.now()}`
    const newGame = { ...GAME_TEMPLATE, id, title: 'New Game ' + (games.length + 1) }
    onSaveGames([...games, newGame])
    setActiveGame(newGame)
    setAddingNew(false)
  }

  const createFromPreset = async (preset) => {
    setPresetBusy(true)
    try {
      const id = `custom-game-${Date.now()}`
      const gameData = { ...GAME_TEMPLATE, ...preset.game, id }
      const newGames = [...games, gameData]
      onSaveGames(newGames)
      if (preset.map) {
        localStorage.setItem(`pg_map_${id}`, JSON.stringify(preset.map))
      }
      if (preset.pokedex && dataDir && gameData.pokedexFile) {
        const path = `${dataDir}/${gameData.pokedexFile}.json`
        await window.electronAPI.writeFile(path, JSON.stringify(preset.pokedex, null, 2))
        localStorage.removeItem(`pg_pokedex_${id}`)
      }
      setActiveGame(gameData)
      setAddingNew(false)
    } catch (e) {
      await alert(e.message, { title: 'Failed to Create Game', type: 'error' })
    }
    setPresetBusy(false)
  }

  const deleteGame = async (gameId) => {
    const ok = await confirm('This game and all its steps will be permanently removed.', {
      title: 'Delete Game',
      danger: true,
      confirmLabel: 'Delete',
    })
    if (!ok) return
    const newGames = games.filter(g => g.id !== gameId)
    onSaveGames(newGames)
    if (activeGame?.id === gameId) {
      setActiveGame(newGames[0] || null)
    }
  }

  const handleFieldChange = (field, value) => {
    if (!activeGame) return
    updateGame(activeGame.id, { [field]: value })
  }

  const addStep = () => {
    if (!newStepText.trim() || !activeGame) return
    const newSteps = [...(activeGame.steps || []), newStepText.trim()]
    updateGame(activeGame.id, { steps: newSteps })
    setNewStepText('')
  }

  const deleteStep = (idx) => {
    if (!activeGame) return
    const newSteps = activeGame.steps.filter((_, i) => i !== idx)
    // Shift stepLocs indices after the deleted one
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
    const tmp = steps[idx]
    steps[idx] = steps[newIdx]
    steps[newIdx] = tmp
    // Swap stepLocs alongside steps
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
    setEditingStepLoc(loc)
    setLocInput(loc)
  }

  const saveEditStep = () => {
    if (editingStepIdx === null || !activeGame) return
    const newSteps = activeGame.steps.map((s, i) => i === editingStepIdx ? editingStepText : s)
    const newStepLocs = { ...(activeGame.stepLocs || {}) }
    if (editingStepLoc.trim()) {
      newStepLocs[editingStepIdx] = editingStepLoc.trim()
    } else {
      delete newStepLocs[editingStepIdx]
    }
    updateGame(activeGame.id, { steps: newSteps, stepLocs: newStepLocs })
    setEditingStepIdx(null)
    setEditingStepText('')
    setEditingStepLoc('')
    setLocInput('')
  }

  const handleAiGenerate = async () => {
    if (!activeGame) return
    const prompt = `Generate a complete numbered step-by-step Pokemon game walkthrough for ${activeGame.title}. Each step should be on its own line starting with a number.`
    setAiGenerating(true)
    setAiResult(null)
    try {
      const text = await window.electronAPI.generateAiText(prompt)
      const lines = text.split('\n')
        .map(l => l.replace(/^\d+[\.\)]\s*/, '').trim())
        .filter(l => l.length >= 10)
      setAiResult(lines)
    } catch (e) {
      await alert(e.message, { title: 'AI Generation Failed', type: 'error' })
    }
    setAiGenerating(false)
  }

  const confirmAiResult = async () => {
    if (!aiResult || !activeGame) return
    const ok = await confirm(`Apply ${aiResult.length} AI-generated steps? This will replace all existing steps.`, {
      title: 'Apply AI Steps',
      confirmLabel: 'Apply',
    })
    if (ok) {
      updateGame(activeGame.id, { steps: aiResult })
      setAiResult(null)
    }
  }

  const selectAndSet = (game) => {
    setActiveGame(game)
    onSelectGame(game)
    setAddingNew(false)
  }

  // --- Export helpers ---
  const buildMapData = (gameId) => {
    try {
      const stored = localStorage.getItem(`pg_map_${gameId}`)
      if (stored) return JSON.parse(stored)
      const def = defaultMapData[gameId]
      return def ? { areas: def.areas, width: def.width, height: def.height } : null
    } catch { return null }
  }

  const exportFull = async () => {
    if (!activeGame || !window.electronAPI) return
    setPresetBusy(true)
    try {
      let pokedex = null
      if (dataDir && activeGame.pokedexFile) {
        pokedex = await window.electronAPI.readPokemonFile(dataDir, activeGame.pokedexFile + '.json')
      }
      const preset = {
        presetVersion: 1,
        type: 'full',
        name: activeGame.title,
        game: { ...activeGame },
        map: buildMapData(activeGame.id),
        steps: { steps: activeGame.steps || [], stepLocs: activeGame.stepLocs || {} },
        pokedex,
      }
      const safeName = activeGame.title.replace(/[^a-z0-9]/gi, '_')
      await window.electronAPI.exportPreset(preset, safeName)
      refreshPresets()
    } catch (e) { await alert(e.message, { title: 'Export Failed', type: 'error' }) }
    setPresetBusy(false)
  }

  const exportMap = async () => {
    if (!activeGame || !window.electronAPI) return
    const map = buildMapData(activeGame.id)
    if (!map) { await alert('No map data found for this game.', { title: 'Nothing to Export' }); return }
    const preset = { presetVersion: 1, type: 'map', name: activeGame.title + ' Map', game: { id: activeGame.id, title: activeGame.title }, map }
    const safeName = activeGame.title.replace(/[^a-z0-9]/gi, '_') + '_map'
    await window.electronAPI.exportPreset(preset, safeName)
    refreshPresets()
  }

  const exportSteps = async () => {
    if (!activeGame || !window.electronAPI) return
    if (!(activeGame.steps || []).length) { await alert('This game has no steps to export.', { title: 'Nothing to Export' }); return }
    const preset = {
      presetVersion: 1, type: 'steps', name: activeGame.title + ' Steps',
      game: { id: activeGame.id, title: activeGame.title },
      steps: { steps: activeGame.steps || [], stepLocs: activeGame.stepLocs || {} },
    }
    const safeName = activeGame.title.replace(/[^a-z0-9]/gi, '_') + '_steps'
    await window.electronAPI.exportPreset(preset, safeName)
    refreshPresets()
  }

  const exportPokedex = async () => {
    if (!activeGame || !window.electronAPI || !dataDir || !activeGame.pokedexFile) {
      await alert('Set a Pokédex File name for this game before exporting.', { title: 'Nothing to Export' })
      return
    }
    setPresetBusy(true)
    try {
      const pokedex = await window.electronAPI.readPokemonFile(dataDir, activeGame.pokedexFile + '.json')
      if (!pokedex) { await alert('No Pokédex data found. Generate it first.', { title: 'Nothing to Export' }); setPresetBusy(false); return }
      const preset = {
        presetVersion: 1, type: 'pokedex', name: activeGame.title + ' Pokédex',
        game: { id: activeGame.id, title: activeGame.title, pokedexFile: activeGame.pokedexFile, totalPokemon: activeGame.totalPokemon },
        pokedex,
      }
      const safeName = activeGame.title.replace(/[^a-z0-9]/gi, '_') + '_pokedex'
      await window.electronAPI.exportPreset(preset, safeName)
      refreshPresets()
    } catch (e) { await alert(e.message, { title: 'Export Failed', type: 'error' }) }
    setPresetBusy(false)
  }

  // --- Import helpers ---
  const importFull = async () => {
    if (!activeGame || !window.electronAPI) return
    const preset = await window.electronAPI.importPreset()
    if (!preset) return
    if (preset.type !== 'full') { await alert(`This file is a "${preset.type}" preset, not a full preset.`, { title: 'Wrong Preset Type' }); return }
    const merge = { ...(preset.game || {}), id: activeGame.id, title: activeGame.title }
    delete merge.steps
    delete merge.stepLocs
    if (preset.steps) merge.steps = preset.steps.steps || []
    if (preset.steps) merge.stepLocs = preset.steps.stepLocs || {}
    updateGame(activeGame.id, merge)
    if (preset.map) localStorage.setItem(`pg_map_${activeGame.id}`, JSON.stringify(preset.map))
    if (preset.pokedex && dataDir) {
      const pFile = merge.pokedexFile || activeGame.pokedexFile
      if (pFile) {
        await window.electronAPI.writeFile(`${dataDir}/${pFile}.json`, JSON.stringify(preset.pokedex, null, 2))
        localStorage.removeItem(`pg_pokedex_${activeGame.id}`)
      }
    }
    refreshPresets()
  }

  const importMap = async () => {
    if (!activeGame || !window.electronAPI) return
    const preset = await window.electronAPI.importPreset()
    if (!preset) return
    if (!preset.map) { await alert('This preset does not contain map data.', { title: 'No Map Data' }); return }
    localStorage.setItem(`pg_map_${activeGame.id}`, JSON.stringify(preset.map))
    setMapAreas(preset.map.areas || [])
  }

  const importSteps = async () => {
    if (!activeGame || !window.electronAPI) return
    const preset = await window.electronAPI.importPreset()
    if (!preset) return
    if (!preset.steps) { await alert('This preset does not contain step data.', { title: 'No Step Data' }); return }
    const ok = await confirm(`Replace all steps with ${(preset.steps.steps || []).length} imported steps?`, {
      title: 'Import Steps',
      confirmLabel: 'Import',
    })
    if (!ok) return
    updateGame(activeGame.id, { steps: preset.steps.steps || [], stepLocs: preset.steps.stepLocs || {} })
  }

  const importPokedex = async () => {
    if (!activeGame || !window.electronAPI || !dataDir) return
    const preset = await window.electronAPI.importPreset()
    if (!preset) return
    if (!preset.pokedex) { await alert('This preset does not contain Pokédex data.', { title: 'No Pokédex Data' }); return }
    const pFile = activeGame.pokedexFile
    if (!pFile) { await alert('Set a Pokédex File name for this game before importing.', { title: 'Missing Config' }); return }
    await window.electronAPI.writeFile(`${dataDir}/${pFile}.json`, JSON.stringify(preset.pokedex, null, 2))
    localStorage.removeItem(`pg_pokedex_${activeGame.id}`)
    await alert(`${preset.pokedex.length} Pokémon imported successfully.`, { title: 'Pokédex Imported', type: 'success' })
  }

  return (
    <div style={styles.container}>
      {/* Left panel */}
      <div style={styles.leftPanel}>
        <div style={styles.leftHeader}>
          <span style={styles.leftTitle}>Games</span>
          <button style={{ ...styles.addBtn, display: 'flex', alignItems: 'center', gap: 4, ...(addingNew ? { opacity: 0.6 } : {}) }} onClick={addGame}><Plus size={12} /> Add</button>
        </div>
        <div style={styles.gameList}>
          {games.map(game => (
            <div
              key={game.id}
              style={{
                ...styles.gameCard,
                ...(activeGame?.id === game.id ? styles.gameCardActive : {}),
                borderLeft: `4px solid ${game.color}`,
              }}
              onClick={() => selectAndSet(game)}
            >
              <div style={styles.gameCardHeader}>
                <span style={styles.gameCardTitle}>{game.title}</span>
                <button
                  style={styles.deleteBtn}
                  onClick={(e) => { e.stopPropagation(); deleteGame(game.id) }}
                  title="Delete game"
                ><X size={13} /></button>
              </div>
              <div style={styles.gameCardMeta}>
                <span style={styles.gameMeta}>{game.region}</span>
                <span style={styles.gameMeta}>{(game.steps || []).length} steps</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ ...styles.rightPanel, position: 'relative' }}>

        {/* Preset picker — rendered as overlay so the form behind stays mounted */}
        {addingNew && (
          <div style={styles.presetOverlay}>
            <div style={styles.presetPanel}>
              <div style={styles.presetPanelHeader}>
                <span style={styles.rightTitle}>New Game</span>
                <button style={styles.cancelStepBtn} onClick={() => setAddingNew(false)}><X size={13} /></button>
              </div>
              <div style={styles.presetPanelContent}>
                {/* Blank game */}
                <button style={styles.blankPresetBtn} onClick={createBlankGame}>
                  <Plus size={18} />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>Blank Game</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Start with no data</span>
                </button>

                {/* Preset list */}
                {presets.length > 0 && (
                  <>
                    <div style={styles.presetSectionLabel}>Saved Presets</div>
                    <div style={styles.presetGrid}>
                      {presets.map(p => (
                        <button
                          key={p.filename}
                          style={styles.presetCard}
                          disabled={presetBusy}
                          onClick={async () => {
                            const data = await window.electronAPI.readPreset(p.filename)
                            if (data) createFromPreset(data)
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Package size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, fontSize: 13, flex: 1, textAlign: 'left' }}>{p.title || p.name}</span>
                            <span style={styles.presetTypeBadge}>{p.type}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Import from file */}
                <div style={styles.presetSectionLabel}>Import from File</div>
                <button
                  style={{ ...styles.blankPresetBtn, flexDirection: 'row', gap: 10, justifyContent: 'flex-start', padding: '14px 16px' }}
                  disabled={presetBusy}
                  onClick={async () => {
                    const preset = await window.electronAPI.importPreset()
                    if (preset) createFromPreset(preset)
                  }}
                >
                  <Upload size={16} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Import Preset File</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Load a .pgpreset file from anywhere</div>
                  </div>
                </button>

                {presets.length > 0 && (
                  <button
                    style={{ ...styles.blankPresetBtn, flexDirection: 'row', gap: 10, justifyContent: 'flex-start', padding: '10px 16px', opacity: 0.7 }}
                    onClick={() => window.electronAPI?.getPresetsDir().then(dir => window.electronAPI.openPath(dir))}
                  >
                    <FolderOpen size={14} />
                    <span style={{ fontSize: 12 }}>Open presets folder</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {activeGame ? (
          <>
            <div style={styles.rightHeader}>
              <span style={styles.rightTitle}>{activeGame.title}</span>
              <div style={styles.tabs}>
                {['game', 'steps'].map(tab => (
                  <button
                    key={tab}
                    style={{
                      ...styles.tab,
                      ...(activeTab === tab ? styles.tabActive : {}),
                    }}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    {tab === 'steps' && ` (${(activeGame.steps || []).length})`}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.rightContent}>
              {activeTab === 'game' && (
                <div style={styles.gameForm}>
                  <div style={styles.formGrid}>
                    <div style={styles.formField}>
                      <label style={styles.label}>Title</label>
                      <input
                        style={styles.input}
                        value={activeGame.title}
                        onChange={e => handleFieldChange('title', e.target.value)}
                      />
                    </div>
                    <div style={styles.formField}>
                      <label style={styles.label}>Region</label>
                      <input
                        style={styles.input}
                        value={activeGame.region}
                        onChange={e => handleFieldChange('region', e.target.value)}
                      />
                    </div>
                    <div style={styles.formField}>
                      <label style={styles.label}>Game Color</label>
                      <div style={styles.colorRow}>
                        <input
                          type="color"
                          value={activeGame.color}
                          onChange={e => handleFieldChange('color', e.target.value)}
                          style={styles.colorPicker}
                        />
                        <input
                          style={{ ...styles.input, flex: 1 }}
                          value={activeGame.color}
                          onChange={e => handleFieldChange('color', e.target.value)}
                          placeholder="#e53e3e"
                        />
                      </div>
                    </div>
                    <div style={styles.formField}>
                      <label style={styles.label}>Version Slug</label>
                      <input
                        style={styles.input}
                        value={activeGame.versionSlug || ''}
                        onChange={e => handleFieldChange('versionSlug', e.target.value)}
                        placeholder="firered"
                      />
                    </div>
                    <div style={styles.formField}>
                      <label style={styles.label}>Pokédex File</label>
                      <input
                        style={styles.input}
                        value={activeGame.pokedexFile || ''}
                        onChange={e => handleFieldChange('pokedexFile', e.target.value)}
                        placeholder="pokemon-fire-red"
                      />
                    </div>
                    <div style={styles.formField}>
                      <label style={styles.label}>Total Pokémon</label>
                      <div style={{ ...styles.input, color: 'var(--text-muted)', cursor: 'default', userSelect: 'none' }}>
                        {detectTotal(activeGame.versionSlug, detectGeneration(activeGame.versionSlug) ?? activeGame.generation)}
                        <span style={{ fontSize: 11, marginLeft: 6, opacity: 0.6 }}>auto-detected</span>
                      </div>
                    </div>
                    <div style={styles.formField}>
                      <label style={styles.label}>Generation</label>
                      <div style={{ ...styles.input, color: 'var(--text-muted)', cursor: 'default', userSelect: 'none' }}>
                        {activeGame.generation || 1}
                        <span style={{ fontSize: 11, marginLeft: 6, opacity: 0.6 }}>auto-detected</span>
                      </div>
                    </div>
                  </div>

                  {/* Export / Import */}
                  <div style={styles.exportSection}>
                    <div style={styles.exportRow}>
                      <span style={styles.exportLabel}>Export</span>
                      <div style={styles.exportBtns}>
                        <button style={styles.exportBtn} onClick={exportFull} disabled={presetBusy} title="Export everything as a full preset">
                          <Download size={11} /> Full
                        </button>
                        <button style={styles.exportBtn} onClick={exportMap} disabled={presetBusy} title="Export map + areas">
                          <Download size={11} /> Map
                        </button>
                        <button style={styles.exportBtn} onClick={exportSteps} disabled={presetBusy} title="Export steps + locations">
                          <Download size={11} /> Steps
                        </button>
                        <button style={styles.exportBtn} onClick={exportPokedex} disabled={presetBusy} title="Export Pokédex data">
                          <Download size={11} /> Pokédex
                        </button>
                      </div>
                    </div>
                    <div style={styles.exportRow}>
                      <span style={styles.exportLabel}>Import</span>
                      <div style={styles.exportBtns}>
                        <button style={styles.importBtn} onClick={importFull} disabled={presetBusy} title="Import full preset into this game">
                          <Upload size={11} /> Full
                        </button>
                        <button style={styles.importBtn} onClick={importMap} disabled={presetBusy} title="Replace map data">
                          <Upload size={11} /> Map
                        </button>
                        <button style={styles.importBtn} onClick={importSteps} disabled={presetBusy} title="Replace steps">
                          <Upload size={11} /> Steps
                        </button>
                        <button style={styles.importBtn} onClick={importPokedex} disabled={presetBusy} title="Replace Pokédex data">
                          <Upload size={11} /> Pokédex
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Preview */}
                  <div style={styles.previewCard}>
                    <div style={{ ...styles.previewAccent, background: activeGame.color }} />
                    <div style={styles.previewInfo}>
                      <div style={styles.previewTitle}>{activeGame.title}</div>
                      <div style={styles.previewMeta}>{activeGame.region} • Gen {activeGame.generation}</div>
                    </div>
                    <div style={{ ...styles.previewBadge, background: activeGame.color + '33', color: activeGame.color }}>
                      {(activeGame.steps || []).length} steps
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'steps' && (
                <div style={styles.stepsTab}>
                  {/* AI Generate */}
                  <div style={styles.aiSection}>
                    <div style={styles.aiHeader}>
                      <span style={styles.aiTitle}>AI Generate Steps</span>
                      <button
                        style={styles.aiBtn}
                        onClick={handleAiGenerate}
                        disabled={aiGenerating}
                      >
                        {aiGenerating
                          ? <><Loader size={12} /> Generating...</>
                          : <><Sparkles size={12} /> Generate with AI</>
                        }
                      </button>
                    </div>
                    {aiResult && (
                      <div style={styles.aiResult}>
                        <div style={styles.aiResultHeader}>
                          <span style={{ fontSize: 13 }}>Preview ({aiResult.length} steps)</span>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button style={styles.aiConfirmBtn} onClick={confirmAiResult}>Apply</button>
                            <button style={styles.aiCancelBtn} onClick={() => setAiResult(null)}>Discard</button>
                          </div>
                        </div>
                        <div style={styles.aiPreview}>
                          {aiResult.slice(0, 5).map((s, i) => (
                            <div key={i} style={styles.aiPreviewStep}>{i + 1}. {s}</div>
                          ))}
                          {aiResult.length > 5 && (
                            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                              ...and {aiResult.length - 5} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Steps list */}
                  <div style={styles.stepsList}>
                    {(activeGame.steps || []).map((step, idx) => (
                      <div key={idx} style={styles.stepRow}>
                        {editingStepIdx === idx ? (
                          <div style={styles.stepEditRow}>
                            <span style={styles.stepIdxBadge}>{idx + 1}</span>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <textarea
                                style={styles.stepTextarea}
                                value={editingStepText}
                                onChange={e => setEditingStepText(e.target.value)}
                                autoFocus
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEditStep() }
                                  if (e.key === 'Escape') setEditingStepIdx(null)
                                }}
                              />
                              {/* Map location picker */}
                              <div style={{ position: 'relative' }}>
                                <div style={styles.locInputWrapper}>
                                  <Map size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                  <input
                                    style={styles.locInput}
                                    placeholder={mapAreas.length ? 'Map location...' : 'No map data for this game'}
                                    value={locInput}
                                    disabled={!mapAreas.length}
                                    onChange={e => { setLocInput(e.target.value); setEditingStepLoc(e.target.value); setLocOpen(true) }}
                                    onFocus={() => setLocOpen(true)}
                                    onBlur={() => setTimeout(() => setLocOpen(false), 120)}
                                    onKeyDown={e => { if (e.key === 'Escape') { setLocInput(''); setEditingStepLoc(''); setLocOpen(false) } }}
                                  />
                                  {editingStepLoc && (
                                    <button
                                      style={styles.locClearBtn}
                                      onMouseDown={e => { e.preventDefault(); setEditingStepLoc(''); setLocInput('') }}
                                      title="Clear location"
                                    ><X size={10} /></button>
                                  )}
                                </div>
                                {locOpen && getLocSuggestions(locInput).length > 0 && (
                                  <div style={styles.locDropdown}>
                                    {getLocSuggestions(locInput).map(name => (
                                      <button
                                        key={name}
                                        style={styles.locDropdownItem}
                                        onMouseDown={e => { e.preventDefault(); setEditingStepLoc(name); setLocInput(name); setLocOpen(false) }}
                                      >{name}</button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                              <button style={{ ...styles.saveStepBtn, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={saveEditStep}><Check size={12} /></button>
                              <button style={{ ...styles.cancelStepBtn, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setEditingStepIdx(null)}><X size={12} /></button>
                            </div>
                          </div>
                        ) : (
                          <div style={styles.stepViewRow} onClick={() => startEditStep(idx)}>
                            <span style={styles.stepIdxBadge}>{idx + 1}</span>
                            <div style={{ flex: 1 }}>
                              <span style={styles.stepText}>{step}</span>
                              {activeGame.stepLocs?.[idx] && (
                                <div style={styles.stepLocChip}>
                                  <Map size={10} style={{ flexShrink: 0 }} />
                                  {activeGame.stepLocs[idx]}
                                </div>
                              )}
                            </div>
                            <div style={styles.stepActions} onClick={e => e.stopPropagation()}>
                              <button style={{ ...styles.stepActionBtn, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => moveStep(idx, -1)} disabled={idx === 0} title="Move up"><ChevronUp size={12} /></button>
                              <button style={{ ...styles.stepActionBtn, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => moveStep(idx, 1)} disabled={idx === activeGame.steps.length - 1} title="Move down"><ChevronDown size={12} /></button>
                              <button style={{ ...styles.stepDeleteBtn, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => deleteStep(idx)} title="Delete"><X size={12} /></button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add step */}
                  <div style={styles.addStepRow}>
                    <input
                      style={styles.addStepInput}
                      placeholder="Add a new step..."
                      value={newStepText}
                      onChange={e => setNewStepText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addStep()}
                    />
                    <button style={styles.addStepBtn} onClick={addStep}>Add</button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={styles.noGame}>
            <div style={{ fontSize: 40, marginBottom: 12, color: 'var(--text-muted)' }}><Settings size={40} /></div>
            <div style={{ fontWeight: 600 }}>No game selected</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>
              Select a game or click Add to get started
            </div>
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
    overflow: 'hidden',
  },
  leftPanel: {
    width: 260,
    background: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    flexShrink: 0,
  },
  leftHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid var(--border-color)',
    flexShrink: 0,
  },
  leftTitle: {
    fontSize: 14,
    fontWeight: 700,
  },
  addBtn: {
    background: 'var(--game-color)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '5px 12px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  gameList: {
    flex: 1,
    overflowY: 'auto',
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  gameCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 6,
    padding: '10px 12px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  gameCardActive: {
    background: 'var(--bg-hover)',
    borderColor: 'var(--game-color)',
  },
  gameCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gameCardTitle: {
    fontSize: 13,
    fontWeight: 600,
    flex: 1,
  },
  deleteBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: 16,
    padding: 0,
  },
  gameCardMeta: {
    display: 'flex',
    gap: 8,
    marginTop: 4,
  },
  gameMeta: {
    fontSize: 11,
    color: 'var(--text-muted)',
    background: 'var(--bg-tertiary)',
    padding: '1px 6px',
    borderRadius: 8,
  },
  rightPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  rightHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    borderBottom: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  rightTitle: {
    fontSize: 16,
    fontWeight: 700,
  },
  tabs: {
    display: 'flex',
    background: 'var(--bg-primary)',
    borderRadius: 8,
    padding: 3,
    border: '1px solid var(--border-color)',
    gap: 2,
  },
  tab: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    borderRadius: 6,
    padding: '5px 14px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  tabActive: {
    background: 'var(--game-color)',
    color: '#fff',
  },
  rightContent: {
    flex: 1,
    overflow: 'auto',
    padding: 20,
  },
  gameForm: {},
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 14,
    marginBottom: 20,
  },
  formField: {},
  label: {
    display: 'block',
    fontSize: 11,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  input: {
    width: '100%',
    padding: '7px 10px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 6,
    color: 'var(--text-primary)',
    fontSize: 13,
  },
  colorRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  colorPicker: {
    width: 36,
    height: 36,
    padding: 2,
    background: 'transparent',
    border: '1px solid var(--border-color)',
    borderRadius: 6,
    cursor: 'pointer',
  },
  previewCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 10,
    padding: 16,
    overflow: 'hidden',
  },
  previewAccent: {
    width: 4,
    height: 48,
    borderRadius: 2,
    flexShrink: 0,
  },
  previewInfo: {
    flex: 1,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: 700,
  },
  previewMeta: {
    fontSize: 12,
    color: 'var(--text-muted)',
    marginTop: 2,
  },
  previewBadge: {
    padding: '4px 12px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
  },
  // Steps tab
  stepsTab: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  aiSection: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 10,
    padding: 14,
  },
  aiHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiTitle: {
    fontSize: 13,
    fontWeight: 600,
  },
  aiBtn: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '6px 14px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  aiResult: {
    marginTop: 12,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  aiResultHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: '1px solid var(--border-color)',
    background: 'var(--bg-tertiary)',
  },
  aiConfirmBtn: {
    background: '#38a169',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '4px 12px',
    cursor: 'pointer',
    fontSize: 12,
  },
  aiCancelBtn: {
    background: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    padding: '4px 12px',
    cursor: 'pointer',
    fontSize: 12,
  },
  aiPreview: {
    padding: 12,
  },
  aiPreviewStep: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    marginBottom: 4,
  },
  stepsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    maxHeight: 400,
    overflowY: 'auto',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
  },
  stepRow: {
    borderBottom: '1px solid var(--border-color)',
  },
  stepViewRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '8px 10px',
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  stepEditRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '6px 10px',
    background: 'var(--bg-hover)',
  },
  stepIdxBadge: {
    fontSize: 11,
    color: 'var(--text-muted)',
    background: 'var(--bg-tertiary)',
    borderRadius: 8,
    padding: '1px 6px',
    flexShrink: 0,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
  },
  stepTextarea: {
    flex: 1,
    padding: '4px 8px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--game-color)',
    borderRadius: 4,
    color: 'var(--text-primary)',
    fontSize: 12,
    resize: 'vertical',
    minHeight: 60,
    outline: 'none',
  },
  stepActions: {
    display: 'flex',
    gap: 4,
    opacity: 0,
    transition: 'opacity 0.15s',
    flexShrink: 0,
  },
  stepActionBtn: {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    color: 'var(--text-muted)',
    width: 24,
    height: 24,
    cursor: 'pointer',
    fontSize: 11,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDeleteBtn: {
    background: '#e53e3e22',
    border: '1px solid #e53e3e44',
    borderRadius: 4,
    color: '#e53e3e',
    width: 24,
    height: 24,
    cursor: 'pointer',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveStepBtn: {
    background: '#38a169',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: 12,
    flexShrink: 0,
  },
  cancelStepBtn: {
    background: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: 12,
    flexShrink: 0,
  },
  addStepRow: {
    display: 'flex',
    gap: 8,
  },
  addStepInput: {
    flex: 1,
    padding: '8px 12px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 6,
    color: 'var(--text-primary)',
    fontSize: 13,
    outline: 'none',
  },
  addStepBtn: {
    background: 'var(--game-color)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  noGame: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--text-secondary)',
    textAlign: 'center',
  },
  locInputWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    padding: '3px 6px',
  },
  locInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: 11,
    outline: 'none',
    minWidth: 0,
  },
  locClearBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  locDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    zIndex: 50,
    maxHeight: 160,
    overflowY: 'auto',
    boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
  },
  locDropdownItem: {
    display: 'block',
    width: '100%',
    padding: '6px 10px',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    fontSize: 12,
    textAlign: 'left',
    cursor: 'pointer',
  },
  stepLocChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
    background: 'var(--game-color)18',
    color: 'var(--game-color)',
    border: '1px solid var(--game-color)33',
    borderRadius: 8,
    padding: '1px 7px',
    fontSize: 10,
    fontWeight: 500,
  },
  // Export/Import section
  exportSection: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 10,
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginBottom: 16,
  },
  exportRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  exportLabel: {
    fontSize: 11,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: 600,
    width: 48,
    flexShrink: 0,
  },
  exportBtns: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  exportBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 5,
    color: 'var(--text-secondary)',
    padding: '5px 10px',
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
  },
  importBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 5,
    color: 'var(--game-color)',
    padding: '5px 10px',
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
  },
  // Preset picker overlay
  presetOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'var(--bg-primary)',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  presetPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  presetPanelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    borderBottom: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  presetPanelContent: {
    flex: 1,
    overflowY: 'auto',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  blankPresetBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    background: 'var(--bg-card)',
    border: '2px dashed var(--border-color)',
    borderRadius: 10,
    padding: '20px 16px',
    cursor: 'pointer',
    color: 'var(--text-primary)',
    transition: 'border-color 0.15s, background 0.15s',
    width: '100%',
    textAlign: 'center',
  },
  presetSectionLabel: {
    fontSize: 11,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: 600,
    marginTop: 6,
  },
  presetGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  presetCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '12px 14px',
    cursor: 'pointer',
    color: 'var(--text-primary)',
    width: '100%',
    transition: 'border-color 0.15s, background 0.15s',
  },
  presetTypeBadge: {
    fontSize: 10,
    padding: '2px 7px',
    background: 'var(--bg-tertiary)',
    borderRadius: 8,
    color: 'var(--text-muted)',
    fontWeight: 600,
    textTransform: 'uppercase',
    flexShrink: 0,
  },
}

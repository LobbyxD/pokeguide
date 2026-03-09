import React, { useState, useEffect } from 'react'
import { Plus, X, ChevronUp, ChevronDown, Check, Loader, Sparkles, Settings, Map } from '../components/Icons.jsx'
import { mapData as defaultMapData } from '../data/index.js'

const GAME_TEMPLATE = {
  id: '',
  title: 'New Game',
  region: 'Kanto',
  generation: 1,
  color: '#e53e3e',
  pokedexFile: '',
  totalPokemon: 151,
  versionSlug: '',
  steps: [],
}

export default function ManageView({ games, selectedGame, onSaveGames, onSelectGame }) {
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
    const id = `custom-game-${Date.now()}`
    const newGame = { ...GAME_TEMPLATE, id, title: 'New Game ' + (games.length + 1) }
    onSaveGames([...games, newGame])
    setActiveGame(newGame)
  }

  const deleteGame = (gameId) => {
    if (!window.confirm('Delete this game? This cannot be undone.')) return
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
      alert('AI generation failed: ' + e.message)
    }
    setAiGenerating(false)
  }

  const confirmAiResult = () => {
    if (!aiResult || !activeGame) return
    if (window.confirm(`Replace all steps with ${aiResult.length} AI-generated steps?`)) {
      updateGame(activeGame.id, { steps: aiResult })
      setAiResult(null)
    }
  }

  const selectAndSet = (game) => {
    setActiveGame(game)
    onSelectGame(game)
  }

  return (
    <div style={styles.container}>
      {/* Left panel */}
      <div style={styles.leftPanel}>
        <div style={styles.leftHeader}>
          <span style={styles.leftTitle}>Games</span>
          <button style={{ ...styles.addBtn, display: 'flex', alignItems: 'center', gap: 4 }} onClick={addGame}><Plus size={12} /> Add</button>
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
      <div style={styles.rightPanel}>
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
                      <input
                        type="number"
                        style={styles.input}
                        value={activeGame.totalPokemon || 151}
                        onChange={e => handleFieldChange('totalPokemon', parseInt(e.target.value))}
                      />
                    </div>
                    <div style={styles.formField}>
                      <label style={styles.label}>Generation</label>
                      <input
                        type="number"
                        style={styles.input}
                        value={activeGame.generation || 1}
                        onChange={e => handleFieldChange('generation', parseInt(e.target.value))}
                      />
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
              Select a game or add a new one
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
}

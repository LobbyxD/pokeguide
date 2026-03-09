import React, { useState, useEffect, useRef, useCallback } from 'react'
import { mapData as defaultMapData } from '../data/index.js'
import { stepLocations } from '../data/index.js'
import MapEditor from '../components/MapEditor.jsx'
import { ZoomIn, ZoomOut, Home, RotateCw, ArrowLeftRight, Layers, Plus, Pencil, Type, ChevronRight } from '../components/Icons.jsx'
import { writeStorage } from '../utils/store.js'

const AREA_COLORS = {
  Town: '#f6e05e',
  City: '#4299e1',
  Route: '#68d391',
  Cave: '#a0aec0',
  Sea: '#63b3ed',
  Island: '#fc8181',
  Forest: '#38a169',
  Building: '#d6bcfa',
  Other: '#fbd38d',
}

export default function MapView({ game, onNavigateToPokemon }) {
  const [scale, setScale] = useState(0.35)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState(null)
  const [rotation, setRotation] = useState(0)
  const [mirrored, setMirrored] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isHD, setIsHD] = useState(false)
  const [selectedArea, setSelectedArea] = useState(null)
  const [hoveredArea, setHoveredArea] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [searchQuery, setSearchQuery] = useState('')
  const [showLegend, setShowLegend] = useState(true)
  const [showLabels, setShowLabels] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [customMapData, setCustomMapData] = useState(null)
  const [naturalImageSize, setNaturalImageSize] = useState(null)

  const containerRef = useRef(null)
  const mapCanvasRef = useRef(null)
  const svgRef = useRef(null)

  const gameMapData = customMapData || defaultMapData[game?.id]
  const areas = gameMapData?.areas || []
  // Use detected natural image size if stored dimensions don't match — prevents stretching
  const mapWidth = naturalImageSize?.width || gameMapData?.width || 1800
  const mapHeight = naturalImageSize?.height || gameMapData?.height || 1766

  // Current step — reactive state kept in sync with localStorage
  const [currentStepIdx, setCurrentStepIdx] = useState(() =>
    game ? parseInt(localStorage.getItem(`pg_step_progress_${game.id}`) || '0') : 0
  )
  useEffect(() => {
    setCurrentStepIdx(game ? parseInt(localStorage.getItem(`pg_step_progress_${game.id}`) || '0') : 0)
  }, [game?.id])

  const saveStep = (idx) => {
    setCurrentStepIdx(idx)
    if (game) writeStorage(`pg_step_progress_${game.id}`, String(idx))
  }

  const steps = game?.steps || []
  const currentStep = steps[currentStepIdx] || null
  const currentStepLoc = game && stepLocations[game.id] ? stepLocations[game.id][currentStepIdx + 1] : null

  // Load custom map data
  useEffect(() => {
    if (!game) return
    try {
      const stored = localStorage.getItem(`pg_map_${game.id}`)
      if (stored) setCustomMapData(JSON.parse(stored))
      else setCustomMapData(null)
    } catch {
      setCustomMapData(null)
    }
    setNaturalImageSize(null) // reset natural size when game changes
  }, [game?.id])

  // Determine which areas match search (by name OR pokemon)
  const getMatchingAreas = useCallback(() => {
    if (!searchQuery) return { matched: new Set(), mode: null }
    const q = searchQuery.toLowerCase()
    const byName = new Set(areas.filter(a => a.name.toLowerCase().includes(q)).map(a => a.id))
    const byPokemon = new Set(
      areas.filter(a => (a.pokemon || []).some(p => p.toLowerCase().includes(q))).map(a => a.id)
    )
    if (byName.size > 0) return { matched: byName, mode: 'area' }
    if (byPokemon.size > 0) return { matched: byPokemon, mode: 'pokemon' }
    return { matched: new Set(), mode: 'none' }
  }, [searchQuery, areas])

  const { matched: matchedIds, mode: searchMode } = getMatchingAreas()

  const getAreaVisuals = (area) => {
    const isSelected = selectedArea?.id === area.id
    const isCurrentLoc = area.id === currentStepLoc
    const color = AREA_COLORS[area.type] || '#a0aec0'

    if (isSelected) return { opacity: 1, fill: 'var(--highlight-fill)', stroke: 'var(--highlight-stroke)', strokeWidth: 3 }
    if (isCurrentLoc) return { opacity: 1, fill: 'rgba(246,173,85,0.35)', stroke: 'var(--quest-marker-color)', strokeWidth: 3 }

    if (searchQuery) {
      const isMatch = matchedIds.has(area.id)
      return { opacity: isMatch ? 1 : 0.12, fill: isMatch ? color + '77' : color + '22', stroke: isMatch ? color : color + '44', strokeWidth: isMatch ? 2 : 1 }
    }
    if (selectedArea) return { opacity: 0.3, fill: color + '22', stroke: color + '55', strokeWidth: 1 }
    return { opacity: 0.45, fill: color + '33', stroke: color + '88', strokeWidth: 1.5 }
  }

  const mapImage = isHD ? (gameMapData?.imageHD || gameMapData?.image) : gameMapData?.image

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.1, Math.min(5, scale * delta))
    const scaleChange = newScale / scale
    setPan(prev => ({
      x: mouseX - scaleChange * (mouseX - prev.x),
      y: mouseY - scaleChange * (mouseY - prev.y),
    }))
    setScale(newScale)
  }, [scale])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const handleMouseDown = (e) => {
    if (e.button !== 0) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e) => {
    if (!isDragging || !dragStart) return
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setDragStart(null)
  }

  const handleAreaClick = (e, area) => {
    e.stopPropagation()
    setSelectedArea(area.id === selectedArea?.id ? null : area)
  }

  const handleAreaHover = (e, area) => {
    setHoveredArea(area)
    setTooltipPos({ x: e.clientX, y: e.clientY })
  }

  const handleAreaLeave = () => setHoveredArea(null)

  const handleMouseMoveTooltip = (e) => {
    if (hoveredArea) setTooltipPos({ x: e.clientX, y: e.clientY })
  }

  // Rotate 90° while keeping the current screen center fixed on the same map point
  const rotate = () => {
    const el = mapCanvasRef.current
    const cW = el?.clientWidth || 800
    const cH = el?.clientHeight || 600

    const newRotDeg = (rotation + 90) % 360
    const r1 = rotation * Math.PI / 180
    const r2 = newRotDeg * Math.PI / 180

    // Inverse current transform to find map point at screen center
    const dx = (cW / 2 - pan.x) / scale
    const dy = (cH / 2 - pan.y) / scale
    const mx = dx * Math.cos(-r1) - dy * Math.sin(-r1)
    const my = dx * Math.sin(-r1) + dy * Math.cos(-r1)

    // New pan so same map point stays at screen center with new rotation
    const newPanX = cW / 2 - scale * (mx * Math.cos(r2) - my * Math.sin(r2))
    const newPanY = cH / 2 - scale * (mx * Math.sin(r2) + my * Math.cos(r2))

    setIsAnimating(true)
    setRotation(newRotDeg)
    setPan({ x: newPanX, y: newPanY })
    setTimeout(() => setIsAnimating(false), 320)
  }

  // Mirror horizontally while keeping screen center on the same map point
  const toggleMirror = () => {
    const el = mapCanvasRef.current
    const cW = el?.clientWidth || 800
    // Mirroring flips x around pan.x, so new pan.x = 2*cx - old pan.x
    setIsAnimating(true)
    setMirrored(m => !m)
    setPan(prev => ({ x: 2 * (cW / 2) - prev.x, y: prev.y }))
    setTimeout(() => setIsAnimating(false), 320)
  }

  const zoomIn = () => setScale(s => Math.min(s * 1.2, 5))
  const zoomOut = () => setScale(s => Math.max(s * 0.8, 0.1))
  const zoomReset = () => { setScale(0.35); setPan({ x: 0, y: 0 }) }

  const getTransform = () => {
    let t = `translate(${pan.x}px, ${pan.y}px) scale(${scale})`
    if (rotation) t += ` rotate(${rotation}deg)`
    if (mirrored) t += ' scaleX(-1)'
    return t
  }

  const polygonToStr = (polygon) => polygon.map(p => p.join(',')).join(' ')

  const getAreaCenter = (polygon) => {
    if (!polygon || polygon.length === 0) return { x: 0, y: 0 }
    const cx = polygon.reduce((s, p) => s + p[0], 0) / polygon.length
    const cy = polygon.reduce((s, p) => s + p[1], 0) / polygon.length
    return { x: cx, y: cy }
  }

  // Focus map on an area by name or id
  const focusOnArea = useCallback((areaNameOrId) => {
    const target = areas.find(a => a.name === areaNameOrId || a.id === areaNameOrId)
    if (!target || !target.polygon || target.polygon.length === 0) return

    setSelectedArea(target)

    const xs = target.polygon.map(p => p[0])
    const ys = target.polygon.map(p => p[1])
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const areaW = Math.max(maxX - minX, 50)
    const areaH = Math.max(maxY - minY, 50)

    const el = mapCanvasRef.current
    const containerW = el?.clientWidth || 800
    const containerH = el?.clientHeight || 600

    const targetScale = Math.min(2.5, Math.max(0.4, Math.min(
      (containerW * 0.55) / areaW,
      (containerH * 0.55) / areaH
    )))

    setIsAnimating(true)
    setPan({ x: containerW / 2 - centerX * targetScale, y: containerH / 2 - centerY * targetScale })
    setScale(targetScale)
    setTimeout(() => setIsAnimating(false), 350)
  }, [areas])

  const handleSaveMapEditor = (data) => {
    const base = gameMapData || { areas: [], width: 1800, height: 1766 }
    const newMapData = { ...base, ...data }
    localStorage.setItem(`pg_map_${game.id}`, JSON.stringify(newMapData))
    setCustomMapData(newMapData)
    setShowEditor(false)
  }

  if (!gameMapData) {
    return (
      <div style={styles.empty}>
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16, color: 'var(--text-muted)', opacity: 0.5 }}>
          <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
          <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
        </svg>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No map yet</div>
        <div style={{ color: 'var(--text-muted)', marginBottom: 24 }}>No map data for {game?.title}</div>
        <button
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--game-color)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          onClick={() => setShowEditor(true)}
        >
          <Plus size={16} /> Create Map
        </button>
        {showEditor && (
          <MapEditor
            mapData={{ areas: [], width: 1800, height: 1766, image: null }}
            gameId={game.id}
            onClose={() => setShowEditor(false)}
            onSave={handleSaveMapEditor}
          />
        )}
      </div>
    )
  }

  return (
    <div style={styles.container} ref={containerRef}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.toolGroup}>
          <button style={styles.toolBtn} onClick={zoomIn} title="Zoom In"><ZoomIn size={15} /></button>
          <button style={styles.toolBtn} onClick={zoomOut} title="Zoom Out"><ZoomOut size={15} /></button>
          <button style={styles.toolBtn} onClick={zoomReset} title="Reset View"><Home size={15} /></button>
        </div>
        <div style={styles.toolDivider} />
        <div style={styles.toolGroup}>
          <button style={styles.toolBtn} onClick={rotate} title="Rotate 90°"><RotateCw size={15} /></button>
          <button
            style={{ ...styles.toolBtn, ...(mirrored ? styles.toolBtnActive : {}) }}
            onClick={toggleMirror}
            title="Mirror"
          ><ArrowLeftRight size={15} /></button>
          <button
            style={{ ...styles.toolBtn, ...(isHD ? styles.toolBtnActive : {}), fontSize: 11, fontWeight: 700 }}
            onClick={() => setIsHD(h => !h)}
            title="HD Toggle"
          >HD</button>
        </div>
        <div style={styles.toolDivider} />
        <input
          style={styles.searchInput}
          placeholder="Search areas or Pokémon..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && searchMode === 'pokemon' && (
          <span style={styles.searchModeBadge}>Pokémon</span>
        )}
        <button
          style={{ ...styles.toolBtn, ...(showLabels ? styles.toolBtnActive : {}) }}
          onClick={() => setShowLabels(l => !l)}
          title="Toggle Area Labels"
        ><Type size={15} /></button>
        <button
          style={{ ...styles.toolBtn, ...(showLegend ? styles.toolBtnActive : {}) }}
          onClick={() => setShowLegend(l => !l)}
          title="Toggle Legend"
        ><Layers size={15} /></button>
        <div style={styles.toolDivider} />
        <button style={styles.editMapBtn} onClick={() => setShowEditor(true)}>
          <Pencil size={13} />
          <span>Edit Map</span>
        </button>
      </div>

      {/* Map + panel */}
      <div style={styles.mapArea}>
        {/* Map canvas */}
        <div
          ref={mapCanvasRef}
          style={styles.mapCanvas}
          onMouseDown={handleMouseDown}
          onMouseMove={(e) => { handleMouseMove(e); handleMouseMoveTooltip(e) }}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={() => setSelectedArea(null)}
        >
          <div
            style={{
              position: 'absolute',
              transformOrigin: '0 0',
              transform: getTransform(),
              cursor: isDragging ? 'grabbing' : 'grab',
              transition: isAnimating && !isDragging ? 'transform 0.28s cubic-bezier(0.4,0,0.2,1)' : 'none',
            }}
          >
            {mapImage && (
              <img
                src={mapImage}
                alt="Map"
                style={{ display: 'block', width: mapWidth, height: mapHeight }}
                draggable={false}
                onLoad={e => {
                  const nw = e.target.naturalWidth
                  const nh = e.target.naturalHeight
                  // Only override if image natural size differs from stored dimensions
                  if (nw && nh && (nw !== gameMapData?.width || nh !== gameMapData?.height)) {
                    setNaturalImageSize({ width: nw, height: nh })
                  }
                }}
              />
            )}
            <svg
              ref={svgRef}
              width={mapWidth}
              height={mapHeight}
              style={{ position: 'absolute', top: 0, left: 0 }}
            >
              {areas.map(area => {
                const { opacity, fill, stroke, strokeWidth } = getAreaVisuals(area)
                const isCurrentLoc = area.id === currentStepLoc

                return (
                  <g
                    key={area.id}
                    style={{ opacity, transition: 'opacity 0.15s' }}
                    onClick={(e) => handleAreaClick(e, area)}
                    onMouseEnter={(e) => handleAreaHover(e, area)}
                    onMouseLeave={handleAreaLeave}
                  >
                    <polygon
                      points={polygonToStr(area.polygon)}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      style={{ cursor: 'pointer', transition: 'fill 0.15s, stroke 0.15s' }}
                    />
                    {showLabels && area.polygon.length > 0 && (() => {
                      const center = getAreaCenter(area.polygon)
                      return (
                        <text
                          x={center.x} y={center.y}
                          textAnchor="middle" dominantBaseline="central"
                          fill="#fff" fontSize={13} fontWeight="bold"
                          style={{ pointerEvents: 'none', paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}
                        >
                          {area.name}
                        </text>
                      )
                    })()}
                    {isCurrentLoc && (() => {
                      const center = getAreaCenter(area.polygon)
                      return (
                        <g>
                          <circle cx={center.x} cy={center.y - 20} r={10} fill="var(--quest-marker-color)" />
                          <text x={center.x} y={center.y - 20} textAnchor="middle" dominantBaseline="central"
                            fill="#000" fontSize={12} fontWeight="bold">!</text>
                          <line x1={center.x} y1={center.y - 10} x2={center.x} y2={center.y}
                            stroke="var(--quest-marker-color)" strokeWidth={2} />
                        </g>
                      )
                    })()}
                  </g>
                )
              })}
            </svg>
          </div>

          {/* Scale indicator */}
          <div style={styles.scaleInfo}>
            {Math.round(scale * 100)}%
          </div>
        </div>

        {/* Side panel */}
        <div style={styles.sidePanel}>
          {/* Current Step */}
          {steps.length > 0 && (
            <div style={styles.stepCard}>
              <div style={styles.stepHeader}>
                <span style={styles.stepLabel}>Current Step</span>
                <span style={styles.stepCount}>{currentStepIdx + 1} / {steps.length}</span>
              </div>
              {currentStep && (
                <div style={styles.stepText} title={typeof currentStep === 'string' ? currentStep : (currentStep.text || currentStep.title || '')}>
                  {typeof currentStep === 'string' ? currentStep : (currentStep.text || currentStep.title || `Step ${currentStepIdx + 1}`)}
                </div>
              )}
              <div style={styles.stepProgressBar}>
                <div style={{ ...styles.stepProgressFill, width: `${Math.round(((currentStepIdx + 1) / steps.length) * 100)}%` }} />
              </div>
              <div style={styles.stepBtns}>
                <button
                  style={{ ...styles.stepBtn, opacity: currentStepIdx === 0 ? 0.4 : 1 }}
                  onClick={() => currentStepIdx > 0 && saveStep(currentStepIdx - 1)}
                  disabled={currentStepIdx === 0}
                  title="Previous step"
                >
                  ← Prev
                </button>
                <button
                  style={{ ...styles.stepBtn, ...styles.stepBtnPrimary, opacity: currentStepIdx >= steps.length - 1 ? 0.4 : 1 }}
                  onClick={() => currentStepIdx < steps.length - 1 && saveStep(currentStepIdx + 1)}
                  disabled={currentStepIdx >= steps.length - 1}
                  title="Next step"
                >
                  {currentStepIdx >= steps.length - 2 ? 'Finish ✓' : 'Next →'}
                </button>
              </div>
            </div>
          )}

          {/* Legend */}
          {showLegend && (
            <div style={styles.legend}>
              <div style={styles.legendTitle}>Legend</div>
              {Object.entries(AREA_COLORS).map(([type, color]) => (
                <div key={type} style={styles.legendItem}>
                  <div style={{ ...styles.legendColor, background: color }} />
                  <span style={styles.legendLabel}>{type}</span>
                </div>
              ))}
              {currentStepLoc && (
                <>
                  <div style={styles.legendDivider} />
                  <div style={styles.legendItem}>
                    <div style={{ ...styles.legendColor, background: 'var(--quest-marker-color)', borderRadius: '50%' }} />
                    <span style={styles.legendLabel}>Current Quest</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Area detail */}
          {selectedArea && (
            <div style={styles.areaDetail}>
              <div style={styles.areaHeader}>
                <div style={{ ...styles.areaTypeBadge, background: AREA_COLORS[selectedArea.type] + '33', color: AREA_COLORS[selectedArea.type] }}>
                  {selectedArea.type}
                </div>
                <button style={styles.closeBtn} onClick={() => setSelectedArea(null)}>×</button>
              </div>
              <h3 style={styles.areaName}>{selectedArea.name}</h3>
              {selectedArea.note && (
                <p style={styles.areaNote}>{selectedArea.note}</p>
              )}
              {selectedArea.connections && Object.keys(selectedArea.connections).length > 0 && (
                <div style={styles.areaSection}>
                  <div style={styles.areaSectionTitle}>Connections</div>
                  {Object.entries(selectedArea.connections).map(([dir, dest]) => (
                    <button
                      key={dir}
                      style={{
                        ...styles.connBtn,
                        cursor: dest ? 'pointer' : 'default',
                        opacity: dest ? 1 : 0.5,
                      }}
                      onClick={() => dest && focusOnArea(dest)}
                      disabled={!dest}
                    >
                      <span style={styles.connDirBadge}>{dir}</span>
                      <span style={styles.connDestText}>{dest || '—'}</span>
                      {dest && <ChevronRight size={11} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />}
                    </button>
                  ))}
                </div>
              )}
              {selectedArea.pokemon && selectedArea.pokemon.length > 0 && (
                <div style={styles.areaSection}>
                  <div style={styles.areaSectionTitle}>Wild Pokémon</div>
                  <div style={styles.pokemonGrid}>
                    {selectedArea.pokemon.map(p => (
                      <span
                        key={p}
                        style={{
                          ...styles.pokemonTag,
                          cursor: onNavigateToPokemon ? 'pointer' : 'default',
                        }}
                        onClick={() => onNavigateToPokemon && onNavigateToPokemon(p)}
                        title={onNavigateToPokemon ? `View ${p} in Pokédex` : p}
                      >
                        <div style={styles.pokemonSpriteBox}>
                          <img
                            src={`https://play.pokemonshowdown.com/sprites/gen5/${p.toLowerCase()}.png`}
                            alt={p}
                            style={{ width: 48, height: 48, display: 'block' }}
                            onError={e => { e.target.style.display = 'none' }}
                          />
                        </div>
                        <span style={styles.pokemonTagName}>{p}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tooltip */}
      {hoveredArea && !selectedArea && (
        <div style={{
          ...styles.tooltip,
          left: tooltipPos.x + 12,
          top: tooltipPos.y - 8,
        }}>
          {hoveredArea.name}
        </div>
      )}

      {showEditor && (
        <MapEditor
          mapData={gameMapData}
          gameId={game.id}
          onClose={() => setShowEditor(false)}
          onSave={handleSaveMapEditor}
        />
      )}
    </div>
  )
}

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
    background: '#111',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 12px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-color)',
    flexShrink: 0,
    zIndex: 10,
  },
  toolGroup: {
    display: 'flex',
    gap: 4,
  },
  toolBtn: {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    width: 32,
    height: 32,
    cursor: 'pointer',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    transition: 'all 0.15s',
  },
  toolBtnActive: {
    background: 'var(--game-color)',
    borderColor: 'var(--game-color)',
    color: '#fff',
  },
  toolDivider: {
    width: 1,
    height: 24,
    background: 'var(--border-color)',
    margin: '0 2px',
  },
  searchInput: {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    padding: '5px 10px',
    color: 'var(--text-primary)',
    fontSize: 12,
    width: 190,
    outline: 'none',
  },
  searchModeBadge: {
    background: 'var(--game-color)33',
    color: 'var(--game-color)',
    border: '1px solid var(--game-color)55',
    borderRadius: 10,
    padding: '2px 8px',
    fontSize: 10,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  editMapBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'var(--game-color)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
    whiteSpace: 'nowrap',
  },
  mapArea: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  mapCanvas: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    background: '#1a1a2e',
  },
  sidePanel: {
    width: 240,
    background: 'var(--bg-secondary)',
    borderLeft: '1px solid var(--border-color)',
    overflowY: 'auto',
    flexShrink: 0,
  },
  stepCard: {
    flexShrink: 0,
    height: 160,
    display: 'flex',
    flexDirection: 'column',
    padding: 12,
    borderBottom: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
  },
  stepHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    flexShrink: 0,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  stepCount: {
    fontSize: 11,
    color: 'var(--text-muted)',
    fontVariantNumeric: 'tabular-nums',
  },
  stepText: {
    flex: 1,
    fontSize: 12,
    color: 'var(--text-primary)',
    lineHeight: 1.5,
    overflowY: 'auto',
    marginBottom: 8,
  },
  stepProgressBar: {
    height: 3,
    background: 'var(--border-color)',
    borderRadius: 2,
    marginBottom: 8,
    flexShrink: 0,
    overflow: 'hidden',
  },
  stepProgressFill: {
    height: '100%',
    background: 'var(--game-color)',
    borderRadius: 2,
    transition: 'width 0.25s',
  },
  stepBtns: {
    display: 'flex',
    gap: 6,
    flexShrink: 0,
  },
  stepBtn: {
    flex: 1,
    background: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 5,
    padding: '5px 0',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  stepBtnPrimary: {
    background: 'var(--game-color)',
    color: '#fff',
    border: 'none',
  },
  legend: {
    padding: 14,
    borderBottom: '1px solid var(--border-color)',
  },
  legendTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    flexShrink: 0,
  },
  legendLabel: {
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  legendDivider: {
    height: 1,
    background: 'var(--border-color)',
    margin: '6px 0',
  },
  areaDetail: {
    padding: 14,
  },
  areaHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  areaTypeBadge: {
    padding: '2px 8px',
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 600,
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: 18,
    cursor: 'pointer',
  },
  areaName: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 8,
  },
  areaNote: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    marginBottom: 10,
  },
  areaSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTop: '1px solid var(--border-color)',
  },
  areaSectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  connBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    width: '100%',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    borderRadius: 6,
    padding: '6px 8px',
    marginBottom: 4,
    transition: 'background 0.12s, border-color 0.12s',
    textAlign: 'left',
  },
  connDirBadge: {
    background: 'var(--game-color)',
    color: '#fff',
    borderRadius: 3,
    padding: '1px 5px',
    fontSize: 10,
    fontWeight: 700,
    flexShrink: 0,
    minWidth: 18,
    textAlign: 'center',
  },
  connDestText: {
    fontSize: 12,
    color: 'var(--text-primary)',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  pokemonGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  pokemonTag: {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    borderRadius: 10,
    padding: '6px 8px',
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    userSelect: 'none',
    transition: 'all 0.15s',
    minWidth: 64,
  },
  pokemonSpriteBox: {
    background: 'rgba(255,255,255,0.07)',
    borderRadius: 8,
    padding: '2px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
  },
  pokemonTagName: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textAlign: 'center',
    textTransform: 'capitalize',
    lineHeight: 1.2,
  },
  scaleInfo: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    background: 'rgba(0,0,0,0.6)',
    color: '#fff',
    fontSize: 11,
    padding: '3px 8px',
    borderRadius: 4,
    fontFamily: 'monospace',
    pointerEvents: 'none',
  },
  tooltip: {
    position: 'fixed',
    background: 'rgba(0,0,0,0.85)',
    color: '#fff',
    padding: '4px 10px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 500,
    pointerEvents: 'none',
    zIndex: 9000,
    whiteSpace: 'nowrap',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--text-secondary)',
    textAlign: 'center',
  },
}

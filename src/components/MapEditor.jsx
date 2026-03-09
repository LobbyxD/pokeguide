import React, { useState, useRef, useCallback, useEffect } from 'react'
import { MousePointer, Square, Hand, Plus, Minus, Home, Image, Download, Upload, X, RotateCcw } from './Icons.jsx'
import { onStorageChange } from '../utils/store.js'

const AREA_TYPES = ['Town', 'City', 'Route', 'Cave', 'Sea', 'Island', 'Forest', 'Building', 'Other']
const DIRECTIONS = ['N', 'S', 'E', 'W', 'NE', 'SE', 'SW', 'NW', 'Via']
const MAX_UNDO = 20

// Returns all sub-shapes for an area (supports both legacy `polygon` and new `shapes` format)
function getShapes(area) {
  if (area.shapes && area.shapes.length > 0) return area.shapes
  if (area.polygon && area.polygon.length > 0) return [area.polygon]
  return []
}

export default function MapEditor({ mapData, gameId, onClose, onSave }) {
  const [areas, setAreas] = useState(() =>
    (mapData?.areas || []).map(a => {
      const poly = a.polygon ? a.polygon.map(p => [...p]) : []
      const existingShapes = a.shapes ? a.shapes.map(s => s.map(p => [...p])) : []
      const shapes = existingShapes.length > 0 ? existingShapes : (poly.length > 0 ? [poly] : [])
      return { ...a, polygon: poly, shapes }
    })
  )
  const [selectedAreaId, setSelectedAreaId] = useState(null)
  const [tool, setTool] = useState('select') // select | rect | move
  const [undoStack, setUndoStack] = useState([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState(null)
  const [drawCurrent, setDrawCurrent] = useState(null)
  const [pokemonSearch, setPokemonSearch] = useState('')
  const [pokemonSuggestions, setPokemonSuggestions] = useState([])
  const [allPokemon, setAllPokemon] = useState([])
  const [pokedexPokemon, setPokedexPokemon] = useState([])
  const [connInputs, setConnInputs] = useState({}) // { dir: { value, open } } for autocomplete
  const [pokedexData, setPokedexData] = useState([]) // full data with locations
  const [imageOverride, setImageOverride] = useState(() =>
    mapData?.image?.startsWith?.('data:') ? mapData.image : null
  )
  const [imageDimensions, setImageDimensions] = useState(() =>
    mapData?.image?.startsWith?.('data:') && mapData.width && mapData.height
      ? { width: mapData.width, height: mapData.height }
      : null
  )
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(0.4)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState(null)

  const svgRef = useRef(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const importInputRef = useRef(null)

  const mapWidth = imageDimensions?.width || mapData?.width || 1800
  const mapHeight = imageDimensions?.height || mapData?.height || 1766
  const mapImage = imageOverride || mapData?.image

  // Center map on mount
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const fitScale = Math.min(el.clientWidth / mapWidth, el.clientHeight / mapHeight) * 0.85
    setPan({
      x: (el.clientWidth - mapWidth * fitScale) / 2,
      y: (el.clientHeight - mapHeight * fitScale) / 2,
    })
    setScale(fitScale)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const resetView = useCallback(() => {
    const el = canvasRef.current
    if (!el) return
    const fitScale = Math.min(el.clientWidth / mapWidth, el.clientHeight / mapHeight) * 0.85
    setPan({
      x: (el.clientWidth - mapWidth * fitScale) / 2,
      y: (el.clientHeight - mapHeight * fitScale) / 2,
    })
    setScale(fitScale)
  }, [mapWidth, mapHeight])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)
      const { selectedAreaId, undo, deleteArea, resetView } = kbRef.current

      if (e.key === 'Escape') {
        if (selectedAreaId) setSelectedAreaId(null)
        else onClose()
        return
      }
      if (isInput) return

      if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault(); undo(); return
      }

      switch (e.key) {
        case 'v': case 'V': setTool('select'); break
        case 'r': case 'R': setTool('rect'); break
        case 'h': case 'H': setTool('move'); break
        case '=': case '+': setScale(s => Math.min(s * 1.2, 5)); break
        case '-': setScale(s => Math.max(s / 1.2, 0.05)); break
        case '0': resetView(); break
        case 'Delete':
        case 'Backspace':
          if (selectedAreaId) { e.preventDefault(); deleteArea(selectedAreaId) }
          break
        case 'Enter':
          if (selectedAreaId) { e.preventDefault(); setSelectedAreaId(null) }
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Mouse-centered wheel zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const delta = e.deltaY > 0 ? 0.85 : 1 / 0.85
    const newScale = Math.max(0.05, Math.min(5, scale * delta))
    const scaleChange = newScale / scale
    setPan(prev => ({
      x: mouseX - scaleChange * (mouseX - prev.x),
      y: mouseY - scaleChange * (mouseY - prev.y),
    }))
    setScale(newScale)
  }, [scale])

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // Load game's pokedex from localStorage cache and keep it live
  const loadPokedexCache = useCallback(() => {
    try {
      const cached = localStorage.getItem(`pg_pokedex_${gameId}`)
      if (cached) {
        const data = JSON.parse(cached)
        setPokedexData(data)
        setPokedexPokemon(data.map(p => p.name.charAt(0).toUpperCase() + p.name.slice(1)))
      }
    } catch {}
  }, [gameId])

  useEffect(() => {
    loadPokedexCache()
    return onStorageChange(`pg_pokedex_${gameId}`, loadPokedexCache)
  }, [gameId, loadPokedexCache])

  // Load full pokemon list from PokeAPI as fallback
  useEffect(() => {
    const fetchPokemonList = async () => {
      try {
        const resp = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1000')
        const data = await resp.json()
        setAllPokemon(data.results.map(p => p.name.charAt(0).toUpperCase() + p.name.slice(1)))
      } catch {
        setAllPokemon([])
      }
    }
    fetchPokemonList()
  }, [])

  useEffect(() => {
    if (pokemonSearch.length > 1) {
      const q = pokemonSearch.toLowerCase()
      // Prioritize game's own pokedex, then fall back to full PokeAPI list
      const sourceList = pokedexPokemon.length > 0 ? pokedexPokemon : allPokemon
      const matches = sourceList.filter(p => p.toLowerCase().includes(q))
      // If using game pokedex and not enough matches, also check full list
      if (pokedexPokemon.length > 0 && matches.length < 5) {
        const extra = allPokemon.filter(p => p.toLowerCase().includes(q) && !matches.includes(p))
        setPokemonSuggestions([...matches, ...extra].slice(0, 10))
      } else {
        setPokemonSuggestions(matches.slice(0, 10))
      }
    } else {
      // Show first few from game's pokedex when no query
      setPokemonSuggestions(pokemonSearch.length === 0 ? [] : [])
    }
  }, [pokemonSearch, allPokemon, pokedexPokemon])

  const selectedArea = areas.find(a => a.id === selectedAreaId)

  const pushUndo = (prevAreas) => {
    setUndoStack(stack => {
      const newStack = [...stack, prevAreas].slice(-MAX_UNDO)
      return newStack
    })
  }

  const undo = useCallback(() => {
    setUndoStack(stack => {
      if (stack.length === 0) return stack
      const prev = stack[stack.length - 1]
      setAreas(prev)
      return stack.slice(0, -1)
    })
  }, [])

  const getSVGPoint = (e) => {
    const rect = svgRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left - pan.x) / scale
    const y = (e.clientY - rect.top - pan.y) / scale
    return [Math.round(x), Math.round(y)]
  }

  const handleSVGMouseDown = (e) => {
    if (tool === 'move' || e.button === 1) {
      e.preventDefault()
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      return
    }
    if (tool === 'rect') {
      const pt = getSVGPoint(e)
      setDrawStart(pt)
      setDrawCurrent(pt)
      setIsDrawing(true)
    }
  }

  const handleSVGMouseMove = (e) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
      return
    }
    if (isDrawing && tool === 'rect') {
      setDrawCurrent(getSVGPoint(e))
    }
  }

  const handleSVGMouseUp = (e) => {
    if (isPanning) {
      setIsPanning(false)
      return
    }
    if (isDrawing && tool === 'rect' && drawStart && drawCurrent) {
      const [x1, y1] = drawStart
      const [x2, y2] = drawCurrent
      if (Math.abs(x2 - x1) > 10 && Math.abs(y2 - y1) > 10) {
        const newShape = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]
        const shiftMerge = e.shiftKey && selectedAreaId && selectedArea
        if (shiftMerge) {
          // Merge new shape into the selected area
          const merged = [...getShapes(selectedArea), newShape]
          pushUndo(areas)
          setAreas(prev => prev.map(a =>
            a.id === selectedAreaId
              ? { ...a, shapes: merged, polygon: merged[0] }
              : a
          ))
        } else {
          const newArea = {
            id: `area-${Date.now()}`,
            name: 'New Area',
            type: 'Route',
            polygon: newShape,
            shapes: [newShape],
            pokemon: [],
            note: '',
            connections: {},
            showLabel: true,
          }
          pushUndo(areas)
          setAreas(prev => [...prev, newArea])
          setSelectedAreaId(newArea.id)
        }
      }
      setIsDrawing(false)
      setDrawStart(null)
      setDrawCurrent(null)
    }
  }

  const handleAreaClick = (e, areaId) => {
    e.stopPropagation()
    if (tool === 'select') {
      setSelectedAreaId(areaId)
    }
  }

  const handleSVGClick = () => {
    if (tool === 'select') setSelectedAreaId(null)
  }

  const updateArea = (id, updates) => {
    pushUndo(areas)
    setAreas(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a))
  }

  const deleteArea = useCallback((id) => {
    setAreas(prev => {
      setUndoStack(stack => [...stack, prev].slice(-MAX_UNDO))
      return prev.filter(a => a.id !== id)
    })
    setSelectedAreaId(null)
  }, [])

  // Always-fresh ref for keyboard handler — updated synchronously each render (must be after undo/deleteArea/resetView)
  const kbRef = useRef({})
  kbRef.current = { selectedAreaId, undo, deleteArea, resetView }

  const addPokemon = (name) => {
    if (!selectedArea) return
    const pokemon = selectedArea.pokemon || []
    if (!pokemon.includes(name)) {
      updateArea(selectedAreaId, { pokemon: [...pokemon, name] })
    }
    setPokemonSearch('')
    setPokemonSuggestions([])
  }

  const addAllPokemon = (names) => {
    if (!selectedArea) return
    const existing = new Set(selectedArea.pokemon || [])
    const toAdd = names.filter(n => !existing.has(n))
    if (toAdd.length === 0) return
    pushUndo(areas)
    setAreas(prev => prev.map(a =>
      a.id === selectedAreaId ? { ...a, pokemon: [...(a.pokemon || []), ...toAdd] } : a
    ))
  }

  const removePokemon = (name) => {
    if (!selectedArea) return
    updateArea(selectedAreaId, { pokemon: (selectedArea.pokemon || []).filter(p => p !== name) })
  }

  const addConnection = (dir, areaName) => {
    if (!selectedArea) return
    const conns = { ...(selectedArea.connections || {}) }
    conns[dir] = areaName || ''
    updateArea(selectedAreaId, { connections: conns })
  }

  const setConnection = (dir, value) => {
    if (!selectedArea) return
    const conns = { ...(selectedArea.connections || {}) }
    conns[dir] = value
    updateArea(selectedAreaId, { connections: conns })
  }

  const removeConnection = (dir) => {
    if (!selectedArea) return
    const conns = { ...(selectedArea.connections || {}) }
    delete conns[dir]
    updateArea(selectedAreaId, { connections: conns })
  }

  // Area name suggestions for connection inputs
  const getAreaSuggestions = (query) => {
    if (!query || query.length < 1) return []
    const q = query.toLowerCase()
    const existingDests = new Set(Object.values(selectedArea?.connections || {}).filter(Boolean))
    return areas
      .filter(a => a.id !== selectedAreaId && a.name && a.name.toLowerCase().includes(q) && !existingDests.has(a.name))
      .map(a => a.name)
      .slice(0, 6)
  }

  // Auto-detect touching/nearby areas and suggest connections
  const getConnectionSuggestions = useCallback(() => {
    if (!selectedArea || getShapes(selectedArea).length === 0) return []

    const getCenter = (polygon) => ({
      x: polygon.reduce((s, p) => s + p[0], 0) / polygon.length,
      y: polygon.reduce((s, p) => s + p[1], 0) / polygon.length,
    })

    const getBounds = (polygon) => {
      const xs = polygon.map(p => p[0])
      const ys = polygon.map(p => p[1])
      return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
    }

    const boundsNear = (b1, b2, threshold = 80) =>
      b1.maxX + threshold >= b2.minX && b2.maxX + threshold >= b1.minX &&
      b1.maxY + threshold >= b2.minY && b2.maxY + threshold >= b1.minY

    const getDir = (from, to) => {
      const dx = to.x - from.x
      const dy = to.y - from.y
      const angle = Math.atan2(dy, dx) * 180 / Math.PI
      if (angle > -45 && angle <= 45) return 'E'
      if (angle > 45 && angle <= 135) return 'S'
      if (angle > 135 || angle <= -135) return 'W'
      return 'N'
    }

    const selPts = getShapes(selectedArea).flat()
    const selBounds = getBounds(selPts)
    const selCenter = getCenter(selPts)
    const existingDirs = new Set(Object.keys(selectedArea.connections || {}))
    const existingDests = new Set(Object.values(selectedArea.connections || {}).filter(Boolean))

    return areas
      .filter(a => a.id !== selectedAreaId && getShapes(a).length > 0)
      .filter(a => boundsNear(selBounds, getBounds(getShapes(a).flat())))
      .filter(a => !existingDests.has(a.name) && !existingDests.has(a.id))
      .map(a => ({ area: a, dir: getDir(selCenter, getCenter(getShapes(a).flat())) }))
      .filter(({ dir }) => !existingDirs.has(dir))
      .slice(0, 6)
  }, [selectedArea, selectedAreaId, areas])

  const connectionSuggestions = getConnectionSuggestions()

  // Pokemon suggested by matching the area name against pokedex location data
  const locationPokemonSuggestions = (() => {
    if (!selectedArea || !pokedexData.length) return []
    const areaNameNorm = selectedArea.name.toLowerCase().trim()
    if (!areaNameNorm || areaNameNorm === 'new area') return []
    const existingPokemon = new Set((selectedArea.pokemon || []).map(p => p.toLowerCase()))

    // Extract numbers and words separately for precise matching
    // e.g. "Route 2" → numbers=["2"], words=["route"]
    const areaNumbers = areaNameNorm.match(/\d+/g) || []
    const areaWords = areaNameNorm.split(/\s+/).filter(t => /^[a-z]+$/.test(t) && t.length > 1)
    if (areaWords.length === 0 && areaNumbers.length === 0) return []

    return pokedexData
      .filter(p => {
        if (existingPokemon.has(p.name.toLowerCase())) return false
        return (p.locations || []).some(loc => {
          const locNorm = loc.area.toLowerCase().replace(/ area$/, '').trim()
          const locNumbers = locNorm.match(/\d+/g) || []
          // All numbers must match exactly (array element match, not substring)
          const numbersMatch = areaNumbers.every(n => locNumbers.includes(n))
          // All non-numeric words must appear in the location string
          const wordsMatch = areaWords.every(w => locNorm.includes(w))
          return numbersMatch && wordsMatch
        })
      })
      .map(p => p.name)
      .slice(0, 20)
  })()

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target.result
      // Detect natural image dimensions so MapView renders at correct ratio
      const img = new window.Image()
      img.onload = () => {
        setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight })
        setImageOverride(dataUrl)
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const exportJSON = () => {
    const data = JSON.stringify({ ...mapData, areas }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${gameId}-map.json`
    a.click()
  }

  const importJSON = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (data.areas) {
          pushUndo(areas)
          setAreas(data.areas)
        }
      } catch {
        alert('Invalid JSON file')
      }
    }
    reader.readAsText(file)
  }

  const handleSave = () => {
    const saveData = { areas }
    if (imageOverride) {
      saveData.image = imageOverride
      if (imageDimensions) {
        saveData.width = imageDimensions.width
        saveData.height = imageDimensions.height
      }
    }
    onSave(saveData)
  }

  const getAreaColor = (type) => {
    const colors = {
      Town: '#f6e05e', City: '#4299e1', Route: '#68d391', Cave: '#a0aec0',
      Sea: '#63b3ed', Island: '#fc8181', Forest: '#38a169', Building: '#d6bcfa', Other: '#fbd38d',
    }
    return colors[type] || '#a0aec0'
  }

  const polygonToStr = (polygon) => polygon.map(p => p.join(',')).join(' ')
  // Converts multiple polygons into a single SVG compound path — one fill, no color stacking
  const shapesToPath = (shapes) =>
    shapes.map(pts => 'M ' + pts.map(p => p.join(',')).join(' L ') + ' Z').join(' ')

  const drawRect = drawStart && drawCurrent ? [
    drawStart,
    [drawCurrent[0], drawStart[1]],
    drawCurrent,
    [drawStart[0], drawCurrent[1]],
  ] : null

  return (
    <div style={styles.overlay}>
      <div style={styles.editor}>
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.title}>Map Editor</span>
          <div style={styles.headerControls}>
            <button style={{ ...styles.toolBtn, display: 'flex', alignItems: 'center', gap: 6 }} onClick={undo} disabled={undoStack.length === 0} title="Undo (Ctrl+Z)"><RotateCcw size={13} /> Undo</button>
            <button style={{ ...styles.toolBtn, background: '#38a169', color: '#fff' }} onClick={handleSave}>Save</button>
            <button style={{ ...styles.closeBtn, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        <div style={styles.body}>
          {/* Toolbar */}
          <div style={styles.toolbar}>
            <div style={styles.toolGroup}>
              {[
                { id: 'select', icon: <MousePointer size={15} />, title: 'Select (V)' },
                { id: 'rect', icon: <Square size={15} />, title: 'Draw Rectangle (R) — Hold Shift to add shape to selected area' },
                { id: 'move', icon: <Hand size={15} />, title: 'Pan (H) — or middle-mouse drag' },
              ].map(t => (
                <button
                  key={t.id}
                  style={{ ...styles.toolBtn2, ...(tool === t.id ? styles.toolBtnActive : {}) }}
                  onClick={() => setTool(t.id)}
                  title={t.title}
                >
                  {t.icon}
                </button>
              ))}
            </div>

            <div style={styles.toolDivider} />

            <div style={styles.toolGroup}>
              <button style={styles.toolBtn2} onClick={() => setScale(s => Math.min(s * 1.2, 5))} title="Zoom In (+)"><Plus size={14} /></button>
              <button style={styles.toolBtn2} onClick={() => setScale(s => Math.max(s / 1.2, 0.05))} title="Zoom Out (-)"><Minus size={14} /></button>
              <button style={styles.toolBtn2} onClick={resetView} title="Reset View (0)"><Home size={14} /></button>
            </div>

            <div style={styles.toolDivider} />

            <div style={styles.toolGroup}>
              <button style={styles.toolBtn2} onClick={() => fileInputRef.current?.click()} title="Upload Image"><Image size={14} /></button>
              <button style={styles.toolBtn2} onClick={exportJSON} title="Export JSON"><Download size={14} /></button>
              <button style={styles.toolBtn2} onClick={() => importInputRef.current?.click()} title="Import JSON"><Upload size={14} /></button>
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
            <input ref={importInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={importJSON} />
          </div>

          <div style={styles.main}>
            {/* Map Canvas */}
            <div style={styles.canvas} ref={canvasRef} onMouseMove={handleSVGMouseMove} onMouseUp={handleSVGMouseUp}>
              <svg
                ref={svgRef}
                width="100%"
                height="100%"
                style={{ cursor: tool === 'move' ? 'grab' : tool === 'rect' ? 'crosshair' : 'default' }}
                onMouseDown={handleSVGMouseDown}
                onClick={handleSVGClick}
              >
                <defs>
                  {areas.map(area => {
                    const isSelected = selectedAreaId === area.id
                    const strokeColor = isSelected ? '#ffffff' : getAreaColor(area.type)
                    const radius = (isSelected ? 2.5 : 1) / scale
                    return (
                      <filter key={area.id} id={`border-${area.id}`} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
                        <feMorphology in="SourceAlpha" operator="dilate" radius={radius} result="expanded" />
                        <feFlood floodColor={strokeColor} result="color" />
                        <feComposite in="color" in2="expanded" operator="in" result="outline" />
                        <feMerge>
                          <feMergeNode in="outline" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    )
                  })}
                </defs>
                <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
                  {mapImage && (
                    <image href={mapImage} x={0} y={0} width={mapWidth} height={mapHeight} />
                  )}
                  {areas.map(area => {
                    const shapes = getShapes(area)
                    const isSelected = selectedAreaId === area.id
                    return (
                      <g key={area.id} filter={`url(#border-${area.id})`} onClick={(e) => handleAreaClick(e, area.id)}>
                        <path
                          d={shapesToPath(shapes)}
                          fill={getAreaColor(area.type) + (isSelected ? 'aa' : '44')}
                          shapeRendering="crispEdges"
                          style={{ cursor: 'pointer' }}
                        />
                        {area.showLabel !== false && shapes.length > 0 && (() => {
                          // Use centroid of the largest shape so the label is always inside a polygon
                          let best = null, bestArea = 0
                          for (const pts of shapes) {
                            const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
                            const a = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))
                            if (a > bestArea) {
                              bestArea = a
                              best = {
                                cx: pts.reduce((s, p) => s + p[0], 0) / pts.length,
                                cy: pts.reduce((s, p) => s + p[1], 0) / pts.length,
                              }
                            }
                          }
                          const { cx, cy } = best
                          return (
                            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
                              fill="#fff" fontSize={14 / scale} fontWeight="bold"
                              style={{ pointerEvents: 'none', paintOrder: 'stroke', stroke: '#000', strokeWidth: 4 / scale }}>
                              {area.name}
                            </text>
                          )
                        })()}
                      </g>
                    )
                  })}
                  {drawRect && (
                    <polygon
                      points={polygonToStr(drawRect)}
                      fill="rgba(66,153,225,0.3)"
                      stroke="#4299e1"
                      strokeWidth={2 / scale}
                      strokeDasharray={`${6 / scale},${3 / scale}`}
                    />
                  )}
                </g>
              </svg>
            </div>

            {/* Side panel */}
            <div style={styles.panel}>
              {selectedArea ? (
                <div style={styles.areaPanel}>
                  <div style={styles.panelTitle}>Edit Area</div>

                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>Name</label>
                    <input
                      style={styles.input}
                      value={selectedArea.name}
                      onChange={e => updateArea(selectedAreaId, { name: e.target.value })}
                    />
                  </div>

                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>Type</label>
                    <select
                      style={styles.input}
                      value={selectedArea.type}
                      onChange={e => updateArea(selectedAreaId, { type: e.target.value })}
                    >
                      {AREA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>Note</label>
                    <textarea
                      style={{ ...styles.input, minHeight: 60, resize: 'vertical' }}
                      value={selectedArea.note || ''}
                      onChange={e => updateArea(selectedAreaId, { note: e.target.value })}
                    />
                  </div>

                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>
                      <input
                        type="checkbox"
                        checked={selectedArea.showLabel !== false}
                        onChange={e => updateArea(selectedAreaId, { showLabel: e.target.checked })}
                        style={{ marginRight: 6 }}
                      />
                      Show Label
                    </label>
                  </div>

                  {/* Connections */}
                  <div style={styles.panelSection}>
                    <div style={styles.panelSectionTitle}>Connections</div>
                    {Object.entries(selectedArea.connections || {}).map(([dir, dest]) => {
                      const connSuggs = connInputs[dir]?.open ? getAreaSuggestions(connInputs[dir]?.value ?? dest) : []
                      return (
                        <div key={dir} style={{ marginBottom: 6 }}>
                          <div style={styles.connRow}>
                            <span style={styles.connDir}>{dir}</span>
                            <div style={{ flex: 1, position: 'relative' }}>
                              <input
                                style={{ ...styles.input, width: '100%' }}
                                value={connInputs[dir]?.value ?? dest}
                                placeholder="area name"
                                onChange={e => {
                                  setConnInputs(prev => ({ ...prev, [dir]: { value: e.target.value, open: true } }))
                                  setConnection(dir, e.target.value)
                                }}
                                onFocus={() => setConnInputs(prev => ({ ...prev, [dir]: { value: dest, open: true } }))}
                                onBlur={() => setTimeout(() => setConnInputs(prev => ({ ...prev, [dir]: { ...prev[dir], open: false } })), 120)}
                              />
                              {connSuggs.length > 0 && (
                                <div style={styles.connDropdown}>
                                  {connSuggs.map(name => (
                                    <button
                                      key={name}
                                      style={styles.connDropdownItem}
                                      onMouseDown={e => {
                                        e.preventDefault()
                                        setConnection(dir, name)
                                        setConnInputs(prev => ({ ...prev, [dir]: { value: name, open: false } }))
                                      }}
                                    >{name}</button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <button style={{ ...styles.removeBtn, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => removeConnection(dir)}><X size={12} /></button>
                          </div>
                        </div>
                      )
                    })}
                    <div style={styles.dirButtons}>
                      {DIRECTIONS.map(dir => (
                        <button
                          key={dir}
                          style={styles.dirBtn}
                          onClick={() => addConnection(dir)}
                          disabled={!!selectedArea.connections?.[dir]}
                        >
                          {dir}
                        </button>
                      ))}
                    </div>

                    {/* Auto-suggestions from touching polygons */}
                    {connectionSuggestions.length > 0 && (
                      <div style={styles.suggestionSection}>
                        <div style={styles.suggestionLabel}>Nearby areas</div>
                        {connectionSuggestions.map(({ area, dir }) => (
                          <button
                            key={area.id}
                            style={styles.connSuggestion}
                            onClick={() => addConnection(dir, area.name)}
                            title={`Add ${dir} → ${area.name}`}
                          >
                            <span style={styles.suggDirBadge}>{dir}</span>
                            <span style={styles.suggAreaName}>{area.name}</span>
                          </button>
                        ))}
                      </div>
                    )}

                  </div>

                  {/* Wild Pokemon */}
                  <div style={styles.panelSection}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={styles.panelSectionTitle}>Wild Pokémon</span>
                      {pokedexPokemon.length > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--game-color)', background: 'var(--game-color)18', border: '1px solid var(--game-color)33', borderRadius: 8, padding: '1px 6px', fontWeight: 600, marginBottom: 2 }}>
                          Game Pokédex
                        </span>
                      )}
                    </div>
                    <div style={styles.pokemonList}>
                      {(selectedArea.pokemon || []).map(p => (
                        <div key={p} style={styles.pokemonRow}>
                          <img
                            src={`https://play.pokemonshowdown.com/sprites/gen5/${p.toLowerCase()}.png`}
                            alt={p}
                            style={{ width: 28, height: 28, imageRendering: 'auto', flexShrink: 0 }}
                            onError={e => { e.target.style.display = 'none' }}
                          />
                          <span style={styles.pokemonRowName}>{p}</span>
                          <button style={styles.pokemonRowRemove} onClick={() => removePokemon(p)} title={`Remove ${p}`}>
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {/* Location-based suggestions from pokedex */}
                    {!pokemonSearch && (() => {
                      const areaNameNorm = selectedArea.name.toLowerCase().trim()
                      const hasValidName = areaNameNorm && areaNameNorm !== 'new area'
                      if (!hasValidName) return null
                      if (!pokedexData.length) {
                        return (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, padding: '6px 0' }}>
                            Load the Pokédex first to see suggested Pokémon for this area.
                          </div>
                        )
                      }
                      if (locationPokemonSuggestions.length === 0) {
                        return (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, padding: '6px 0' }}>
                            No Pokémon found in Pokédex for "{selectedArea.name}".
                          </div>
                        )
                      }
                      return (
                        <div style={styles.locationSuggestions}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <div style={styles.suggestionLabel}>
                              Found in "{selectedArea.name}"
                            </div>
                            <button
                              style={styles.addAllBtn}
                              onClick={() => addAllPokemon(locationPokemonSuggestions)}
                              title="Add all to this area"
                            >
                              + Add All
                            </button>
                          </div>
                          <div style={styles.locationChips}>
                            {locationPokemonSuggestions.map(p => (
                              <button key={p} style={styles.locationChip} onClick={() => addPokemon(p)}>
                                <img
                                  src={`https://play.pokemonshowdown.com/sprites/gen5/${p.toLowerCase()}.png`}
                                  alt={p}
                                  style={{ width: 24, height: 24, imageRendering: 'auto' }}
                                  onError={e => { e.target.style.display = 'none' }}
                                />
                                <span>{p}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                    <div style={{ position: 'relative' }}>
                      <input
                        style={styles.input}
                        placeholder="Search Pokémon..."
                        value={pokemonSearch}
                        onChange={e => setPokemonSearch(e.target.value)}
                      />
                      {pokemonSuggestions.length > 0 && (
                        <div style={styles.suggestions}>
                          {pokemonSuggestions.slice(0, 8).map(p => (
                            <button key={p} style={styles.suggestion} onClick={() => addPokemon(p)}>
                              {p}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    style={{ ...styles.removeBtn, width: '100%', padding: '8px', marginTop: 12, borderRadius: 6 }}
                    onClick={() => deleteArea(selectedAreaId)}
                  >
                    Delete Area
                  </button>
                  <div style={styles.kbHint}>Del · delete &nbsp;|&nbsp; Enter · deselect</div>
                </div>
              ) : (
                <div style={styles.noSelection}>
                  <div style={{ marginBottom: 8, color: 'var(--text-muted)' }}><MousePointer size={32} /></div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>No area selected</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 16 }}>
                    Click an area to edit it, or use the rectangle tool to draw a new one.
                  </div>
                  <div style={styles.kbCheatsheet}>
                    <div style={styles.kbRow}><kbd style={styles.kbd}>V</kbd> Select</div>
                    <div style={styles.kbRow}><kbd style={styles.kbd}>R</kbd> Draw rect</div>
                    <div style={styles.kbRow}><kbd style={styles.kbd}>H</kbd> Pan</div>
                    <div style={styles.kbRow}><kbd style={styles.kbd}>+</kbd><kbd style={styles.kbd}>-</kbd> Zoom</div>
                    <div style={styles.kbRow}><kbd style={styles.kbd}>0</kbd> Reset view</div>
                    <div style={styles.kbRow}><kbd style={styles.kbd}>Ctrl Z</kbd> Undo</div>
                    <div style={styles.kbRow}><kbd style={styles.kbd}>Shift</kbd>+draw → merge shapes</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 'var(--titlebar-height)',
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'stretch',
    zIndex: 5000,
  },
  editor: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-primary)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-color)',
    flexShrink: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: 600,
  },
  headerControls: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  toolBtn: {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 6,
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: 22,
    cursor: 'pointer',
    padding: '0 4px',
  },
  body: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '8px 12px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-color)',
    flexShrink: 0,
  },
  toolGroup: {
    display: 'flex',
    gap: 4,
  },
  toolDivider: {
    width: 1,
    height: 24,
    background: 'var(--border-color)',
    margin: '0 4px',
  },
  toolBtn2: {
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
  },
  toolBtnActive: {
    background: 'var(--game-color)',
    borderColor: 'var(--game-color)',
  },
  main: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  canvas: {
    flex: 1,
    overflow: 'hidden',
    background: '#111',
    position: 'relative',
  },
  panel: {
    width: 280,
    background: 'var(--bg-secondary)',
    borderLeft: '1px solid var(--border-color)',
    overflowY: 'auto',
    flexShrink: 0,
  },
  areaPanel: {
    padding: 14,
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  fieldGroup: {
    marginBottom: 10,
  },
  fieldLabel: {
    display: 'block',
    fontSize: 11,
    color: 'var(--text-muted)',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    width: '100%',
    padding: '6px 8px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    color: 'var(--text-primary)',
    fontSize: 12,
    boxSizing: 'border-box',
  },
  panelSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTop: '1px solid var(--border-color)',
  },
  panelSectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  connRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  connDir: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    width: 24,
    textAlign: 'center',
  },
  removeBtn: {
    background: '#e53e3e22',
    color: '#e53e3e',
    border: '1px solid #e53e3e44',
    borderRadius: 4,
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: 12,
  },
  dirButtons: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  dirBtn: {
    background: 'var(--bg-primary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    padding: '3px 8px',
    cursor: 'pointer',
    fontSize: 11,
  },
  suggestionSection: {
    marginTop: 10,
    paddingTop: 8,
    borderTop: '1px dashed var(--border-color)',
  },
  suggestionLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  connSuggestion: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    background: 'var(--game-color)11',
    border: '1px solid var(--game-color)33',
    borderRadius: 5,
    padding: '5px 8px',
    cursor: 'pointer',
    marginBottom: 4,
    textAlign: 'left',
    transition: 'background 0.12s',
  },
  suggDirBadge: {
    background: 'var(--game-color)',
    color: '#fff',
    borderRadius: 3,
    padding: '1px 5px',
    fontSize: 10,
    fontWeight: 700,
    flexShrink: 0,
  },
  suggAreaName: {
    fontSize: 12,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  connDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    zIndex: 100,
    maxHeight: 160,
    overflowY: 'auto',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  },
  connDropdownItem: {
    display: 'block',
    width: '100%',
    padding: '6px 10px',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: 12,
    textAlign: 'left',
    cursor: 'pointer',
    borderBottom: '1px solid var(--border-color)',
  },
  pokemonList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    marginBottom: 8,
  },
  pokemonRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 6,
    padding: '3px 6px 3px 4px',
  },
  pokemonRowName: {
    flex: 1,
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  pokemonRowRemove: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 2,
    display: 'flex',
    alignItems: 'center',
    borderRadius: 3,
    flexShrink: 0,
    transition: 'color 0.1s',
  },
  suggestions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '0 0 4px 4px',
    zIndex: 10,
    maxHeight: 200,
    overflowY: 'auto',
  },
  suggestion: {
    display: 'block',
    width: '100%',
    padding: '6px 10px',
    background: 'transparent',
    color: 'var(--text-primary)',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: 12,
  },
  noSelection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: 24,
    textAlign: 'center',
    color: 'var(--text-secondary)',
  },
  locationSuggestions: {
    marginBottom: 8,
    padding: '8px 10px',
    background: 'var(--game-color)0d',
    border: '1px solid var(--game-color)33',
    borderRadius: 6,
  },
  addAllBtn: {
    background: 'var(--game-color)22',
    color: 'var(--game-color)',
    border: '1px solid var(--game-color)44',
    borderRadius: 4,
    padding: '2px 8px',
    cursor: 'pointer',
    fontSize: 10,
    fontWeight: 600,
  },
  locationChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  locationChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 6,
    padding: '3px 8px',
    cursor: 'pointer',
    fontSize: 11,
    color: 'var(--text-primary)',
    transition: 'border-color 0.12s, background 0.12s',
  },
  kbHint: {
    marginTop: 10,
    fontSize: 10,
    color: 'var(--text-muted)',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  kbCheatsheet: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    width: '100%',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '10px 14px',
  },
  kbRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    color: 'var(--text-secondary)',
  },
  kbd: {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    borderRadius: 3,
    padding: '1px 5px',
    fontSize: 10,
    fontFamily: 'monospace',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
  },
}

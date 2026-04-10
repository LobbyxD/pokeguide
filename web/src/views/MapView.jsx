import React, { useState, useEffect, useRef, useCallback } from 'react'
import { mapData as defaultMapData } from '../data/index.js'
import { stepLocations } from '../data/index.js'
import MapEditor from '../components/MapEditor.jsx'
import { ZoomIn, ZoomOut, Home, RotateCw, ArrowLeftRight, Layers, Plus, Pencil, Type, ChevronRight, Pin, MapPin } from '../components/Icons.jsx'
import { writeStorage } from '../utils/store.js'
import { idbGetMap, idbSetMap } from '../utils/idb.js'
import { saveMapToCloud, saveProgressToCloud } from '../utils/cloudSync.js'

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

export default function MapView({ game, onNavigateToPokemon, user }) {
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
  const [mapLoading, setMapLoading] = useState(true)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [naturalImageSize, setNaturalImageSize] = useState(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [stepPinned, setStepPinned] = useState(() => {
    try { return localStorage.getItem('pg_map_step_pinned') === 'true' } catch { return false }
  })

  const togglePin = () => {
    setStepPinned(p => {
      const next = !p
      try { localStorage.setItem('pg_map_step_pinned', String(next)) } catch {}
      return next
    })
  }

  // Detect mobile (touch-primary device or narrow screen)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const containerRef = useRef(null)
  const mapCanvasRef = useRef(null)
  const svgRef = useRef(null)
  const sidePanelRef = useRef(null)
  const scaleRef = useRef(scale)
  const panRef = useRef(pan)
  useEffect(() => { scaleRef.current = scale }, [scale])
  useEffect(() => { panRef.current = pan }, [pan])

  // Scroll panel to top whenever a new area is selected so detail is immediately visible
  useEffect(() => {
    if (selectedArea && sidePanelRef.current) {
      sidePanelRef.current.scrollTop = 0
    }
  }, [selectedArea])

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
    if (game) {
      writeStorage(`pg_step_progress_${game.id}`, String(idx))
      if (user) saveProgressToCloud(user.id, game.id, idx)
    }
  }

  const steps = game?.steps || []
  const currentStep = steps[currentStepIdx] || null
  // User-set location (area name) takes priority over static stepLocations (area id)
  const currentStepLoc = game?.stepLocs?.[currentStepIdx]
    || (game && stepLocations[game.id] ? stepLocations[game.id][currentStepIdx + 1] : null)

  // Track whether we've done the initial center for the current game
  const hasCenteredRef = useRef(false)
  useEffect(() => { hasCenteredRef.current = false }, [game?.id])

  // Load custom map data
  useEffect(() => {
    if (!game) return
    setMapLoading(true)
    setImageLoaded(false)
    idbGetMap(game.id).then(mapObj => {
      setCustomMapData(mapObj || null)
      setMapLoading(false)
    }).catch(() => { setCustomMapData(null); setMapLoading(false) })
    setNaturalImageSize(null)
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
    const isHovered = hoveredArea?.id === area.id
    const isCurrentLoc = area.id === currentStepLoc || area.name === currentStepLoc
    const color = AREA_COLORS[area.type] || '#a0aec0'

    if (isSelected) return { opacity: 1, fill: color + '55', stroke: '#ffffff', strokeWidth: 2.5 }
    if (isCurrentLoc) return { opacity: 1, fill: 'rgba(246,173,85,0.35)', stroke: 'var(--quest-marker-color)', strokeWidth: 3 }

    if (searchQuery) {
      const isMatch = matchedIds.has(area.id)
      return { opacity: isMatch ? 1 : 0.12, fill: isMatch ? color + '77' : color + '22', stroke: isMatch ? color : color + '44', strokeWidth: isMatch ? 2 : 1 }
    }
    if (selectedArea) return { opacity: 0.3, fill: color + '22', stroke: color + '55', strokeWidth: 1 }
    if (isHovered) return { opacity: 1, fill: color + '44', stroke: color + 'cc', strokeWidth: 2 }
    return { opacity: 0.45, fill: color + '33', stroke: color + '88', strokeWidth: 1.5 }
  }

  const mapImage = isHD ? (gameMapData?.imageHD || gameMapData?.image) : gameMapData?.image

  // Synchronously reset imageLoaded when mapImage changes so SVG never shows before PNG
  const prevMapImageRef = useRef(undefined)
  if (prevMapImageRef.current !== mapImage) {
    prevMapImageRef.current = mapImage
    if (mapImage && imageLoaded) setImageLoaded(false)
  }

  useEffect(() => {
    const handleWheel = (e) => {
      e.preventDefault()
      const rect = mapCanvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const curScale = scaleRef.current
      const newScale = Math.max(0.1, Math.min(5, curScale * delta))
      const scaleChange = newScale / curScale
      const curPan = panRef.current
      setPan({ x: mouseX - scaleChange * (mouseX - curPan.x), y: mouseY - scaleChange * (mouseY - curPan.y) })
      setScale(newScale)
    }
    const el = mapCanvasRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  // Re-run when the canvas div is actually in the DOM (after IDB load + mapLoading clears)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!gameMapData, mapLoading])

  const handleMouseDown = (e) => {
    if (e.button !== 0) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y })
  }

  const handleMouseMove = (e) => {
    if (!isDragging || !dragStart) return
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setDragStart(null)
  }

  // ── Touch handling ──────────────────────────────────────────
  // All state is kept in refs so the handlers are stable (never recreated mid-drag).
  // We call e.preventDefault() to own all touch events (stops scroll, stops the
  // 300ms click delay). That means React's onClick never fires on SVG areas from
  // a touch — so we detect taps ourselves in onEnd and call onTapArea directly.
  const touchRef = useRef({
    lastDist: null, lastMid: null,
    dragStart: null, dragging: false,
    startX: 0, startY: 0, hasMoved: false,
  })

  // Stable ref to the latest areas array so onTapArea can look up the full area object
  const areasRef = useRef(areas)
  useEffect(() => { areasRef.current = areas }, [areas])

  // Called when a tap (no significant drag) ends on a specific point
  const onTapArea = useCallback((clientX, clientY) => {
    const el = document.elementFromPoint(clientX, clientY)
    const g = el?.closest('[data-areaid]')
    if (!g) {
      setSelectedArea(null)
      setPanelOpen(false)
      return
    }
    const areaId = g.dataset.areaid
    const tapped = areasRef.current.find(a => a.id === areaId)
    if (!tapped) return
    setSelectedArea(prev => {
      if (prev?.id === areaId) { setPanelOpen(false); return null }
      setPanelOpen(true)
      return tapped
    })
  }, [])

  useEffect(() => {
    const getTouchDist = (t1, t2) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
    const getTouchMid = (t1, t2, rect) => ({
      x: (t1.clientX + t2.clientX) / 2 - rect.left,
      y: (t1.clientY + t2.clientY) / 2 - rect.top,
    })

    const onStart = (e) => {
      e.preventDefault()
      const touches = Array.from(e.touches)
      if (touches.length === 1) {
        touchRef.current.lastDist = null
        touchRef.current.lastMid = null
        touchRef.current.startX = touches[0].clientX
        touchRef.current.startY = touches[0].clientY
        touchRef.current.hasMoved = false
        touchRef.current.dragStart = { x: touches[0].clientX - panRef.current.x, y: touches[0].clientY - panRef.current.y }
        touchRef.current.dragging = true
        setIsDragging(true)
      } else if (touches.length === 2) {
        const rect = mapCanvasRef.current?.getBoundingClientRect()
        touchRef.current.lastDist = getTouchDist(touches[0], touches[1])
        touchRef.current.lastMid = rect ? getTouchMid(touches[0], touches[1], rect) : null
        touchRef.current.hasMoved = true // treat pinch as "moved" so it's never a tap
        touchRef.current.dragging = false
        touchRef.current.dragStart = null
        setIsDragging(false)
        setDragStart(null)
      }
    }

    const onMove = (e) => {
      e.preventDefault()
      const touches = Array.from(e.touches)
      if (touches.length === 1 && touchRef.current.dragging && touchRef.current.dragStart) {
        const dx = touches[0].clientX - touchRef.current.startX
        const dy = touches[0].clientY - touchRef.current.startY
        // Only mark as a drag after 6px movement — allows slight finger wobble on tap
        if (!touchRef.current.hasMoved && Math.hypot(dx, dy) > 6) {
          touchRef.current.hasMoved = true
        }
        const ds = touchRef.current.dragStart
        setPan({ x: touches[0].clientX - ds.x, y: touches[0].clientY - ds.y })
      } else if (touches.length === 2) {
        const rect = mapCanvasRef.current?.getBoundingClientRect()
        if (!rect) return
        const dist = getTouchDist(touches[0], touches[1])
        const mid = getTouchMid(touches[0], touches[1], rect)
        if (touchRef.current.lastDist != null) {
          const ratio = dist / touchRef.current.lastDist
          const curScale = scaleRef.current
          const newScale = Math.max(0.1, Math.min(5, curScale * ratio))
          const scaleChange = newScale / curScale
          const curPan = panRef.current
          setPan({ x: mid.x - scaleChange * (mid.x - curPan.x), y: mid.y - scaleChange * (mid.y - curPan.y) })
          setScale(newScale)
        }
        touchRef.current.lastDist = dist
        touchRef.current.lastMid = mid
      }
    }

    const onEnd = (e) => {
      const remaining = Array.from(e.touches)
      if (remaining.length === 0) {
        const wasTap = !touchRef.current.hasMoved
        const tapX = touchRef.current.startX
        const tapY = touchRef.current.startY
        touchRef.current.dragging = false
        touchRef.current.dragStart = null
        touchRef.current.lastDist = null
        touchRef.current.lastMid = null
        setIsDragging(false)
        setDragStart(null)
        if (wasTap) onTapArea(tapX, tapY)
      } else if (remaining.length === 1) {
        touchRef.current.lastDist = null
        touchRef.current.lastMid = null
        touchRef.current.startX = remaining[0].clientX
        touchRef.current.startY = remaining[0].clientY
        touchRef.current.hasMoved = true // coming off a pinch — not a tap
        touchRef.current.dragStart = { x: remaining[0].clientX - panRef.current.x, y: remaining[0].clientY - panRef.current.y }
        touchRef.current.dragging = true
        setIsDragging(true)
      }
    }

    const el = mapCanvasRef.current
    if (!el) return
    el.addEventListener('touchstart', onStart, { passive: false })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: false })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
    }
  // Re-run only when the canvas element appears (after IDB map load + mapLoading clears)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!gameMapData, mapLoading, onTapArea])

  const handleAreaClick = (e, area) => {
    e.stopPropagation()
    setSelectedArea(area.id === selectedArea?.id ? null : area)
    if (isMobile) setPanelOpen(true)
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

  const zoomAroundCenter = (factor) => {
    const el = mapCanvasRef.current
    const cx = el ? el.clientWidth / 2 : 400
    const cy = el ? el.clientHeight / 2 : 300
    const curScale = scaleRef.current
    const newScale = Math.max(0.1, Math.min(5, curScale * factor))
    const scaleChange = newScale / curScale
    const curPan = panRef.current
    setPan({ x: cx - scaleChange * (cx - curPan.x), y: cy - scaleChange * (cy - curPan.y) })
    setScale(newScale)
  }
  const zoomIn = () => zoomAroundCenter(1.2)
  const zoomOut = () => zoomAroundCenter(0.8)
  const zoomReset = () => { setScale(0.35); setPan({ x: 0, y: 0 }) }

  const getTransform = () => {
    let t = `translate(${pan.x}px, ${pan.y}px) scale(${scale})`
    if (rotation) t += ` rotate(${rotation}deg)`
    if (mirrored) t += ' scaleX(-1)'
    return t
  }

  // Counter-transform for SVG text so labels stay upright regardless of rotation/mirror.
  // CSS applies transforms right-to-left: scaleX(-1) first, then rotate(R).
  // To undo both in SVG (also right-to-left): counter-mirror first in string, counter-rotate second.
  const getLabelTransform = (cx, cy) => {
    const counterRotate = rotation ? `rotate(${-rotation}, ${cx}, ${cy})` : ''
    const counterMirror = mirrored
      ? `translate(${cx}, 0) scale(-1, 1) translate(${-cx}, 0)`
      : ''
    return [counterMirror, counterRotate].filter(Boolean).join(' ') || undefined
  }

  const getShapes = (area) => {
    if (area.shapes && area.shapes.length > 0) return area.shapes
    if (area.polygon && area.polygon.length > 0) return [area.polygon]
    return []
  }

  const shapesToPath = (shapes) =>
    shapes.map(pts => 'M ' + pts.map(p => p.join(',')).join(' L ') + ' Z').join(' ')

  // Returns centroid of the largest shape (always inside a rectangle)
  const getAreaCenter = (area) => {
    const shapes = getShapes(area)
    if (shapes.length === 0) return { x: 0, y: 0 }
    let best = shapes[0], bestArea = 0
    for (const pts of shapes) {
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
      const a = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))
      if (a > bestArea) { bestArea = a; best = pts }
    }
    return {
      x: best.reduce((s, p) => s + p[0], 0) / best.length,
      y: best.reduce((s, p) => s + p[1], 0) / best.length,
    }
  }

  // Center map on an area without changing zoom
  const centerOnArea = useCallback((areaNameOrId) => {
    const target = areas.find(a => a.name === areaNameOrId || a.id === areaNameOrId)
    const targetShapes = target ? (target.shapes?.length > 0 ? target.shapes : target.polygon?.length > 0 ? [target.polygon] : []) : []
    if (!target || targetShapes.length === 0) return

    const allPts = targetShapes.flat()
    const xs = allPts.map(p => p[0])
    const ys = allPts.map(p => p[1])
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2

    const el = mapCanvasRef.current
    const containerW = el?.clientWidth || 800
    const containerH = el?.clientHeight || 600
    const s = scaleRef.current

    setIsAnimating(true)
    setPan({ x: containerW / 2 - centerX * s, y: containerH / 2 - centerY * s })
    setTimeout(() => setIsAnimating(false), 350)
  }, [areas])

  // For maps with no image, center on current step loc after map data loads
  useEffect(() => {
    if (mapLoading || hasCenteredRef.current || gameMapData?.image) return
    if (currentStepLoc && areas.length > 0) {
      hasCenteredRef.current = true
      requestAnimationFrame(() => centerOnArea(currentStepLoc))
    }
  }, [mapLoading, areas.length, currentStepLoc]) // eslint-disable-line react-hooks/exhaustive-deps

  // Focus map on an area by name or id
  const focusOnArea = useCallback((areaNameOrId) => {
    const target = areas.find(a => a.name === areaNameOrId || a.id === areaNameOrId)
    const targetShapes = target ? (target.shapes?.length > 0 ? target.shapes : target.polygon?.length > 0 ? [target.polygon] : []) : []
    if (!target || targetShapes.length === 0) return

    setSelectedArea(target)

    const allPts = targetShapes.flat()
    const xs = allPts.map(p => p[0])
    const ys = allPts.map(p => p[1])
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
    idbSetMap(game.id, newMapData)
    if (user) saveMapToCloud(user.id, game.id, newMapData)
    setCustomMapData(newMapData)
    setShowEditor(false)
  }

  if (mapLoading) {
    return <MapSkeleton />
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
        {!isMobile && <div style={styles.toolDivider} />}
        {!isMobile && (
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
        )}
        <div style={styles.toolDivider} />
        <input
          style={styles.searchInput}
          placeholder={isMobile ? 'Search...' : 'Search areas or Pokémon...'}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && searchMode === 'pokemon' && (
          <span style={styles.searchModeBadge}>Pokémon</span>
        )}
        {!isMobile && (
          <>
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
          </>
        )}
        {isMobile && steps.length > 0 && (
          <button
            style={{ ...styles.toolBtn, marginLeft: 'auto', position: 'relative' }}
            onClick={() => setPanelOpen(o => !o)}
            title="Step info"
          >
            <ChevronRight size={15} style={{ transform: panelOpen ? 'rotate(90deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
          </button>
        )}
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
          onClick={() => { setSelectedArea(null); if (isMobile) setPanelOpen(false) }}
        >
          {mapImage && !imageLoaded && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none',
              background: 'linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-tertiary) 50%, var(--bg-secondary) 75%)',
              backgroundSize: '800px 100%', animation: 'map-shimmer 1.4s infinite linear' }} />
          )}
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
                  setImageLoaded(true)
                  const nw = e.target.naturalWidth
                  const nh = e.target.naturalHeight
                  if (nw && nh && (nw !== gameMapData?.width || nh !== gameMapData?.height)) {
                    setNaturalImageSize({ width: nw, height: nh })
                  }
                  // Center on current step location once per game load
                  if (currentStepLoc && !hasCenteredRef.current) {
                    hasCenteredRef.current = true
                    requestAnimationFrame(() => centerOnArea(currentStepLoc))
                  }
                }}
              />
            )}
            {(imageLoaded || !mapImage) && <svg
              ref={svgRef}
              width={mapWidth}
              height={mapHeight}
              style={{ position: 'absolute', top: 0, left: 0 }}
            >
              <defs>
                {areas.map(area => {
                  const { stroke, strokeWidth } = getAreaVisuals(area)
                  return (
                    <filter key={area.id} id={`mv-border-${area.id}`} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
                      <feMorphology in="SourceAlpha" operator="dilate" radius={strokeWidth} result="expanded" />
                      <feFlood floodColor={stroke} result="color" />
                      <feComposite in="color" in2="expanded" operator="in" result="outline" />
                      <feMerge>
                        <feMergeNode in="outline" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  )
                })}
              </defs>
              {areas.map(area => {
                const { opacity, fill } = getAreaVisuals(area)
                const isCurrentLoc = area.id === currentStepLoc || area.name === currentStepLoc
                const shapes = getShapes(area)
                if (shapes.length === 0) return null

                return (
                  <g
                    key={area.id}
                    data-areaid={area.id}
                    filter={`url(#mv-border-${area.id})`}
                    style={{ opacity, transition: 'opacity 0.15s' }}
                    onClick={(e) => handleAreaClick(e, area)}
                    onMouseEnter={(e) => handleAreaHover(e, area)}
                    onMouseLeave={handleAreaLeave}
                  >
                    <path
                      d={shapesToPath(shapes)}
                      fill={fill}
                      shapeRendering="crispEdges"
                      style={{ cursor: 'pointer', transition: 'fill 0.15s' }}
                    />
                    {showLabels && (() => {
                      const center = getAreaCenter(area)
                      return (
                        <text
                          x={center.x} y={center.y}
                          textAnchor="middle" dominantBaseline="central"
                          fill="#fff" fontSize={14 / scale} fontWeight="bold"
                          transform={getLabelTransform(center.x, center.y)}
                          style={{ pointerEvents: 'none', paintOrder: 'stroke', stroke: '#000', strokeWidth: 4 / scale }}
                        >
                          {area.name}
                        </text>
                      )
                    })()}
                    {isCurrentLoc && (() => {
                      const center = getAreaCenter(area)
                      const r = 10 / scale
                      return (
                        <g>
                          <circle cx={center.x} cy={center.y - 20 / scale} r={r} fill="var(--quest-marker-color)" />
                          <text x={center.x} y={center.y - 20 / scale} textAnchor="middle" dominantBaseline="central"
                            fill="#000" fontSize={12 / scale} fontWeight="bold"
                            transform={getLabelTransform(center.x, center.y - 20 / scale)}>!</text>
                          <line x1={center.x} y1={center.y - (20 / scale - r)} x2={center.x} y2={center.y}
                            stroke="var(--quest-marker-color)" strokeWidth={2 / scale} />
                        </g>
                      )
                    })()}
                  </g>
                )
              })}
            </svg>}
          </div>

          {/* Scale indicator */}
          <div style={styles.scaleInfo}>
            {Math.round(scale * 100)}%
          </div>
        </div>

        {/* Side panel — right column on desktop, bottom sheet on mobile */}
        <div ref={sidePanelRef} style={isMobile ? {
          ...styles.sidePanelMobile,
          transform: panelOpen ? 'translateY(0)' : 'translateY(100%)',
        } : styles.sidePanel}>
          {/* Mobile drag handle */}
          {isMobile && (
            <div style={styles.mobileHandle} onClick={() => setPanelOpen(false)}>
              <div style={styles.mobileHandleBar} />
            </div>
          )}

          {/* Current Step — hidden on mobile when an area is tapped */}
          {steps.length > 0 && !(isMobile && selectedArea) && (
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
              {currentStepLoc && (
                <button
                  style={styles.stepLocBtn}
                  onClick={() => focusOnArea(currentStepLoc)}
                  title="Center map on this location"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ flexShrink: 0 }}>
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                  {currentStepLoc}
                </button>
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

          {/* Legend — hidden when an area is selected so the detail is immediately visible */}
          {showLegend && !selectedArea && (
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

      {/* Tooltip (desktop only) */}
      {!isMobile && hoveredArea && !selectedArea && (
        <div style={{
          ...styles.tooltip,
          left: tooltipPos.x + 12,
          top: tooltipPos.y - 8,
        }}>
          {hoveredArea.name}
        </div>
      )}

      {/* Mobile step widget — pinned card or tap-to-open FAB */}
      {isMobile && steps.length > 0 && !panelOpen && !selectedArea && (
        stepPinned ? (
          <div style={styles.pinnedCard}>
            <div style={styles.pinnedTop}>
              <span style={styles.pinnedStepNum}>Step {currentStepIdx + 1}/{steps.length}</span>
              <button style={styles.pinBtn} onClick={togglePin} title="Unpin">
                <Pin size={13} />
              </button>
            </div>
            <div style={styles.pinnedText}>
              {currentStep
                ? (typeof currentStep === 'string' ? currentStep : (currentStep.text || currentStep.title || `Step ${currentStepIdx + 1}`))
                : `Step ${currentStepIdx + 1}`}
            </div>
            {currentStepLoc && (
              <button style={styles.pinnedLocBtn} onClick={() => focusOnArea(currentStepLoc)}>
                <MapPin size={11} /> {currentStepLoc}
              </button>
            )}
            <div style={styles.pinnedBtns}>
              <button
                style={{ ...styles.pinnedBtn, opacity: currentStepIdx === 0 ? 0.4 : 1 }}
                onClick={() => currentStepIdx > 0 && saveStep(currentStepIdx - 1)}
                disabled={currentStepIdx === 0}
              >← Prev</button>
              <button
                style={{ ...styles.pinnedBtn, ...styles.pinnedBtnPrimary, opacity: currentStepIdx >= steps.length - 1 ? 0.4 : 1 }}
                onClick={() => currentStepIdx < steps.length - 1 && saveStep(currentStepIdx + 1)}
                disabled={currentStepIdx >= steps.length - 1}
              >{currentStepIdx >= steps.length - 2 ? 'Finish ✓' : 'Next →'}</button>
            </div>
          </div>
        ) : (
          <div style={styles.mobileFab}>
            <button style={styles.mobileFabMain} onClick={() => setPanelOpen(true)}>
              Step {currentStepIdx + 1}/{steps.length}
            </button>
            <button style={styles.mobileFabPin} onClick={togglePin} title="Pin step info">
              <Pin size={13} />
            </button>
          </div>
        )
      )}
      {/* Area-selected FAB */}
      {isMobile && selectedArea && !panelOpen && (
        <button style={styles.mobileFabSimple} onClick={() => setPanelOpen(true)}>
          {selectedArea.name}
        </button>
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

function MapSkeleton() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      <style>{`
        @keyframes map-sk-shimmer {
          0% { background-position: -800px 0 }
          100% { background-position: 800px 0 }
        }
        .map-skel {
          background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-tertiary) 50%, var(--bg-secondary) 75%);
          background-size: 800px 100%;
          animation: map-sk-shimmer 1.4s infinite linear;
          border-radius: 6px;
        }
      `}</style>
      {/* Toolbar skeleton */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="map-skel" style={{ width: 32, height: 32, borderRadius: 6 }} />
        ))}
        <div style={{ flex: 1 }} />
        <div className="map-skel" style={{ width: 160, height: 30, borderRadius: 6 }} />
      </div>
      {/* Map area skeleton */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div className="map-skel" style={{ position: 'absolute', inset: 0, borderRadius: 0 }} />
        </div>
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
    flexWrap: 'wrap',
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
    width: 'clamp(90px, 30vw, 190px)',
    outline: 'none',
    minWidth: 0,
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
    position: 'relative',
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
  sidePanelMobile: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '55%',
    background: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border-color)',
    borderRadius: '16px 16px 0 0',
    overflowY: 'auto',
    zIndex: 100,
    transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
    boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
  },
  mobileHandle: {
    display: 'flex',
    justifyContent: 'center',
    padding: '10px 0 6px',
    cursor: 'pointer',
    flexShrink: 0,
  },
  mobileHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    background: 'var(--border-color)',
  },
  stepCard: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    padding: 12,
    borderBottom: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
  },
  stepLocBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginBottom: 8,
    background: 'var(--game-color)18',
    color: 'var(--game-color)',
    border: '1px solid var(--game-color)44',
    borderRadius: 10,
    padding: '2px 8px 2px 6px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background 0.15s',
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
  mobileFab: {
    position: 'absolute',
    bottom: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 20,
    zIndex: 50,
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    overflow: 'hidden',
    maxWidth: '86vw',
  },
  mobileFabMain: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  mobileFabPin: {
    background: 'transparent',
    border: 'none',
    borderLeft: '1px solid var(--border-color)',
    color: 'var(--text-muted)',
    padding: '8px 12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  mobileFabSimple: {
    position: 'absolute',
    bottom: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 20,
    padding: '8px 18px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    zIndex: 50,
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    whiteSpace: 'nowrap',
    maxWidth: '80vw',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  pinnedCard: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 14,
    padding: '10px 12px',
    zIndex: 50,
    boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  pinnedTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pinnedStepNum: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  pinBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--game-color)',
    cursor: 'pointer',
    padding: '2px 4px',
    display: 'flex',
    alignItems: 'center',
    borderRadius: 4,
  },
  pinnedText: {
    fontSize: 13,
    color: 'var(--text-primary)',
    lineHeight: 1.45,
    maxHeight: 56,
    overflowY: 'auto',
  },
  pinnedLocBtn: {
    alignSelf: 'flex-start',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: 'var(--game-color)18',
    color: 'var(--game-color)',
    border: '1px solid var(--game-color)44',
    borderRadius: 10,
    padding: '2px 8px 2px 6px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  },
  pinnedBtns: {
    display: 'flex',
    gap: 6,
  },
  pinnedBtn: {
    flex: 1,
    background: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '6px 0',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  pinnedBtnPrimary: {
    background: 'var(--game-color)',
    color: '#fff',
    border: 'none',
  },
}

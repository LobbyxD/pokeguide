import React, { useState } from 'react'
import { typeChart } from '../data/index.js'
import TypeBadge, { TYPE_COLORS, getTypeTextColor } from '../components/TypeBadge.jsx'

const TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice',
  'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
  'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
]

function getEffectiveness(attacker, defender) {
  const row = typeChart[attacker]
  if (!row) return 1
  return row[defender] !== undefined ? row[defender] : 1
}

function getCellStyle(value, highlighted) {
  if (value === 0)   return { bg: '#9b2335', text: '#fff',    label: '0×' }
  if (value === 0.5) return { bg: '#92400e', text: '#fde68a', label: '½×' }
  if (value === 2)   return { bg: '#14532d', text: '#86efac', label: '2×' }
  if (value === 4)   return { bg: '#0c3b1f', text: '#4ade80', label: '4×' }
  return {
    bg: highlighted ? 'rgba(255,255,255,0.07)' : 'transparent',
    text: 'transparent',
    label: '',
  }
}

const CELL = 36 // uniform cell size in px
const ROW_HEADER_W = 100

export default function TypeChartView() {
  const [mode, setMode] = useState('full')
  const [selectedType, setSelectedType] = useState(null)
  const [hovered, setHovered] = useState(null) // { row, col }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>Type Chart</h2>
        <div style={styles.modeSelector}>
          {['full', 'attacker', 'defender'].map(m => (
            <button
              key={m}
              style={{ ...styles.modeBtn, ...(mode === m ? styles.modeBtnActive : {}) }}
              onClick={() => { setMode(m); setSelectedType(null) }}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {mode === 'full' && (
        <div style={styles.tableWrapper}>
          <div style={styles.tableScroll}>
            <div>
              <table style={styles.table} onMouseLeave={() => setHovered(null)}>
                <thead>
                  <tr>
                    {/* Corner */}
                    <th style={{ ...styles.cornerCell, width: ROW_HEADER_W, minWidth: ROW_HEADER_W }}>
                      <div style={styles.cornerDiag}>
                        <span style={styles.cornerAtk}>ATK</span>
                        <span style={styles.cornerDef}>DEF</span>
                      </div>
                    </th>
                    {TYPES.map(type => {
                      const isColHovered = hovered?.col === type
                      return (
                        <th
                          key={type}
                          style={{ ...styles.colHeader, width: CELL, minWidth: CELL }}
                        >
                          <div style={{
                            ...styles.colHeaderInner,
                            background: isColHovered ? TYPE_COLORS[type] + '33' : 'transparent',
                          }}>
                            <img src={`/types/${type}.png`} alt={type} height={16} style={{ display: 'block' }} />
                            <span style={{
                              fontSize: 8,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: 0.3,
                              color: isColHovered ? TYPE_COLORS[type] : 'var(--text-muted)',
                              whiteSpace: 'nowrap',
                            }}>
                              {type.slice(0, 3)}
                            </span>
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {TYPES.map(attacker => {
                    const isRowHovered = hovered?.row === attacker
                    return (
                      <tr key={attacker}>
                        <td style={{
                          ...styles.rowHeader,
                          width: ROW_HEADER_W,
                          background: isRowHovered ? 'rgba(255,255,255,0.04)' : 'transparent',
                        }}>
                          <TypeBadge type={attacker} height={20} />
                        </td>
                        {TYPES.map(defender => {
                          const val = getEffectiveness(attacker, defender)
                          const isHighlighted = hovered?.row === attacker || hovered?.col === defender
                          const isCrossCenter = hovered?.row === attacker && hovered?.col === defender
                          const cell = getCellStyle(val, isHighlighted)
                          return (
                            <td
                              key={defender}
                              style={{
                                ...styles.cell,
                                width: CELL,
                                minWidth: CELL,
                                height: CELL,
                                background: cell.bg,
                                color: cell.text,
                                outline: isCrossCenter ? '2px solid rgba(255,255,255,0.35)' : 'none',
                                outlineOffset: -2,
                              }}
                              onMouseEnter={() => setHovered({ row: attacker, col: defender })}
                            >
                              {cell.label}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div style={styles.legend}>
            {[
              { bg: '#9b2335', text: '#fff', label: '0×', desc: 'No effect' },
              { bg: '#92400e', text: '#fde68a', label: '½×', desc: 'Not very effective' },
              { bg: 'transparent', text: 'var(--text-muted)', label: '—', desc: 'Normal (1×)' },
              { bg: '#14532d', text: '#86efac', label: '2×', desc: 'Super effective' },
              { bg: '#0c3b1f', text: '#4ade80', label: '4×', desc: 'Doubly super effective' },
            ].map(({ bg, text, label, desc }) => (
              <div key={label} style={styles.legendItem}>
                <div style={{
                  ...styles.legendBox,
                  background: bg,
                  color: text,
                  border: bg === 'transparent' ? '1px solid var(--border-color)' : 'none',
                }}>
                  {label}
                </div>
                <span style={styles.legendLabel}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(mode === 'attacker' || mode === 'defender') && (
        <div style={styles.modeView}>
          <div style={styles.modePicker}>
            <div style={styles.modePickerTitle}>
              Select {mode === 'attacker' ? 'attacking' : 'defending'} type:
            </div>
            <div style={styles.typePillGrid}>
              {TYPES.map(t => (
                <button
                  key={t}
                  style={{
                    ...styles.typePillBtn,
                    outline: selectedType === t ? `2px solid ${TYPE_COLORS[t]}` : '2px solid transparent',
                    opacity: selectedType && selectedType !== t ? 0.5 : 1,
                  }}
                  onClick={() => setSelectedType(selectedType === t ? null : t)}
                >
                  <TypeBadge type={t} height={20} />
                </button>
              ))}
            </div>
          </div>
          {selectedType && (
            <div style={styles.resultsGrid}>
              {TYPES.map(other => {
                const val = mode === 'attacker'
                  ? getEffectiveness(selectedType, other)
                  : getEffectiveness(other, selectedType)
                const cell = getCellStyle(val, true)
                return (
                  <div key={other} style={{
                    ...styles.resultCard,
                    background: cell.label ? cell.bg : 'var(--bg-card)',
                    border: cell.label ? 'none' : '1px solid var(--border-color)',
                  }}>
                    <TypeBadge type={other} height={20} style={{ marginBottom: 6 }} />
                    <div style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: cell.label ? cell.text : 'var(--text-muted)',
                    }}>
                      {cell.label || '1×'}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
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
    background: 'var(--bg-primary)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    borderBottom: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    margin: 0,
  },
  modeSelector: {
    display: 'flex',
    gap: 4,
    background: 'var(--bg-primary)',
    padding: 3,
    borderRadius: 8,
    border: '1px solid var(--border-color)',
  },
  modeBtn: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: 'none',
    borderRadius: 6,
    padding: '5px 14px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  modeBtnActive: {
    background: 'var(--game-color)',
    color: '#fff',
  },
  tableWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minHeight: 0,
  },
  tableScroll: {
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  table: {
    borderCollapse: 'collapse',
    fontSize: 11,
    tableLayout: 'fixed',
  },
  cornerCell: {
    padding: '4px 6px',
    position: 'relative',
    verticalAlign: 'bottom',
  },
  cornerDiag: {
    position: 'relative',
    height: 48,
    borderBottom: '1px solid var(--border-color)',
    borderRight: '1px solid var(--border-color)',
  },
  cornerAtk: {
    position: 'absolute',
    bottom: 3,
    left: 4,
    fontSize: 8,
    fontWeight: 700,
    color: 'var(--text-muted)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cornerDef: {
    position: 'absolute',
    top: 3,
    right: 4,
    fontSize: 8,
    fontWeight: 700,
    color: 'var(--text-muted)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  colHeader: {
    padding: '0 1px',
    textAlign: 'center',
    verticalAlign: 'bottom',
    cursor: 'default',
  },
  colHeaderInner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '4px 2px',
    borderRadius: 4,
    gap: 2,
    transition: 'background 0.1s',
  },
  rowHeader: {
    padding: '2px 6px 2px 0',
    whiteSpace: 'nowrap',
    textAlign: 'right',
    verticalAlign: 'middle',
    transition: 'background 0.1s',
  },
  cell: {
    textAlign: 'center',
    verticalAlign: 'middle',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'default',
    userSelect: 'none',
    transition: 'background 0.06s',
    border: '1px solid rgba(255,255,255,0.04)',
  },
  legend: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    padding: '10px 20px',
    borderTop: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  legendBox: {
    width: 36,
    height: 26,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  modeView: {
    flex: 1,
    overflow: 'auto',
    padding: 24,
  },
  modePicker: {
    marginBottom: 24,
  },
  modePickerTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: 12,
  },
  typePillGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  typePillBtn: {
    background: 'transparent',
    border: 'none',
    padding: 3,
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'opacity 0.15s, outline 0.12s',
  },
  resultsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: 8,
  },
  resultCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '14px 10px',
    borderRadius: 10,
    textAlign: 'center',
    gap: 2,
  },
}

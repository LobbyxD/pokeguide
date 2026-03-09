import React from 'react'

export const TYPE_COLORS = {
  normal: '#A8A878', fire: '#F08030', water: '#6890F0', electric: '#F8D030',
  grass: '#78C850', ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0',
  ground: '#E0C068', flying: '#A890F0', psychic: '#F85888', bug: '#A8B820',
  rock: '#B8A038', ghost: '#705898', dragon: '#7038F8', dark: '#705848',
  steel: '#B8B8D0', fairy: '#EE99AC',
}

const DARK_TEXT_TYPES = new Set(['normal', 'electric', 'ground', 'ice', 'steel', 'fairy'])
export function getTypeTextColor(type) {
  return DARK_TEXT_TYPES.has(type) ? '#1a1a1a' : '#fff'
}

/**
 * TypeBadge — local icon + type name in a colored pill.
 *
 * Props:
 *   type        — type string e.g. 'fire'
 *   height      — pill height in px (default 22)
 *   iconOnly    — show just the icon image, no pill background or name
 *   style       — extra styles on the outer element
 */
export default function TypeBadge({ type, height = 22, iconOnly = false, style = {} }) {
  if (!type) return null

  const cap = type.charAt(0).toUpperCase() + type.slice(1)
  const iconH = Math.round(height * 0.72)
  const iconSrc = `/types/${type}.png`

  if (iconOnly) {
    return (
      <img
        src={iconSrc}
        alt={cap}
        title={cap}
        height={iconH}
        style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
      />
    )
  }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: Math.round(height * 0.28),
      background: TYPE_COLORS[type] || '#a0aec0',
      color: getTypeTextColor(type),
      padding: `${Math.round(height * 0.18)}px ${Math.round(height * 0.42)}px`,
      borderRadius: Math.round(height * 0.28),
      fontWeight: 700,
      fontSize: Math.round(height * 0.58),
      textTransform: 'capitalize',
      letterSpacing: 0.2,
      whiteSpace: 'nowrap',
      lineHeight: 1,
      ...style,
    }}>
      <img src={iconSrc} alt="" height={iconH} style={{ display: 'block', flexShrink: 0 }} />
      {cap}
    </span>
  )
}

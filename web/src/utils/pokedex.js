import { idbGet, idbSet } from './idb.js'
import { writeStorage } from './store.js'

async function fetchOnePokemon(id, versionGroup) {
  const [specRes, pkRes] = await Promise.all([
    fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`),
    fetch(`https://pokeapi.co/api/v2/pokemon/${id}`),
  ])
  if (!specRes.ok || !pkRes.ok) return null

  const [spec, pk] = await Promise.all([specRes.json(), pkRes.json()])

  const types = pk.types.map(t => t.type.name)
  const stats = {}
  pk.stats.forEach(s => { stats[s.stat.name.replace('-', '_')] = s.base_stat })
  const abilities = pk.abilities.map(a => a.ability.name)

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

  return { id, name: pk.name, sprite: pk.sprites.front_default, types, stats, abilities, locations, evolution }
}

/**
 * Generate Pokédex for a game, saving to IDB + localStorage.
 * @param {object} game - game object with id, totalPokemon, versionSlug
 * @param {function} onProgress - called with (current, total) after each batch
 * @returns {Promise<boolean>} true if successful
 */
export async function generatePokedex(game, onProgress) {
  if (!game?.pokedexFile) return false

  const total = game.totalPokemon || 151
  const versionSlug = game.versionSlug || ''
  const results = []
  const BATCH = 5

  onProgress?.(0, total)

  for (let i = 1; i <= total; i += BATCH) {
    const batch = Array.from({ length: Math.min(BATCH, total - i + 1) }, (_, j) => i + j)
    try {
      const batchResults = await Promise.all(batch.map(id => fetchOnePokemon(id, versionSlug)))
      batchResults.forEach(p => { if (p) results.push(p) })
    } catch {}
    onProgress?.(Math.min(i + BATCH - 1, total), total)
  }

  if (results.length === 0) return false

  await idbSet(game.id, results)
  writeStorage(`pg_pokedex_${game.id}`, JSON.stringify(results))
  return true
}

/**
 * Check if a game already has Pokédex data in IDB or localStorage cache.
 */
export async function hasPokedexData(game) {
  if (!game?.pokedexFile) return true // no pokedex configured — skip
  try {
    const cached = localStorage.getItem(`pg_pokedex_${game.id}`)
    if (cached) {
      const data = JSON.parse(cached)
      if (data?.length > 0) return true
    }
    const idbData = await idbGet(game.id)
    return idbData?.length > 0
  } catch {
    return false
  }
}

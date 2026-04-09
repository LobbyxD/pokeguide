/**
 * IndexedDB wrapper for large data storage in the browser.
 * Stores: pokedex, games, maps — no 5MB limit like localStorage.
 */

const DB_NAME = 'pokeguide'
const VERSION = 2

const STORES = ['pokedex', 'games', 'maps']

let _db = null

function openDB() {
  if (_db) return Promise.resolve(_db)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store)
        }
      }
    }
    req.onsuccess = () => { _db = req.result; resolve(_db) }
    req.onerror = () => reject(req.error)
    req.onblocked = () => {
      // Another tab has the old DB version open — force it closed
      if (_db) { _db.close(); _db = null }
    }
  })
}

function get(store, key) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }))
}

function set(store, key, value) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).put(value, key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  }))
}

function del(store, key) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).delete(key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  }))
}

// ── Pokedex store ─────────────────────────────────────────────
export const idbGet = (key) => get('pokedex', key)
export const idbSet = (key, value) => set('pokedex', key, value)
export const idbDelete = (key) => del('pokedex', key)

// ── Games store ───────────────────────────────────────────────
export const idbGetGames = () => get('games', 'all')
export const idbSetGames = (games) => set('games', 'all', games)

// ── Maps store ────────────────────────────────────────────────
export const idbGetMap = (gameId) => get('maps', gameId)
export const idbSetMap = (gameId, mapData) => set('maps', gameId, mapData)
export const idbDeleteMap = (gameId) => del('maps', gameId)

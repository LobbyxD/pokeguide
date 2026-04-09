import { useState, useEffect } from 'react'

const EVENT = 'pg-store'

/** Write a value to localStorage and notify all listeners in this window */
export function writeStorage(key, value) {
  const str = typeof value === 'string' ? value : JSON.stringify(value)
  localStorage.setItem(key, str)
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { key } }))
}

/** Remove a key from localStorage and notify all listeners */
export function removeStorage(key) {
  localStorage.removeItem(key)
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { key } }))
}

/** React hook — returns live value from localStorage, updates whenever key is written via writeStorage */
export function useStorageValue(key, defaultValue = null) {
  const read = () => {
    if (!key) return defaultValue
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) return defaultValue
      try { return JSON.parse(raw) } catch { return raw }
    } catch { return defaultValue }
  }

  const [value, setValue] = useState(read)

  useEffect(() => {
    setValue(read())
    if (!key) return
    const handler = (e) => { if (e.detail.key === key) setValue(read()) }
    window.addEventListener(EVENT, handler)
    return () => window.removeEventListener(EVENT, handler)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  return value
}

/** Subscribe to storage changes for a specific key (non-hook version for classes/effects) */
export function onStorageChange(key, callback) {
  const handler = (e) => { if (e.detail.key === key) callback() }
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}

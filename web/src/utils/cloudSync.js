/**
 * Cloud sync layer — saves/loads user data to/from Supabase.
 *
 * Table: user_data
 *   id           uuid  (references auth.users, primary key)
 *   games        jsonb
 *   settings     jsonb
 *   map_settings jsonb
 *   progress     jsonb  (key → stepIndex, e.g. { "pg_step_progress_abc": 3 })
 *   maps         jsonb  (gameId → { areas, width, height, imageUrl } — no base64)
 *   updated_at   timestamptz
 *
 * Storage bucket: "maps"  (public)
 *   Path: {userId}/{gameId}.png  (or .jpg etc.)
 *
 * SQL to run in Supabase SQL editor:
 *
 *   -- Table (if not exists)
 *   create table if not exists user_data (
 *     id uuid references auth.users on delete cascade primary key,
 *     games jsonb default '[]'::jsonb,
 *     settings jsonb default '{}'::jsonb,
 *     map_settings jsonb default '{}'::jsonb,
 *     progress jsonb default '{}'::jsonb,
 *     maps jsonb default '{}'::jsonb,
 *     updated_at timestamptz default now()
 *   );
 *   alter table user_data enable row level security;
 *   drop policy if exists "Users manage own data" on user_data;
 *   create policy "Users manage own data" on user_data
 *     for all using (auth.uid() = id) with check (auth.uid() = id);
 *   alter table user_data add column if not exists maps jsonb default '{}'::jsonb;
 *
 *   -- Storage bucket
 *   insert into storage.buckets (id, name, public) values ('maps', 'maps', true)
 *     on conflict (id) do nothing;
 *   create policy "Public map read" on storage.objects
 *     for select using (bucket_id = 'maps');
 *   create policy "Auth map upload" on storage.objects
 *     for insert with check (bucket_id = 'maps' and auth.role() = 'authenticated');
 *   create policy "Auth map update" on storage.objects
 *     for update using (bucket_id = 'maps' and auth.role() = 'authenticated');
 *   create policy "Auth map delete" on storage.objects
 *     for delete using (bucket_id = 'maps' and auth.role() = 'authenticated');
 */
import { supabase } from '../firebase.js'
import { idbSetGames, idbSetMap, idbGetMap } from './idb.js'

// ── Image helpers ─────────────────────────────────────────────

// Convert base64 data URL → Blob
function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)[1]
  const binary = atob(base64)
  const arr = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

// Upload a base64 image to Supabase Storage, return the public URL
async function uploadMapImage(userId, gameId, dataUrl) {
  try {
    const blob = dataUrlToBlob(dataUrl)
    const ext = blob.type.split('/')[1] || 'png'
    const path = `${userId}/${gameId}.${ext}`
    const { error } = await supabase.storage
      .from('maps')
      .upload(path, blob, { upsert: true, contentType: blob.type })
    if (error) {
      console.error('[cloudSync] image upload error:', error.message)
      return null
    }
    const { data } = supabase.storage.from('maps').getPublicUrl(path)
    return data.publicUrl
  } catch (err) {
    console.error('[cloudSync] image upload exception:', err)
    return null
  }
}

// Prepare mapData for cloud: upload base64 images to Storage, keep URLs as-is.
// Falls back to storing base64 directly in DB if Storage upload fails (≤ 5MB).
async function prepareMapForCloud(userId, gameId, mapData) {
  if (!mapData) return null
  const { imageHD, ...rest } = mapData
  const image = mapData.image

  // No image — just store areas/dimensions
  if (!image) return rest

  // Already a public URL — keep as-is
  if (!image.startsWith('data:')) return rest

  // Try uploading to Storage first
  const url = await uploadMapImage(userId, gameId, image)
  if (url) return { ...rest, image: url }

  // Storage failed — fall back to storing base64 directly if it's small enough (< 5MB)
  const sizeBytes = Math.ceil((image.length * 3) / 4)
  if (sizeBytes < 5 * 1024 * 1024) {
    console.warn('[cloudSync] Storage upload failed, storing base64 in DB as fallback')
    return rest // rest already contains image (not destructured out)
  }

  // Too large for DB — store without image rather than fail entirely
  console.warn('[cloudSync] Map image too large for DB fallback, storing areas only')
  const { image: _img, ...noImage } = rest
  return noImage
}

// ── Fetch current row (never throws) ─────────────────────────

async function fetchRow(userId) {
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('games, settings, map_settings, progress, maps')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      if (error.message?.includes('maps')) {
        const { data: data2 } = await supabase
          .from('user_data')
          .select('games, settings, map_settings, progress')
          .eq('id', userId)
          .maybeSingle()
        return data2 || null
      }
      console.error('[cloudSync] fetchRow error:', error.message)
      return null
    }
    return data || null
  } catch (err) {
    console.error('[cloudSync] fetchRow exception:', err)
    return null
  }
}

// ── Upsert helper ─────────────────────────────────────────────

async function upsertUserData(userId, patch) {
  try {
    const { error } = await supabase
      .from('user_data')
      .upsert({ id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (error) {
      console.error('[cloudSync] upsert error:', error.message, error)
      return false
    }
    return true
  } catch (err) {
    console.error('[cloudSync] upsert exception:', err)
    return false
  }
}

async function upsertWithFallback(userId, patch) {
  const ok = await upsertUserData(userId, patch)
  if (!ok && 'maps' in patch) {
    const { maps: _maps, ...patchWithoutMaps } = patch
    return upsertUserData(userId, patchWithoutMaps)
  }
  return ok
}

// ── Load user data from Supabase → IDB/localStorage ──────────

export async function loadUserData(userId) {
  const data = await fetchRow(userId)
  if (!data) return false

  if (Array.isArray(data.games) && data.games.length > 0) {
    await idbSetGames(data.games)
  }
  if (data.settings && typeof data.settings === 'object') {
    localStorage.setItem('pg_settings', JSON.stringify(data.settings))
  }
  if (data.map_settings && typeof data.map_settings === 'object') {
    localStorage.setItem('pg_map_settings', JSON.stringify(data.map_settings))
  }
  if (data.progress && typeof data.progress === 'object') {
    for (const [key, val] of Object.entries(data.progress)) {
      localStorage.setItem(key, String(val))
    }
  }
  if (data.maps && typeof data.maps === 'object') {
    for (const [gameId, mapData] of Object.entries(data.maps)) {
      await idbSetMap(gameId, mapData)
    }
  }
  return true
}

// ── Public save functions ─────────────────────────────────────

export async function saveGamesToCloud(userId, games) {
  await upsertWithFallback(userId, { games })
}

export async function saveProgressToCloud(userId, gameId, stepIndex) {
  const row = await fetchRow(userId)
  const existing = row?.progress || {}
  await upsertWithFallback(userId, { progress: { ...existing, [`pg_step_progress_${gameId}`]: stepIndex } })
}

export async function saveSettingsToCloud(userId, settings) {
  await upsertWithFallback(userId, { settings })
}

export async function saveMapSettingsToCloud(userId, mapSettings) {
  await upsertWithFallback(userId, { map_settings: mapSettings })
}

// Upload image to Storage (if base64), store clean mapData (with URL) in DB
export async function saveMapToCloud(userId, gameId, mapData) {
  const cleanMap = await prepareMapForCloud(userId, gameId, mapData)
  const row = await fetchRow(userId)
  const existing = row?.maps || {}
  await upsertWithFallback(userId, { maps: { ...existing, [gameId]: cleanMap } })
}

// ── Push all local data up to cloud (first login / data loss) ─
// Only runs if cloud has no games yet.

export async function pushLocalDataToCloud(userId, games, defaultMapData = {}) {
  if (!games || games.length === 0) return

  const row = await fetchRow(userId)
  if (row && Array.isArray(row.games) && row.games.length > 0) return

  console.log('[cloudSync] Cloud has no games — pushing local data up')

  const maps = {}
  for (const game of games) {
    try {
      const idbMap = await idbGetMap(game.id)
      const fallback = defaultMapData[game.id] || defaultMapData[game.versionSlug] || null
      const raw = idbMap || fallback
      if (raw) {
        const clean = await prepareMapForCloud(userId, game.id, raw)
        if (clean) maps[game.id] = clean
      }
    } catch {}
  }

  const progress = {}
  const settings = (() => { try { return JSON.parse(localStorage.getItem('pg_settings') || '{}') } catch { return {} } })()
  const map_settings = (() => { try { return JSON.parse(localStorage.getItem('pg_map_settings') || '{}') } catch { return {} } })()
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('pg_step_progress_')) progress[key] = localStorage.getItem(key)
  }

  const patch = { games, settings, map_settings, progress }
  if (Object.keys(maps).length > 0) patch.maps = maps

  await upsertWithFallback(userId, patch)
  console.log('[cloudSync] Local data pushed to cloud')
}

// Profile is stored in Supabase Auth user_metadata — no separate table needed.
export async function saveUserProfile(_userId, _profile) {}

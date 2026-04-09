/**
 * Cloud sync layer — saves/loads user data to/from Supabase.
 *
 * Table: user_data
 *   id          uuid  (references auth.users, primary key)
 *   games       jsonb
 *   settings    jsonb
 *   map_settings jsonb
 *   progress    jsonb  (key → stepIndex, e.g. { "pg_step_progress_abc": 3 })
 *   updated_at  timestamptz
 *
 * Run this SQL in your Supabase SQL editor to create the table:
 *
 *   create table user_data (
 *     id uuid references auth.users on delete cascade primary key,
 *     games jsonb default '[]'::jsonb,
 *     settings jsonb default '{}'::jsonb,
 *     map_settings jsonb default '{}'::jsonb,
 *     progress jsonb default '{}'::jsonb,
 *     updated_at timestamptz default now()
 *   );
 *   alter table user_data enable row level security;
 *   create policy "Users manage own data" on user_data
 *     for all using (auth.uid() = id);
 */
import { supabase } from '../firebase.js'
import { idbSetGames } from './idb.js'

// ── Load user data from Supabase → localStorage ───────────────

export async function loadUserData(userId) {
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('games, settings, map_settings, progress')
      .eq('id', userId)
      .single()

    if (error || !data) return

    if (Array.isArray(data.games)) {
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
  } catch (err) {
    console.warn('loadUserData error:', err)
  }
}

// ── Upsert helper ─────────────────────────────────────────────

async function upsertUserData(userId, patch) {
  try {
    await supabase
      .from('user_data')
      .upsert({ id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  } catch (err) {
    console.warn('upsertUserData error:', err)
  }
}

// ── Public save functions ─────────────────────────────────────

export async function saveGamesToCloud(userId, games) {
  await upsertUserData(userId, { games })
}

export async function saveProgressToCloud(userId, gameId, stepIndex) {
  // Read existing progress first to merge (Supabase doesn't support partial jsonb update via client)
  try {
    const { data } = await supabase
      .from('user_data')
      .select('progress')
      .eq('id', userId)
      .single()

    const existing = data?.progress || {}
    const key = `pg_step_progress_${gameId}`
    await upsertUserData(userId, { progress: { ...existing, [key]: stepIndex } })
  } catch (err) {
    console.warn('saveProgressToCloud error:', err)
  }
}

export async function saveSettingsToCloud(userId, settings) {
  await upsertUserData(userId, { settings })
}

export async function saveMapSettingsToCloud(userId, mapSettings) {
  await upsertUserData(userId, { map_settings: mapSettings })
}

// Profile is stored in Supabase Auth user_metadata — no separate table needed.
export async function saveUserProfile(_userId, _profile) {
  // No-op: Supabase Auth already stores the Google profile in user.user_metadata
}

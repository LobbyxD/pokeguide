// ─────────────────────────────────────────────────────────────
// Supabase configuration
// Replace the values below with your project's credentials.
// How to get them:
//   1. Go to https://supabase.com and create a project
//   2. Project Settings → API → copy "Project URL" and "anon public" key
//   3. Authentication → Providers → enable Google (add OAuth Client ID/Secret)
//      (Google OAuth credentials: https://console.cloud.google.com)
// ─────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://yeufihpdpgdbxvddkxys.supabase.co"; // e.g. https://yeufihpdpgdbxvddkxys.supabase.co
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlldWZpaHBkcGdkYnh2ZGRreHlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MTc1MTIsImV4cCI6MjA5MTI5MzUxMn0.VXIIZYFmX50TJEW35U4HBOu79Wc4tXKO6zED2aDE_qw";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Auth helpers (same API as the old firebase.js) ────────────

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) throw error;
  // Note: this triggers a full-page redirect to Google.
  // When the user returns, onAuthChange fires automatically.
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Subscribe to auth state changes.
 * Calls callback(user) immediately with the current user (or null),
 * then again whenever the session changes.
 * Returns an unsubscribe function.
 */
export function onAuthChange(callback) {
  // Fire immediately with the current session
  supabase.auth.getSession().then(({ data: { session } }) => {
    callback(session?.user ?? null);
  });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });

  return () => subscription.unsubscribe();
}

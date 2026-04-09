import React, { useState } from 'react'
import { signInWithGoogle } from '../firebase.js'

export default function AuthPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError(null)
    try {
      await signInWithGoogle()
      // Page will redirect to Google — loading state stays until redirect
    } catch (err) {
      setError('Sign-in failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      {/* Background decoration */}
      <div style={styles.bgBlob1} />
      <div style={styles.bgBlob2} />

      <div style={styles.content}>
        {/* Hero */}
        <div style={styles.hero}>
          <img src="/app-icon.png" alt="PokeGuide" style={styles.logo}
            onError={e => { e.target.style.display = 'none' }} />
          <h1 style={styles.title}>PokeGuide</h1>
          <p style={styles.subtitle}>
            Your Pokémon walkthrough companion.<br />
            Track progress, explore maps, browse the Pokédex.
          </p>
        </div>

        {/* Sign-in card */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Get Started</h2>
          <p style={styles.cardSub}>Sign in with Google to save your progress across devices.</p>

          <button style={{ ...styles.googleBtn, ...(loading ? styles.googleBtnLoading : {}) }}
            onClick={handleGoogleSignIn} disabled={loading}>
            {loading ? (
              <span style={styles.spinner} />
            ) : (
              <GoogleIcon />
            )}
            <span>{loading ? 'Signing in...' : 'Continue with Google'}</span>
          </button>

          {error && (
            <div style={styles.error}>{error}</div>
          )}

          <div style={styles.divider}>
            <div style={styles.dividerLine} />
            <span style={styles.dividerText}>or</span>
            <div style={styles.dividerLine} />
          </div>

          {/* Download section */}
          <div style={styles.downloadSection}>
            <div style={styles.downloadLabel}>Want the Windows desktop app?</div>
            <a
              href="https://github.com/LobbyxD/pokeguide/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.downloadBtn}
            >
              <WindowsIcon />
              Download for Windows
            </a>
            <p style={styles.downloadNote}>
              Free installer · Offline support · Auto-updates
            </p>
          </div>
        </div>

        {/* Features grid */}
        <div style={styles.features}>
          {[
            { icon: '📋', title: 'Walkthrough Tracker', desc: 'Step-by-step progress tracking for any Pokémon game' },
            { icon: '🗺️', title: 'Interactive Maps', desc: 'Zoomable region maps with area details and Pokémon locations' },
            { icon: '📖', title: 'Pokédex', desc: 'Browse and search Pokémon with stats, types, and abilities' },
            { icon: '⚔️', title: 'Type Chart', desc: 'Full 18×18 type effectiveness chart for battle strategy' },
          ].map(f => (
            <div key={f.title} style={styles.featureCard}>
              <span style={styles.featureIcon}>{f.icon}</span>
              <div style={styles.featureTitle}>{f.title}</div>
              <div style={styles.featureDesc}>{f.desc}</div>
            </div>
          ))}
        </div>

        <div style={styles.footer}>
          <span style={{ color: 'var(--text-muted)' }}>by R2D2 Games</span>
          <span style={{ color: 'var(--border-color)' }}>·</span>
          <a href="https://github.com/LobbyxD/pokeguide" target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>GitHub</a>
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
      <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.615 24 12.255 24z"/>
      <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09z"/>
      <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.64 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/>
    </svg>
  )
}

function WindowsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
    </svg>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg-primary)',
    overflowY: 'auto',
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
  },
  bgBlob1: {
    position: 'fixed', top: '-200px', right: '-200px',
    width: '600px', height: '600px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(229,62,62,0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  bgBlob2: {
    position: 'fixed', bottom: '-200px', left: '-200px',
    width: '500px', height: '500px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(66,153,225,0.06) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  content: {
    maxWidth: 840,
    width: '100%',
    padding: '60px 24px 40px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 48,
    position: 'relative',
    zIndex: 1,
  },
  hero: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  logo: {
    width: 80, height: 80,
    imageRendering: 'pixelated',
    filter: 'drop-shadow(0 4px 24px rgba(229,62,62,0.3))',
  },
  title: {
    fontSize: 'clamp(36px, 8vw, 56px)',
    fontWeight: 800,
    background: 'linear-gradient(135deg, #e53e3e, #fc8181)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    letterSpacing: '-1px',
    margin: 0,
  },
  subtitle: {
    fontSize: 'clamp(14px, 3vw, 17px)',
    color: 'var(--text-secondary)',
    lineHeight: 1.7,
    margin: 0,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 16,
    padding: '32px 28px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
  },
  cardTitle: {
    fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8,
  },
  cardSub: {
    fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24,
  },
  googleBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
    width: '100%', padding: '13px 16px',
    background: '#fff', color: '#1a1a1a',
    border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600,
    cursor: 'pointer', transition: 'all 0.15s',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  },
  googleBtnLoading: { opacity: 0.7, cursor: 'not-allowed' },
  spinner: {
    display: 'inline-block', width: 18, height: 18,
    border: '2px solid rgba(0,0,0,0.15)', borderTop: '2px solid #1a1a1a',
    borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0,
  },
  error: {
    marginTop: 12, padding: '10px 14px', background: 'rgba(229,62,62,0.12)',
    border: '1px solid rgba(229,62,62,0.3)', borderRadius: 8,
    fontSize: 13, color: '#fc8181',
  },
  divider: {
    display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0',
  },
  dividerLine: { flex: 1, height: 1, background: 'var(--border-color)' },
  dividerText: { fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' },
  downloadSection: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center',
  },
  downloadLabel: { fontSize: 13, color: 'var(--text-secondary)' },
  downloadBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 10,
    padding: '11px 22px',
    background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
    border: '1px solid var(--border-color)', borderRadius: 10,
    fontSize: 14, fontWeight: 600, textDecoration: 'none',
    transition: 'all 0.15s',
  },
  downloadNote: {
    fontSize: 11, color: 'var(--text-muted)', margin: 0,
  },
  features: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 16,
    width: '100%',
  },
  featureCard: {
    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
    borderRadius: 12, padding: '20px 16px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  featureIcon: { fontSize: 28 },
  featureTitle: { fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' },
  featureDesc: { fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 },
  footer: {
    display: 'flex', alignItems: 'center', gap: 12,
    fontSize: 12, color: 'var(--text-muted)', paddingBottom: 8,
  },
}

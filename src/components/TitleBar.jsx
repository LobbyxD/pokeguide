import React, { useState, useEffect } from 'react'

// Win11-style SVG icons for window controls
const MinimizeIcon = () => (
  <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
    <rect width="10" height="1" />
  </svg>
)

const MaximizeIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
    <rect x="0.5" y="0.5" width="9" height="9" />
  </svg>
)

const RestoreIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
    <rect x="2.5" y="0.5" width="7" height="7" />
    <path d="M0.5 2.5v7h7" />
  </svg>
)

const CloseIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
    <line x1="0.5" y1="0.5" x2="9.5" y2="9.5" />
    <line x1="9.5" y1="0.5" x2="0.5" y2="9.5" />
  </svg>
)

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.isMaximized().then(setIsMaximized)
      window.electronAPI.onMaximizedState((state) => setIsMaximized(state))
    }
  }, [])

  return (
    <div style={styles.titlebar}>
      <div style={styles.left}>
        <img
          src="/app-icon.png"
          alt="PokeGuide"
          style={styles.logo}
          onError={e => { e.target.style.display = 'none' }}
        />
        <span style={styles.title}>PokéGuide</span>
        <span style={styles.version}>v{__APP_VERSION__}</span>
      </div>

      <div style={styles.controls}>
        <button
          className="titlebar-ctrl"
          onClick={() => window.electronAPI?.minimize()}
          title="Minimize"
        >
          <MinimizeIcon />
        </button>
        <button
          className="titlebar-ctrl"
          onClick={() => window.electronAPI?.maximize()}
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
        </button>
        <button
          className="titlebar-ctrl titlebar-close"
          onClick={() => window.electronAPI?.close()}
          title="Close"
        >
          <CloseIcon />
        </button>
      </div>

      <style>{`
        .titlebar-ctrl {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          width: 46px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.1s, color 0.1s;
          -webkit-app-region: no-drag;
        }
        .titlebar-ctrl:hover {
          background: rgba(255,255,255,0.08);
          color: var(--text-primary);
        }
        .titlebar-close:hover {
          background: #c42b1c !important;
          color: #fff !important;
        }
      `}</style>
    </div>
  )
}

const styles = {
  titlebar: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    WebkitAppRegion: 'drag',
    zIndex: 9999,
    userSelect: 'none',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
  },
  logo: {
    width: 20,
    height: 20,
    objectFit: 'contain',
    borderRadius: 4,
    flexShrink: 0,
    WebkitAppRegion: 'no-drag',
  },
  title: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
    letterSpacing: 0.1,
  },
  version: {
    fontSize: 10,
    color: 'var(--text-muted)',
    background: 'var(--bg-tertiary)',
    padding: '1px 6px',
    borderRadius: 10,
    fontFamily: 'monospace',
    border: '1px solid var(--border-color)',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    WebkitAppRegion: 'no-drag',
  },
}

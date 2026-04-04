import React, { useState, useEffect, useRef } from 'react'

// ── Win11-style window control SVGs ───────────────────────────────────────────
const SvgClose    = () => <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><line x1="0.5" y1="0.5" x2="9.5" y2="9.5"/><line x1="9.5" y1="0.5" x2="0.5" y2="9.5"/></svg>
const SvgMinimize = () => <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor"><rect width="10" height="1"/></svg>

// ── Small reusable components ──────────────────────────────────────────────────
function Checkbox({ checked, onChange, label }) {
  return (
    <label style={s.checkRow} onClick={() => onChange(!checked)}>
      <div style={{ ...s.checkBox, background: checked ? '#0078d4' : 'transparent', borderColor: checked ? '#0078d4' : '#555' }}>
        {checked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L4 7L9 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </div>
      <span style={s.checkLabel}>{label}</span>
    </label>
  )
}

function ProgressBar({ value }) {
  return (
    <div style={s.progTrack}>
      <div style={{ ...s.progFill, width: `${value}%` }} />
    </div>
  )
}

function TitleBar({ version, onClose, onMinimize }) {
  return (
    <div style={s.titlebar}>
      <div style={s.tbLeft}>
        <img src="/app-icon.png" alt="" style={s.tbIcon} onError={e => { e.target.style.display = 'none' }} />
        <span style={s.tbTitle}>PokeGuide Setup</span>
        {version && <span style={s.tbVer}>v{version}</span>}
      </div>
      <div style={s.tbBtns}>
        <button className="tb-btn" onClick={onMinimize}><SvgMinimize /></button>
        <button className="tb-btn tb-close" onClick={onClose}><SvgClose /></button>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function InstallerApp() {
  const api = window.installerAPI

  // screen: loading | fresh | existing | installing | done | uninstalling | uninstalled | error
  const [screen, setScreen]           = useState('loading')
  const [info, setInfo]               = useState(null)          // from installer-get-info
  const [installDir, setInstallDir]   = useState('')
  const [desktop, setDesktop]         = useState(true)
  const [startMenu, setStartMenu]     = useState(true)
  const [launch, setLaunch]           = useState(true)
  const [deleteData, setDeleteData]   = useState(false)
  const [progress, setProgress]       = useState(0)
  const [progressLabel, setProgLabel] = useState('Copying files…')
  const [error, setError]             = useState('')
  const [visible, setVisible]         = useState(false)

  useEffect(() => {
    if (!api) return
    api.onProgress((pct) => {
      setProgress(pct)
      if (pct < 72)       setProgLabel('Copying files…')
      else if (pct < 80)  setProgLabel('Updating registry…')
      else if (pct < 95)  setProgLabel('Creating shortcuts…')
      else                setProgLabel('Almost done…')
    })
    api.getSetupInfo().then(data => {
      setInfo(data)
      setInstallDir(data.defaultInstallDir)
      setTimeout(() => setVisible(true), 80)
      setScreen(data.mode === 'repair' ? 'existing' : 'fresh')
    })
  }, [])

  // ── Actions ──────────────────────────────────────────────────────────────────
  async function handleInstall() {
    setScreen('installing')
    setProgress(0)
    try {
      await api.doInstall({ finalDir: installDir, desktop, startMenu })
      setProgress(100)
      setProgLabel('Done!')
      await delay(300)
      setScreen('done')
    } catch (e) {
      setError(e.message || 'Installation failed.')
      setScreen('error')
    }
  }

  async function handleRepair() {
    setScreen('installing')
    setProgress(0)
    setProgLabel('Reinstalling files…')
    try {
      await api.doRepair({ desktop, startMenu })
      setProgress(100)
      setProgLabel('Done!')
      await delay(300)
      setScreen('done')
    } catch (e) {
      setError(e.message || 'Repair failed.')
      setScreen('error')
    }
  }

  async function handleUninstall() {
    setScreen('uninstalling')
    try {
      await api.doUninstall({ deleteData })
      // doUninstall quits the app itself
    } catch (e) {
      setError(e.message)
      setScreen('error')
    }
  }

  async function handleFinish() {
    if (info?.mode === 'fresh') {
      await api.launchFinal(installDir)
    } else {
      await api.finish(launch)
    }
  }

  async function handleBrowse() {
    const dir = await api.browseDir()
    if (dir) setInstallDir(dir)
  }

  function handleClose() { api?.closeWindow() }
  function handleMinimize() { api?.minimizeWindow() }

  // ── Render ───────────────────────────────────────────────────────────────────
  const fadeIn = { opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(10px)', transition: 'opacity 0.3s ease, transform 0.3s ease' }
  const ver = info?.version || ''

  return (
    <div style={s.root}>
      <TitleBar version={ver} onClose={handleClose} onMinimize={handleMinimize} />
      <div style={s.accentStrip} />

      <div style={{ ...s.body, ...fadeIn }}>

        {/* ── Loading ── */}
        {screen === 'loading' && (
          <div style={s.center}><div style={s.spinner} /></div>
        )}

        {/* ── Fresh install ── */}
        {screen === 'fresh' && (
          <>
            <div style={s.heading}>Install PokeGuide</div>
            <div style={s.sub}>Version {ver}</div>

            <div style={s.section}>
              <div style={s.label}>Install Location</div>
              <div style={s.dirRow}>
                <input
                  style={s.dirInput}
                  value={installDir}
                  onChange={e => setInstallDir(e.target.value)}
                  spellCheck={false}
                />
                <button style={s.btnSecondary} onClick={handleBrowse}>Browse…</button>
              </div>
            </div>

            <div style={s.section}>
              <div style={s.label}>Shortcuts</div>
              <div style={s.checkGroup}>
                <Checkbox checked={desktop}   onChange={setDesktop}   label="Create Desktop shortcut" />
                <Checkbox checked={startMenu} onChange={setStartMenu} label="Add to Start Menu" />
              </div>
            </div>

            <div style={s.section}>
              <Checkbox checked={launch} onChange={setLaunch} label="Launch PokeGuide after install" />
            </div>

            <div style={s.footer}>
              <button style={s.btnPrimary} onClick={handleInstall}>Install</button>
            </div>
          </>
        )}

        {/* ── Existing install: Repair or Uninstall ── */}
        {screen === 'existing' && (
          <>
            <div style={s.heading}>PokeGuide is already installed</div>
            <div style={s.sub}>Version {ver} · {info?.stagingDir || ''}</div>

            <div style={s.existingCard}>
              <div style={s.existingOption} onClick={handleRepair}>
                <div style={s.existingIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a9edd" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                  </svg>
                </div>
                <div>
                  <div style={s.optTitle}>Repair Installation</div>
                  <div style={s.optSub}>Reinstall app files. Your presets and data are kept.</div>
                </div>
              </div>

              <div style={{ height: 1, background: '#3e3e3e', margin: '0 16px' }} />

              <div style={s.existingOption} onClick={() => setScreen('confirmUninstall')}>
                <div style={{ ...s.existingIcon, background: 'rgba(200,50,50,0.1)', border: '1px solid rgba(200,50,50,0.2)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e06c6c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </div>
                <div>
                  <div style={{ ...s.optTitle, color: '#e06c6c' }}>Uninstall</div>
                  <div style={s.optSub}>Remove PokeGuide from this computer.</div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Confirm uninstall ── */}
        {screen === 'confirmUninstall' && (
          <>
            <div style={s.heading}>Uninstall PokeGuide</div>
            <div style={s.sub}>This will remove PokeGuide from your computer.</div>

            <div style={{ ...s.section, marginTop: 24 }}>
              <div style={s.label}>Saved data</div>
              <Checkbox
                checked={deleteData}
                onChange={setDeleteData}
                label="Delete my presets and Pokédex cache"
              />
              <div style={{ fontSize: 11, color: '#666', marginTop: 6, marginLeft: 26 }}>
                Uncheck to keep your data in case you reinstall later.
              </div>
            </div>

            <div style={s.footer}>
              <button style={s.btnGhost} onClick={() => setScreen('existing')}>Back</button>
              <button style={{ ...s.btnPrimary, background: '#c42b1c' }} onClick={handleUninstall}>
                Uninstall
              </button>
            </div>
          </>
        )}

        {/* ── Installing / repairing progress ── */}
        {screen === 'installing' && (
          <div style={s.center}>
            <div style={{ ...s.heading, marginBottom: 24 }}>
              {info?.mode === 'repair' ? 'Repairing…' : 'Installing…'}
            </div>
            <div style={{ width: '100%' }}>
              <ProgressBar value={progress} />
              <div style={s.progLabel}>{progressLabel}</div>
            </div>
          </div>
        )}

        {/* ── Uninstalling ── */}
        {screen === 'uninstalling' && (
          <div style={s.center}>
            <div style={s.heading}>Uninstalling…</div>
            <div style={{ marginTop: 16 }}><div style={s.spinner} /></div>
          </div>
        )}

        {/* ── Done ── */}
        {screen === 'done' && (
          <>
            <div style={s.doneRow}>
              <div style={s.doneCircle}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <path d="M6 14L11 19L22 9" stroke="#4ec98a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <div style={s.heading}>
                  {info?.mode === 'repair' ? 'Repair Complete' : 'Installation Complete'}
                </div>
                <div style={s.sub}>PokeGuide v{ver} is ready.</div>
              </div>
            </div>

            {info?.mode === 'repair' && (
              <div style={s.infoNote}>
                Your presets, Pokédex data and settings have been preserved.
              </div>
            )}

            {info?.mode === 'repair' && (
              <div style={s.section}>
                <Checkbox checked={launch} onChange={setLaunch} label="Launch PokeGuide" />
              </div>
            )}

            <div style={s.footer}>
              <button style={s.btnPrimary} onClick={handleFinish}>
                {info?.mode === 'fresh' && launch ? 'Launch PokeGuide' : 'Finish'}
              </button>
            </div>
          </>
        )}

        {/* ── Error ── */}
        {screen === 'error' && (
          <div style={s.center}>
            <div style={{ color: '#e06c6c', fontSize: 15, marginBottom: 8 }}>Setup encountered an error</div>
            <div style={{ color: '#999', fontSize: 12, maxWidth: 340, textAlign: 'center' }}>{error}</div>
            <button style={{ ...s.btnPrimary, marginTop: 24 }} onClick={handleClose}>Close</button>
          </div>
        )}

      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow: hidden; font-family: -apple-system, 'Segoe UI', sans-serif; background: transparent; }
        .tb-btn {
          background: transparent; border: none; color: #9d9d9d;
          width: 46px; height: 40px; display: flex; align-items: center;
          justify-content: center; cursor: pointer;
          transition: background 0.1s, color 0.1s; -webkit-app-region: no-drag;
        }
        .tb-btn:hover { background: rgba(255,255,255,0.08); color: #ccc; }
        .tb-close:hover { background: #c42b1c !important; color: #fff !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
        button:active { opacity: 0.85; }
      `}</style>
    </div>
  )
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = {
  root: {
    width: '100vw', height: '100vh',
    background: '#1e1e1e', color: '#cccccc',
    display: 'flex', flexDirection: 'column',
    border: '1px solid #3e3e3e', borderRadius: 8, overflow: 'hidden',
  },
  titlebar: {
    height: 40, background: '#252526',
    borderBottom: '1px solid #3e3e3e',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    WebkitAppRegion: 'drag', userSelect: 'none', flexShrink: 0,
  },
  tbLeft:  { display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 12 },
  tbIcon:  { width: 18, height: 18, objectFit: 'contain', borderRadius: 3, WebkitAppRegion: 'no-drag' },
  tbTitle: { fontSize: 13, fontWeight: 600, color: '#cccccc' },
  tbVer:   { fontSize: 10, color: '#6a6a6a', background: '#2d2d30', padding: '1px 6px', borderRadius: 10, fontFamily: 'monospace', border: '1px solid #3e3e3e' },
  tbBtns:  { display: 'flex', WebkitAppRegion: 'no-drag' },
  accentStrip: { height: 3, background: 'linear-gradient(90deg,#cc2222,#e03333)', flexShrink: 0 },
  body: {
    flex: 1, padding: '26px 28px 22px',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  center:  { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 17, fontWeight: 700, color: '#e0e0e0', lineHeight: 1.2 },
  sub:     { fontSize: 12, color: '#777', marginTop: 4, marginBottom: 18 },
  section: { marginBottom: 16 },
  label:   { fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600, marginBottom: 8 },

  dirRow:  { display: 'flex', gap: 8 },
  dirInput: {
    flex: 1, background: '#2d2d30', border: '1px solid #3e3e3e',
    borderRadius: 4, padding: '6px 10px', color: '#ccc',
    fontSize: 12, fontFamily: 'monospace', outline: 'none',
  },

  checkGroup: { display: 'flex', flexDirection: 'column', gap: 10 },
  checkRow:   { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' },
  checkBox:   { width: 16, height: 16, border: '1.5px solid #555', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s, border-color 0.15s' },
  checkLabel: { fontSize: 13, color: '#ccc' },

  footer: { marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 10 },

  btnPrimary: {
    background: '#0078d4', color: '#fff', border: 'none', borderRadius: 5,
    padding: '8px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  btnSecondary: {
    background: '#2d2d30', color: '#aaa', border: '1px solid #3e3e3e',
    borderRadius: 4, padding: '6px 12px', fontSize: 12, cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnGhost: {
    background: 'transparent', color: '#888', border: '1px solid #3e3e3e',
    borderRadius: 5, padding: '8px 16px', fontSize: 13, cursor: 'pointer',
  },

  existingCard: {
    background: '#252526', border: '1px solid #3e3e3e',
    borderRadius: 8, overflow: 'hidden', marginTop: 4,
  },
  existingOption: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '16px 18px', cursor: 'pointer',
    transition: 'background 0.12s',
  },
  existingIcon: {
    width: 44, height: 44, borderRadius: '50%',
    background: 'rgba(74,158,221,0.1)', border: '1px solid rgba(74,158,221,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  optTitle: { fontSize: 14, fontWeight: 600, color: '#e0e0e0', marginBottom: 3 },
  optSub:   { fontSize: 12, color: '#777' },

  progTrack: { height: 4, background: '#333', borderRadius: 2, overflow: 'hidden', width: '100%' },
  progFill:  { height: '100%', background: '#0078d4', borderRadius: 2, transition: 'width 0.25s ease' },
  progLabel: { fontSize: 11, color: '#666', marginTop: 8, textAlign: 'center' },

  doneRow: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 },
  doneCircle: {
    width: 56, height: 56, borderRadius: '50%',
    background: 'rgba(0,200,100,0.1)', border: '1px solid rgba(78,201,138,0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  infoNote: {
    fontSize: 12, color: '#888',
    background: '#2a2a2a', border: '1px solid #3e3e3e',
    borderLeft: '3px solid #0078d4',
    borderRadius: 4, padding: '8px 12px', marginBottom: 16,
  },
  spinner: {
    width: 28, height: 28, border: '3px solid #333',
    borderTop: '3px solid #0078d4', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
}

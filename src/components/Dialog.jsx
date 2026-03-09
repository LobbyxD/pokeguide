import React, { createContext, useContext, useState, useCallback } from 'react'

const DialogContext = createContext(null)

export function useDialog() {
  return useContext(DialogContext)
}

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null)

  const showDialog = useCallback((options) => {
    return new Promise((resolve) => {
      setDialog({ ...options, resolve })
    })
  }, [])

  const confirm = useCallback((message, options = {}) => {
    return showDialog({ type: 'confirm', message, ...options })
  }, [showDialog])

  const alert = useCallback((message, options = {}) => {
    return showDialog({ type: options.type || 'alert', message, ...options })
  }, [showDialog])

  const close = (result) => {
    if (dialog?.resolve) dialog.resolve(result)
    setDialog(null)
  }

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      {dialog && <DialogModal dialog={dialog} onClose={close} />}
    </DialogContext.Provider>
  )
}

function DialogModal({ dialog, onClose }) {
  const { type, title, message, danger, confirmLabel, cancelLabel } = dialog
  const isConfirm = type === 'confirm'
  const isSuccess = type === 'success'
  const isError = type === 'error'

  const accentColor = (danger || isError) ? '#e53e3e' : isSuccess ? '#38a169' : 'var(--game-color)'
  const icon = (danger || isError) ? '⚠' : isSuccess ? '✓' : isConfirm ? '?' : 'ℹ'

  return (
    <div style={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(false) }}>
      <div style={styles.modal}>
        <div style={{ ...styles.icon, background: accentColor + '22', color: accentColor, border: `1px solid ${accentColor}44` }}>
          {icon}
        </div>
        {title && <div style={styles.title}>{title}</div>}
        <div style={{ ...styles.message, marginTop: title ? 6 : 0 }}>{message}</div>
        <div style={styles.actions}>
          {isConfirm && (
            <button style={styles.btnSecondary} onClick={() => onClose(false)} autoFocus={!danger}>
              {cancelLabel || 'Cancel'}
            </button>
          )}
          <button
            style={{ ...styles.btnPrimary, background: accentColor }}
            onClick={() => onClose(true)}
            autoFocus={!isConfirm || danger}
          >
            {confirmLabel || (isConfirm ? 'Confirm' : 'OK')}
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    backdropFilter: 'blur(3px)',
  },
  modal: {
    width: 340,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 14,
    padding: '28px 28px 22px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 14,
    flexShrink: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    lineHeight: 1.55,
    marginBottom: 22,
  },
  actions: {
    display: 'flex',
    gap: 10,
    width: '100%',
  },
  btnPrimary: {
    flex: 1,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 0',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnSecondary: {
    flex: 1,
    background: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '10px 0',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
}

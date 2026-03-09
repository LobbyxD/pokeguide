import React, { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, RotateCcw, Check, Play } from '../components/Icons.jsx'
import { writeStorage } from '../utils/store.js'

export default function WalkthroughView({ game, games, onSaveGames }) {
  const [currentStep, setCurrentStep] = useState(0)
  const activeRef = useRef(null)

  useEffect(() => {
    if (!game) return
    const stored = localStorage.getItem(`pg_step_progress_${game.id}`)
    setCurrentStep(stored ? parseInt(stored) : 0)
  }, [game?.id])

  const saveStep = (idx) => {
    setCurrentStep(idx)
    writeStorage(`pg_step_progress_${game.id}`, String(idx))
  }

  const handleBack = () => {
    if (currentStep > 0) saveStep(currentStep - 1)
  }

  const handleNext = () => {
    if (game && currentStep < game.steps.length - 1) saveStep(currentStep + 1)
  }

  const handleReset = () => {
    if (window.confirm('Reset progress for this game?')) saveStep(0)
  }

  const handleFinish = () => {
    if (game) saveStep(game.steps.length - 1)
  }

  const handleStepClick = (idx) => {
    saveStep(idx)
  }

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [currentStep, game?.id])

  if (!game) return <div style={styles.empty}>No game selected</div>

  const steps = game.steps || []
  const progress = steps.length > 0 ? Math.round((currentStep / steps.length) * 100) : 0
  const isComplete = currentStep >= steps.length - 1

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h2 style={styles.title}>{game.title}</h2>
          <span style={styles.region}>{game.region}</span>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${progress}%`, background: game.color }} />
          </div>
          <span style={styles.progressText}>
            {currentStep + 1} / {steps.length} steps ({progress}%)
          </span>
        </div>
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <button
          style={{ ...styles.btn, ...styles.btnSecondary, display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={handleBack}
          disabled={currentStep === 0}
        >
          <ChevronLeft size={13} /> Back
        </button>
        <button
          style={{ ...styles.btn, ...styles.btnDanger, display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={handleReset}
        >
          <RotateCcw size={13} /> Reset
        </button>
        {isComplete ? (
          <span style={{ ...styles.badge, background: '#38a169', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Check size={13} /> Complete!
          </span>
        ) : (
          <button
            style={{ ...styles.btn, background: game.color, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={handleNext}
          >
            Next <ChevronRight size={13} />
          </button>
        )}
        <button
          style={{ ...styles.btn, ...styles.btnGhost }}
          onClick={handleFinish}
        >
          Finish All
        </button>
      </div>

      {/* Current step card */}
      {steps.length > 0 && (
        <div style={{ ...styles.activeCard, borderColor: game.color, boxShadow: `0 0 0 1px ${game.color}44` }}>
          <div style={styles.activeHeader}>
            <span style={{ ...styles.activeBadge, background: game.color }}>Active Step</span>
            <span style={styles.stepNum}>Step {currentStep + 1}</span>
          </div>
          <p style={styles.activeText}>{steps[currentStep]}</p>
        </div>
      )}

      {/* All steps list */}
      <div style={styles.stepsList}>
        <div style={styles.stepsHeader}>All Steps</div>
        {steps.map((step, idx) => {
          const isActive = idx === currentStep
          const isCompleted = idx < currentStep
          const isLocked = idx > currentStep + 5 // show locked for far future steps

          return (
            <div
              key={idx}
              ref={isActive ? activeRef : null}
              style={{
                ...styles.stepItem,
                ...(isActive ? { ...styles.stepActive, borderLeft: `3px solid ${game.color}`, background: `${game.color}15` } : {}),
                ...(isCompleted ? styles.stepCompleted : {}),
              }}
              onClick={() => handleStepClick(idx)}
            >
              <div style={styles.stepIcon}>
                {isCompleted ? (
                  <span style={{ color: '#38a169', display: 'flex' }}><Check size={13} /></span>
                ) : isActive ? (
                  <span style={{ color: game.color, display: 'flex' }}><Play size={10} /></span>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{idx + 1}</span>
                )}
              </div>
              <div style={styles.stepContent}>
                <p style={{
                  ...styles.stepText,
                  color: isActive ? 'var(--text-primary)' : isCompleted ? 'var(--text-muted)' : 'var(--text-secondary)',
                  textDecoration: isCompleted ? 'line-through' : 'none',
                }}>
                  {step}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const styles = {
  container: {
    height: '100%',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px 16px',
    borderBottom: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
  },
  region: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    background: 'var(--bg-tertiary)',
    padding: '2px 8px',
    borderRadius: 10,
  },
  headerRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 6,
  },
  progressBar: {
    width: 160,
    height: 6,
    background: 'var(--bg-tertiary)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.4s ease',
  },
  progressText: {
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 24px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-color)',
    flexShrink: 0,
  },
  btn: {
    padding: '7px 16px',
    borderRadius: 6,
    border: '1px solid var(--border-color)',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  btnSecondary: {
    background: 'var(--bg-card)',
  },
  btnDanger: {
    background: '#e53e3e22',
    color: '#e53e3e',
    borderColor: '#e53e3e44',
  },
  btnGhost: {
    background: 'transparent',
    borderColor: 'transparent',
    color: 'var(--text-muted)',
    marginLeft: 'auto',
  },
  badge: {
    padding: '5px 12px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    color: '#fff',
  },
  activeCard: {
    margin: '20px 24px',
    padding: '16px 20px',
    background: 'var(--bg-card)',
    border: '1px solid',
    borderRadius: 10,
    flexShrink: 0,
  },
  activeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  activeBadge: {
    padding: '2px 10px',
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 700,
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepNum: {
    fontSize: 12,
    color: 'var(--text-muted)',
  },
  activeText: {
    fontSize: 15,
    lineHeight: 1.6,
    color: 'var(--text-primary)',
    fontWeight: 500,
  },
  stepsList: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 24px 24px',
  },
  stepsHeader: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    padding: '16px 0 8px',
    position: 'sticky',
    top: 0,
    background: 'var(--bg-primary)',
  },
  stepItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'all 0.15s',
    marginBottom: 2,
    borderLeft: '3px solid transparent',
  },
  stepActive: {},
  stepCompleted: {
    opacity: 0.6,
  },
  stepIcon: {
    width: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  stepContent: {
    flex: 1,
  },
  stepText: {
    fontSize: 13,
    lineHeight: 1.5,
    margin: 0,
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--text-muted)',
    fontSize: 16,
  },
}

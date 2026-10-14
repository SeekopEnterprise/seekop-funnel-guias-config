import { useEffect } from 'react'

const ICONS = {
  danger:  '🗑️',
  warning: '⚠️',
  save:    '💾',
  info:    'ℹ️',
}

export default function Modal({ open, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', variant = 'danger', onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()} data-variant={variant}>
        <div className="modal-icon-wrap">
          <span className="modal-icon">{ICONS[variant] || ICONS.info}</span>
        </div>
        <h3 className="modal-title">{title}</h3>
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button className="modal-btn modal-btn-cancel" onClick={onCancel}>{cancelLabel}</button>
          <button className={`modal-btn modal-btn-confirm modal-btn-${variant}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

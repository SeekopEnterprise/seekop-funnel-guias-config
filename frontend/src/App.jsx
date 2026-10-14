import { useState, useEffect, useCallback } from 'react'
import Modal from './Modal.jsx'
import './Modal.css'

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.sicopweb.com/guiasfunnel-dev'

const INDICADOR_DISPLAY = { gestionables: 'efectivos', efectivas: 'shows' }
const INDICADOR_REVERSE = { efectivos: 'gestionables', shows: 'efectivas' }

const TIPO_COLORS = {
  leads:    '#27ae60',
  piso:     '#2980b9',
  cartera:  '#e67e22',
  calle:    '#8e44ad',
  nacional: '#c0392b',
}

let tempId = -1
function newTempId() { return tempId-- }

export default function App() {
  const [token,      setToken]     = useState('')
  const [cliente,    setCliente]   = useState('')
  const [rows,       setRows]      = useState([])
  const [dirty,      setDirty]     = useState(new Set())
  const [saving,     setSaving]    = useState(new Set())
  const [loading,    setLoading]   = useState(false)
  const [filterTipo,    setFilterTipo]    = useState('nacional')
  const [configOptions, setConfigOptions] = useState({})

  // ── Toasts ──
  const [toasts, setToasts] = useState([])
  function toast(msg, type = 'success') {
    setToasts(prev => {
      // No duplicar el mismo mensaje que ya está visible
      if (prev.some(t => t.msg === msg && t.type === type)) return prev
      const id = Date.now()
      setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000)
      return [...prev, { id, msg, type }]
    })
  }
  function closeToast(id) { setToasts(prev => prev.filter(t => t.id !== id)) }
  function clearToasts()  { setToasts([]) }

  // ── Modal ──
  const [modal, setModal] = useState({ open: false })
  function confirm({ title, message, variant = 'danger', confirmLabel, onConfirm }) {
    setModal({ open: true, title, message, variant, confirmLabel, onConfirm })
  }
  function closeModal() { setModal({ open: false }) }

  // ── Auth desde padre ──
  function authHeaders() {
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  }

  useEffect(() => {
    function onMessage(e) {
      const { type, token: t, cliente: c } = e.data || {}
      if (type !== 'GUIAS_FUNNEL_INIT') return
      if (t) setToken(t)
      if (c) setCliente(c)
    }
    window.addEventListener('message', onMessage)
    window.parent.postMessage({ type: 'GUIAS_FUNNEL_READY' }, '*')
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // ── Carga guías + catálogo de indicadores ──
  const loadGuias = useCallback(async (tkn, cli) => {
    if (!tkn || !cli) return
    setLoading(true)
    setRows([])
    setDirty(new Set())
    try {
      const res  = await fetch(`${API_BASE}/guias?cliente=${cli}`, {
        headers: { 'Authorization': `Bearer ${tkn}`, 'Content-Type': 'application/json' }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Error al cargar')
      setRows(
        [...data.guias]
          .sort((a, b) => a.idguia - b.idguia)
          .map(r => ({ ...r, guia: r.guia != null ? Math.round(parseFloat(r.guia)) : 0 }))
      )
      setConfigOptions(data.indicadores || {})
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!token || !cliente) return
    const t = setTimeout(() => loadGuias(token, cliente), 700)
    return () => clearTimeout(t)
  }, [token, cliente, loadGuias])

  // ── Helpers ──
  function toDisplay(indicador) {
    if (cliente === 'nissancorp') return indicador
    return INDICADOR_DISPLAY[indicador] || indicador
  }
  function toReal(display) {
    if (cliente === 'nissancorp') return display
    return INDICADOR_REVERSE[display] || display
  }

  function updateRow(id, field, value) {
    setRows(prev => prev.map(r => r.idguia === id ? { ...r, [field]: value } : r))
    setDirty(prev => new Set([...prev, id]))
  }

  // ── Guardar una fila ──
  async function saveRow(row) {
    setSaving(prev => new Set([...prev, row.idguia]))
    try {
      const guia  = row.guia === '' || row.guia === null || row.guia === undefined ? 0 : Number(row.guia)
      const body  = { cliente, tipocontacto: row.tipocontacto, indicador: row.indicador, guia, orden: Number(row.orden), puntos: Number(row.puntos) }
      const isNew = row.idguia < 0
      const res   = await fetch(
        isNew ? `${API_BASE}/guias` : `${API_BASE}/guias/${row.idguia}`,
        { method: isNew ? 'POST' : 'PUT', headers: authHeaders(), body: JSON.stringify(body) }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      if (isNew && data.data) {
        const saved = { ...data.data, guia: data.data.guia != null ? Math.round(parseFloat(data.data.guia)) : 0 }
        setRows(prev => prev.map(r => r.idguia === row.idguia ? saved : r))
      }
      setDirty(prev => { const s = new Set(prev); s.delete(row.idguia); return s })
      return true
    } catch (e) {
      toast(e.message, 'error')
      return false
    } finally {
      setSaving(prev => { const s = new Set(prev); s.delete(row.idguia); return s })
    }
  }

  // ── Guardar todos los cambios pendientes ──
  async function saveAll() {
    const pending = rows.filter(r => dirty.has(r.idguia))
    confirm({
      title: 'Guardar todos los cambios',
      message: `Se guardarán ${pending.length} guia${pending.length !== 1 ? 's' : ''} con cambios pendientes.`,
      variant: 'save',
      confirmLabel: 'Guardar todo',
      onConfirm: async () => {
        closeModal()
        let ok = 0
        for (const row of pending) {
          const saved = await saveRow(row)
          if (saved) ok++
        }
        toast(`${ok} de ${pending.length} guias guardadas correctamente`)
      }
    })
  }

  // ── Eliminar una fila ──
  async function deleteRow(row) {
    confirm({
      title: 'Eliminar guia',
      message: `¿Estás seguro de eliminar "${toDisplay(row.indicador)}"? Esta acción no se puede deshacer.`,
      variant: 'danger',
      confirmLabel: 'Eliminar',
      onConfirm: async () => {
        closeModal()
        if (row.idguia < 0) {
          setRows(prev => prev.filter(r => r.idguia !== row.idguia))
          setDirty(prev => { const s = new Set(prev); s.delete(row.idguia); return s })
          return
        }
        try {
          const res  = await fetch(`${API_BASE}/guias/${row.idguia}?cliente=${cliente}`, { method: 'DELETE', headers: authHeaders() })
          const data = await res.json()
          if (!res.ok) throw new Error(data.message)
          setRows(prev => prev.filter(r => r.idguia !== row.idguia))
          toast('Guia eliminada correctamente')
        } catch (e) {
          toast(e.message, 'error')
        }
      }
    })
  }

  // ── Eliminar todas las filas del filtro actual ──
  async function deleteAllFiltered() {
    const targets = filtered
    confirm({
      title: `Eliminar todas las guias de "${filterTipo}"`,
      message: `Se eliminarán ${targets.length} guia${targets.length !== 1 ? 's' : ''} de ${filterTipo}. Esta acción no se puede deshacer.`,
      variant: 'danger',
      confirmLabel: `Eliminar ${targets.length}`,
      onConfirm: async () => {
        closeModal()
        let ok = 0
        for (const row of targets) {
          if (row.idguia < 0) {
            setRows(prev => prev.filter(r => r.idguia !== row.idguia))
            setDirty(prev => { const s = new Set(prev); s.delete(row.idguia); return s })
            ok++
            continue
          }
          try {
            const res = await fetch(`${API_BASE}/guias/${row.idguia}?cliente=${cliente}`, { method: 'DELETE', headers: authHeaders() })
            if (res.ok) { ok++; setRows(prev => prev.filter(r => r.idguia !== row.idguia)) }
          } catch {}
        }
        toast(`${ok} guias eliminadas de ${filterTipo}`)
      }
    })
  }

  // ── Copiar nacional a otros ──
  const OTROS_TIPOS = ['leads', 'piso', 'calle', 'cartera']
  function copyNacionalToOthers() {
    const nacionales = rows.filter(r => r.tipocontacto === 'nacional')
    const updatedIds = new Set()

    const sameIndicador = (a, b) => a.toLowerCase() === b.toLowerCase()

    // Actualiza filas existentes que coincidan por indicador (sin distinción de mayúsculas)
    let updatedRows = rows.map(row => {
      if (!OTROS_TIPOS.includes(row.tipocontacto)) return row
      const match = nacionales.find(n => sameIndicador(n.indicador, row.indicador))
      if (!match) return row
      // Solo marcar como dirty si los valores realmente cambiaron
      if (row.guia !== match.guia || row.puntos !== match.puntos) {
        updatedIds.add(row.idguia)
        return { ...row, guia: match.guia, puntos: match.puntos }
      }
      return row
    })

    // Crea filas nuevas solo para indicadores que no existen en cada origen
    const newRows = []
    for (const tipo of OTROS_TIPOS) {
      for (const nacional of nacionales) {
        const yaExiste =
          updatedRows.some(r => r.tipocontacto === tipo && sameIndicador(r.indicador, nacional.indicador)) ||
          newRows.some(r => r.tipocontacto === tipo && sameIndicador(r.indicador, nacional.indicador))
        if (!yaExiste) {
          const id = newTempId()
          newRows.push({ idguia: id, tipocontacto: tipo, indicador: nacional.indicador, guia: nacional.guia, orden: 0, puntos: nacional.puntos })
          updatedIds.add(id)
        }
      }
    }

    setRows([...updatedRows, ...newRows])
    setDirty(prev => new Set([...prev, ...updatedIds]))
    toast(`${updatedIds.size} filas actualizadas/creadas — guarda cada origen`)
  }

  function addRow() {
    const id = newTempId()
    const opciones = configOptions[filterTipo] || []
    const defaultIndicador = opciones[0] || ''
    setRows(prev => [...prev, { idguia: id, tipocontacto: filterTipo || '', indicador: defaultIndicador, guia: '', orden: 0, puntos: 0 }])
    setDirty(prev => new Set([...prev, id]))
  }

  const TIPO_ORDER    = ['nacional', ...OTROS_TIPOS]
  const tiposContacto = TIPO_ORDER.filter(t => rows.some(r => r.tipocontacto === t))
  const sortedRows    = [...rows].sort((a, b) => a.idguia < 0 ? 1 : b.idguia < 0 ? -1 : a.idguia - b.idguia)
  const filtered      = filterTipo ? sortedRows.filter(r => r.tipocontacto === filterTipo) : sortedRows
  const dirtyCount    = rows.filter(r => dirty.has(r.idguia)).length

  return (
    <div className="app">

      {/* ── Toasts ── */}
      <div className="toast-container">
        {toasts.length > 1 && (
          <button className="toast-clear-all" onClick={clearToasts}>
            Cerrar todos ({toasts.length})
          </button>
        )}
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="toast-icon">{t.type === 'success' ? '✓' : '✕'}</span>
            <span className="toast-msg">{t.msg}</span>
            <button className="toast-close" onClick={() => closeToast(t.id)}>✕</button>
          </div>
        ))}
      </div>

      {/* ── Modal ── */}
      <Modal
        open={modal.open}
        title={modal.title}
        message={modal.message}
        variant={modal.variant}
        confirmLabel={modal.confirmLabel}
        onConfirm={modal.onConfirm}
        onCancel={closeModal}
      />

      {/* ── Main content ── */}
      <main className="content">

        {rows.length > 0 && !loading && (
          <div className="info-strip">
            <span className="info-title">Guias del cliente <strong>{cliente}</strong></span>
            <div className="info-right">
              {dirtyCount > 0 && (
                <span className="pending-badge">{dirtyCount} cambio{dirtyCount !== 1 ? 's' : ''} pendiente{dirtyCount !== 1 ? 's' : ''}</span>
              )}
              <span className="info-count">{filtered.length} registros</span>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-toolbar">
            <div className="toolbar-left">
              {tiposContacto.length > 0 && (
                <div className="filter-pills">
                  {tiposContacto.map(t => (
                    <button key={t} onClick={() => setFilterTipo(t)}
                      className={`pill ${filterTipo === t ? 'pill-active' : ''}`}
                      style={filterTipo === t ? { backgroundColor: TIPO_COLORS[t] || '#27ae60', borderColor: TIPO_COLORS[t] || '#27ae60' } : {}}>
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="toolbar-right">
              {/* Copiar nacional */}
              {filterTipo === 'nacional' && rows.some(r => r.tipocontacto === 'nacional') && (
                <button onClick={copyNacionalToOthers} className="btn-copy-pill">
                  ⬇ Copiar a otros orígenes
                </button>
              )}

              {/* Guardar todos */}
              {dirtyCount > 0 && (
                <button onClick={saveAll} className="btn-save-all-pill">
                  💾 Guardar todos ({dirtyCount})
                </button>
              )}

              {/* Eliminar todos del filtro */}
              {filtered.length > 0 && (
                <button onClick={deleteAllFiltered} className="btn-delete-all-pill">
                  🗑 Eliminar {filterTipo}
                </button>
              )}

              {/* Nueva guia */}
              <button onClick={addRow} disabled={!token || !cliente} className="btn-add-pill">
                + Nueva Guia
              </button>
            </div>
          </div>

          {filtered.length > 0 ? (
            <div className="table-wrap">
              <table className="guias-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Tipo Contacto</th>
                    <th>Indicador</th>
                    <th>Guia</th>
                    <th>Puntos</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(row => {
                    const isDirty  = dirty.has(row.idguia)
                    const isSaving = saving.has(row.idguia)
                    const isNew    = row.idguia < 0
                    const color    = TIPO_COLORS[row.tipocontacto] || '#27ae60'
                    return (
                      <tr key={row.idguia} className={isDirty ? 'tr-dirty' : ''}>
                        <td className="td-id">
                          {isNew
                            ? <span className="badge-new">nuevo</span>
                            : <span className="id-bubble" style={{ backgroundColor: color }}>{row.idguia}</span>
                          }
                        </td>
                        <td>
                          <span className="tipo-badge" style={{ backgroundColor: color }}>
                            {row.tipocontacto}
                          </span>
                        </td>
                        <td>
                          {(() => {
                            const opciones = configOptions[row.tipocontacto] || []
                            const todasOpciones = opciones.includes(row.indicador) || !row.indicador
                              ? opciones
                              : [...opciones, row.indicador]
                            return (
                              <select
                                className="field-select"
                                value={row.indicador}
                                onChange={e => updateRow(row.idguia, 'indicador', e.target.value)}
                                style={{ '--accent': color }}
                              >
                                {!row.indicador && <option value="">— seleccionar —</option>}
                                {todasOpciones.map(ind => (
                                  <option key={ind} value={ind}>{toDisplay(ind)}</option>
                                ))}
                              </select>
                            )
                          })()}
                        </td>
                        <td>
                          <input className="field-input field-num field-green" type="number" step="1"
                            value={row.guia ?? ''}
                            onChange={e => updateRow(row.idguia, 'guia', e.target.value === '' ? '' : parseInt(e.target.value))}
                            placeholder="0" />
                        </td>
                        <td>
                          <input className="field-input field-xs" type="number" step="1"
                            value={row.puntos}
                            onChange={e => updateRow(row.idguia, 'puntos', e.target.value)} />
                        </td>
                        <td className="td-actions">
                          <button onClick={() => saveRow(row)} disabled={isSaving || !isDirty}
                            className={`action-btn save-btn ${isDirty ? 'save-active' : ''}`}
                            title="Guardar">
                            {isSaving ? '…' : '✓'}
                          </button>
                          <button onClick={() => deleteRow(row)} disabled={isSaving}
                            className="action-btn delete-btn" title="Eliminar">
                            ✕
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : !loading && (
            <div className="empty-card">
              <p>No hay guias para <strong>{cliente} — {filterTipo}</strong>.</p>
              <p>Usa <strong>+ Nueva Guia</strong> para agregar.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

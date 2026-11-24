import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createMyAvailabilityBlock,
  deleteMyAvailabilityBlock,
  getMyAvailabilityBlocks,
  updateMyAvailabilityBlock,
} from '../api/self.api.js';
import { getSafeErrorMessage } from '../utils/apiMessages.js';
import { formatLocalDate, formatLocalTime, isDateTimeLocal } from '../utils/dateTime.js';

function sortBlocks(items) {
  return [...items].sort((a, b) => String(a.startAt).localeCompare(String(b.startAt)));
}

function normalizeDateTime(value) {
  const normalized = String(value ?? '').trim().slice(0, 16);
  return isDateTimeLocal(normalized) ? normalized : '';
}

function formatBlockDateTime(value) {
  return isDateTimeLocal(value)
    ? `${formatLocalDate(value)} ${formatLocalTime(value)}`
    : value ?? '';
}

export function ProfessionalBlocksPage() {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [editing, setEditing] = useState(null);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const startRef = useRef(null);
  const requestIdRef = useRef(0);

  const resetForm = useCallback(() => {
    setEditing(null);
    setStartAt('');
    setEndAt('');
    setReason('');
    setFormError('');
  }, []);

  const loadBlocks = useCallback(async ({ keepFeedback = false } = {}) => {
    const currentRequest = ++requestIdRef.current;
    setLoading(true);
    setLoadFailed(false);
    setError('');
    if (!keepFeedback) {
      setFeedback('');
    }

    try {
      const payload = await getMyAvailabilityBlocks();
      if (currentRequest !== requestIdRef.current) {
        return;
      }
      setBlocks(sortBlocks(payload?.blocks ?? []));
    } catch (err) {
      if (currentRequest !== requestIdRef.current) {
        return;
      }
      setLoadFailed(true);
      setError(getSafeErrorMessage(err, 'No se pudieron cargar tus bloqueos.'));
    } finally {
      if (currentRequest === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadBlocks();
  }, [loadBlocks]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) {
      return;
    }

    const start = normalizeDateTime(startAt);
    const end = normalizeDateTime(endAt);

    if (!start || !end) {
      setFormError('Debes indicar inicio y fin válidos.');
      startRef.current?.focus();
      return;
    }

    if (start >= end) {
      setFormError('El inicio debe ser anterior al fin.');
      startRef.current?.focus();
      return;
    }

    const trimmedReason = reason.trim();
    const payload = {
      startAt: start,
      endAt: end,
      reason: trimmedReason === '' ? null : trimmedReason,
    };

    setSaving(true);
    setFormError('');
    setError('');

    try {
      if (editing) {
        await updateMyAvailabilityBlock(editing.id, payload);
        setFeedback('Bloqueo actualizado correctamente.');
      } else {
        await createMyAvailabilityBlock(payload);
        setFeedback('Bloqueo creado correctamente.');
      }
      resetForm();
      await loadBlocks({ keepFeedback: true });
    } catch (err) {
      // 409 por solapamiento: se muestra el mensaje seguro sin sobrescribir nada.
      setFormError(getSafeErrorMessage(err, 'No se pudo guardar el bloqueo.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(block) {
    const confirmed = window.confirm('¿Deseas eliminar este bloqueo de disponibilidad?');
    if (!confirmed) {
      return;
    }

    setBusyId(block.id);
    setError('');

    try {
      await deleteMyAvailabilityBlock(block.id);
      if (editing?.id === block.id) {
        resetForm();
      }
      setFeedback('Bloqueo eliminado correctamente.');
      await loadBlocks({ keepFeedback: true });
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo eliminar el bloqueo.'));
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(block) {
    setEditing(block);
    setStartAt(normalizeDateTime(block.startAt));
    setEndAt(normalizeDateTime(block.endAt));
    setReason(block.reason ?? '');
    setFormError('');
    startRef.current?.focus();
  }

  return (
    <section className="staff-page professional-portal">
      <h1>Mis bloqueos</h1>
      <p className="staff-page__lead">
        Registra períodos excepcionales en los que no estarás disponible para nuevas citas.
      </p>

      <form className="pro-block-form" noValidate onSubmit={handleSubmit}>
        <h2>{editing ? 'Editar bloqueo' : 'Nuevo bloqueo'}</h2>
        <div className="pro-block-form__fields">
          <div className="form-field">
            <label htmlFor="pro-block-start">Inicio *</label>
            <input
              ref={startRef}
              id="pro-block-start"
              type="datetime-local"
              required
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="pro-block-end">Fin *</label>
            <input
              id="pro-block-end"
              type="datetime-local"
              required
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
            />
          </div>
          <div className="form-field pro-block-form__reason">
            <label htmlFor="pro-block-reason">Motivo (opcional)</label>
            <textarea
              id="pro-block-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <p className="panel-error" role="alert">
          {formError}
        </p>
        <div className="pro-block-form__actions">
          <button type="submit" className="button button--primary" disabled={saving}>
            {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear bloqueo'}
          </button>
          {editing && (
            <button
              type="button"
              className="button button--ghost"
              disabled={saving}
              onClick={resetForm}
            >
              Cancelar edición
            </button>
          )}
        </div>
      </form>

      <p className="panel-feedback" aria-live="polite">
        {feedback}
      </p>
      <p className="panel-error" role="alert">
        {error}
      </p>

      <div className="pro-blocks-results">
        {loading && <p className="panel-status">Cargando bloqueos...</p>}

        {!loading && loadFailed && (
          <button
            type="button"
            className="button button--primary"
            onClick={() => loadBlocks()}
          >
            Reintentar
          </button>
        )}

        {!loading && !loadFailed && blocks.length === 0 && (
          <p className="panel-status">
            No tienes bloqueos de disponibilidad registrados.
          </p>
        )}

        {!loading && !loadFailed && blocks.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Inicio</th>
                  <th scope="col">Fin</th>
                  <th scope="col">Motivo</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((block) => (
                  <tr key={block.id}>
                    <td>{formatBlockDateTime(block.startAt)}</td>
                    <td>{formatBlockDateTime(block.endAt)}</td>
                    <td>{block.reason ? block.reason : 'Sin motivo'}</td>
                    <td className="data-table__actions">
                      <button
                        type="button"
                        className="button button--small"
                        disabled={busyId === block.id || saving}
                        onClick={() => startEdit(block)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="button button--small button--danger"
                        disabled={busyId === block.id || saving}
                        onClick={() => handleDelete(block)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

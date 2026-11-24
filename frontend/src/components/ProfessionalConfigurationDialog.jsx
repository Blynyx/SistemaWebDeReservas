import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createAvailabilityBlock,
  deleteAvailabilityBlock,
  listAvailabilityBlocks,
  updateAvailabilityBlock,
} from '../api/availabilityBlocks.api.js';
import {
  assignProfessionalService,
  listProfessionalServices,
  unassignProfessionalService,
} from '../api/professionalServices.api.js';
import { listServices } from '../api/services.api.js';
import {
  createWeeklySchedule,
  deleteWeeklySchedule,
  listWeeklySchedules,
  updateWeeklySchedule,
} from '../api/weeklySchedules.api.js';
import { getSafeErrorMessage } from '../utils/apiMessages.js';
import { formatLocalDate, formatLocalTime, isDateTimeLocal } from '../utils/dateTime.js';

const DAY_LABELS = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d/;

function dayLabel(dayOfWeek) {
  return DAY_LABELS[dayOfWeek] ?? String(dayOfWeek);
}

function sortSchedules(items) {
  return [...items].sort((left, right) => {
    if (left.dayOfWeek !== right.dayOfWeek) {
      return left.dayOfWeek - right.dayOfWeek;
    }
    return String(left.startTime).localeCompare(String(right.startTime));
  });
}

function sortBlocks(items) {
  return [...items].sort((left, right) => String(left.startAt).localeCompare(String(right.startAt)));
}

function formatBlockDateTime(value) {
  if (!isDateTimeLocal(value)) {
    return value ?? '';
  }
  return `${formatLocalDate(value)} ${formatLocalTime(value)}`;
}

function displayReason(reason) {
  if (reason == null || String(reason).trim() === '') {
    return 'Sin motivo';
  }
  return reason;
}

function normalizeTime(value) {
  const match = TIME_PATTERN.exec(String(value).trim());
  return match ? match[0] : '';
}

function normalizeDateTime(value) {
  const normalized = String(value).trim().slice(0, 16);
  return isDateTimeLocal(normalized) ? normalized : '';
}

function configError(error, fallback, notFoundMessage) {
  return getSafeErrorMessage(error, fallback, { notFoundMessage });
}

export function ProfessionalConfigurationDialog({ professional, onClose }) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const assignSelectRef = useRef(null);
  const scheduleDayRef = useRef(null);
  const scheduleStartRef = useRef(null);
  const blockStartRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const [catalog, setCatalog] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [blocks, setBlocks] = useState([]);

  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [assignBusy, setAssignBusy] = useState(false);
  const [busyAssignedId, setBusyAssignedId] = useState(null);

  const [editingSchedule, setEditingSchedule] = useState(null);
  const [scheduleDay, setScheduleDay] = useState('1');
  const [scheduleStart, setScheduleStart] = useState('');
  const [scheduleEnd, setScheduleEnd] = useState('');
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [busyScheduleId, setBusyScheduleId] = useState(null);

  const [editingBlock, setEditingBlock] = useState(null);
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [blockError, setBlockError] = useState('');
  const [blockBusy, setBlockBusy] = useState(false);
  const [busyBlockId, setBusyBlockId] = useState(null);

  const loadIdRef = useRef(0);

  const resetScheduleForm = useCallback(() => {
    setEditingSchedule(null);
    setScheduleDay('1');
    setScheduleStart('');
    setScheduleEnd('');
    setScheduleError('');
  }, []);

  const resetBlockForm = useCallback(() => {
    setEditingBlock(null);
    setBlockStart('');
    setBlockEnd('');
    setBlockReason('');
    setBlockError('');
  }, []);

  const loadConfiguration = useCallback(
    async ({ keepFeedback = false } = {}) => {
      if (!professional) {
        return;
      }

      const current = ++loadIdRef.current;
      setLoading(true);
      setLoadFailed(false);
      setError('');
      if (!keepFeedback) {
        setFeedback('');
      }

      try {
        const [assignedResult, schedulesResult, blocksResult, servicesResult] = await Promise.all([
          listProfessionalServices(professional.id),
          listWeeklySchedules(professional.id),
          listAvailabilityBlocks(professional.id),
          listServices(),
        ]);

        if (current !== loadIdRef.current) {
          return;
        }

        setAssigned(assignedResult.services ?? []);
        setSchedules(sortSchedules(schedulesResult.schedules ?? []));
        setBlocks(sortBlocks(blocksResult.blocks ?? []));
        setCatalog(servicesResult.services ?? []);
        setSelectedServiceId('');
        resetScheduleForm();
        resetBlockForm();
      } catch (err) {
        if (current !== loadIdRef.current) {
          return;
        }
        setLoadFailed(true);
        setError(
          configError(
            err,
            'No se pudo cargar la configuración.',
            'El profesional ya no está disponible.'
          )
        );
      } finally {
        if (current === loadIdRef.current) {
          setLoading(false);
        }
      }
    },
    [professional, resetScheduleForm, resetBlockForm]
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (professional) {
      setFeedback('');
      setError('');
      if (!dialog.open) {
        dialog.showModal();
      }
      closeButtonRef.current?.focus();
      loadConfiguration();
    } else if (dialog.open) {
      loadIdRef.current += 1;
      dialog.close();
    }
  }, [professional, loadConfiguration]);

  const assignedIds = new Set(assigned.map((s) => s.id));
  const assignableServices = catalog.filter(
    (s) => (s.isActive === 1 || s.isActive === true) && !assignedIds.has(s.id)
  );

  async function handleAssignService(event) {
    event.preventDefault();
    if (!professional || assignBusy) {
      return;
    }

    if (!selectedServiceId) {
      setError('Debes seleccionar un servicio.');
      assignSelectRef.current?.focus();
      return;
    }

    setAssignBusy(true);
    setError('');

    try {
      await assignProfessionalService(professional.id, selectedServiceId);
      setFeedback('Servicio asignado correctamente.');
      await loadConfiguration({ keepFeedback: true });
    } catch (err) {
      setError(
        configError(err, 'No se pudo asignar el servicio.', 'El servicio ya no está disponible.')
      );
    } finally {
      setAssignBusy(false);
    }
  }

  async function handleUnassignService(service) {
    if (!professional) {
      return;
    }

    const confirmed = window.confirm('¿Deseas quitar este servicio del profesional?');
    if (!confirmed) {
      return;
    }

    setBusyAssignedId(service.id);
    setError('');

    try {
      await unassignProfessionalService(professional.id, service.id);
      setFeedback('Servicio desasignado correctamente.');
      await loadConfiguration({ keepFeedback: true });
    } catch (err) {
      setError(
        configError(
          err,
          'No se pudo desasignar el servicio.',
          'El servicio ya no está disponible.'
        )
      );
    } finally {
      setBusyAssignedId(null);
    }
  }

  async function handleScheduleSubmit(event) {
    event.preventDefault();
    if (!professional || scheduleBusy) {
      return;
    }

    const dayOfWeek = Number(scheduleDay);
    const startTime = normalizeTime(scheduleStart);
    const endTime = normalizeTime(scheduleEnd);

    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
      setScheduleError('El día de la semana no es válido.');
      scheduleDayRef.current?.focus();
      return;
    }

    if (!startTime || !endTime) {
      setScheduleError('Debes indicar hora de inicio y de fin.');
      scheduleStartRef.current?.focus();
      return;
    }

    if (startTime >= endTime) {
      setScheduleError('La hora de inicio debe ser anterior a la hora de fin.');
      scheduleStartRef.current?.focus();
      return;
    }

    setScheduleBusy(true);
    setScheduleError('');
    setError('');

    try {
      const payload = { dayOfWeek, startTime, endTime };
      if (editingSchedule) {
        await updateWeeklySchedule(professional.id, editingSchedule.id, payload);
        setFeedback('Horario actualizado correctamente.');
      } else {
        await createWeeklySchedule(professional.id, payload);
        setFeedback('Horario agregado correctamente.');
      }
      await loadConfiguration({ keepFeedback: true });
    } catch (err) {
      setScheduleError(
        configError(err, 'No se pudo guardar el horario.', 'El horario ya no está disponible.')
      );
    } finally {
      setScheduleBusy(false);
    }
  }

  async function handleDeleteSchedule(schedule) {
    if (!professional) {
      return;
    }

    const confirmed = window.confirm('¿Deseas eliminar este intervalo del horario?');
    if (!confirmed) {
      return;
    }

    setBusyScheduleId(schedule.id);
    setError('');

    try {
      await deleteWeeklySchedule(professional.id, schedule.id);
      setFeedback('Horario eliminado correctamente.');
      await loadConfiguration({ keepFeedback: true });
    } catch (err) {
      setError(
        configError(err, 'No se pudo eliminar el horario.', 'El horario ya no está disponible.')
      );
    } finally {
      setBusyScheduleId(null);
    }
  }

  async function handleBlockSubmit(event) {
    event.preventDefault();
    if (!professional || blockBusy) {
      return;
    }

    const startAt = normalizeDateTime(blockStart);
    const endAt = normalizeDateTime(blockEnd);
    const reason = blockReason.trim();

    if (!startAt || !endAt) {
      setBlockError('Debes indicar inicio y fin.');
      blockStartRef.current?.focus();
      return;
    }

    if (startAt >= endAt) {
      setBlockError('El inicio debe ser anterior al fin.');
      blockStartRef.current?.focus();
      return;
    }

    setBlockBusy(true);
    setBlockError('');
    setError('');

    try {
      const payload = {
        startAt,
        endAt,
        reason: reason === '' ? null : reason,
      };
      if (editingBlock) {
        await updateAvailabilityBlock(professional.id, editingBlock.id, payload);
        setFeedback('Bloqueo actualizado correctamente.');
      } else {
        await createAvailabilityBlock(professional.id, payload);
        setFeedback('Bloqueo agregado correctamente.');
      }
      await loadConfiguration({ keepFeedback: true });
    } catch (err) {
      setBlockError(
        configError(err, 'No se pudo guardar el bloqueo.', 'El bloqueo ya no está disponible.')
      );
    } finally {
      setBlockBusy(false);
    }
  }

  async function handleDeleteBlock(block) {
    if (!professional) {
      return;
    }

    const confirmed = window.confirm('¿Deseas eliminar este bloqueo?');
    if (!confirmed) {
      return;
    }

    setBusyBlockId(block.id);
    setError('');

    try {
      await deleteAvailabilityBlock(professional.id, block.id);
      setFeedback('Bloqueo eliminado correctamente.');
      await loadConfiguration({ keepFeedback: true });
    } catch (err) {
      setError(
        configError(err, 'No se pudo eliminar el bloqueo.', 'El bloqueo ya no está disponible.')
      );
    } finally {
      setBusyBlockId(null);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="config-dialog"
      aria-labelledby="professional-config-title"
      onClose={() => {
        if (professional) {
          onClose();
        }
      }}
    >
      <div className="config-dialog__header">
        <h2 id="professional-config-title">
          {professional ? `Configuración de ${professional.name}` : 'Configuración'}
        </h2>
        <button
          ref={closeButtonRef}
          type="button"
          className="button button--ghost"
          onClick={onClose}
        >
          Cerrar
        </button>
      </div>

      <p className="panel-feedback" aria-live="polite">
        {feedback}
      </p>
      <p className="panel-error" role="alert">
        {error}
      </p>

      <div className="config-dialog__content">
        {loading && <p className="panel-status">Cargando configuración...</p>}

        {!loading && loadFailed && (
          <div>
            <p className="panel-error" role="alert">
              No se pudo cargar la configuración.
            </p>
            <button
              type="button"
              className="button button--primary"
              onClick={() => loadConfiguration()}
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !loadFailed && professional && (
          <>
            <section className="config-section">
              <h3>Servicios habilitados</h3>
              <div className="table-wrap">
                {assigned.length === 0 ? (
                  <p className="panel-status">No hay servicios asignados.</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Servicio</th>
                        <th scope="col">Duración</th>
                        <th scope="col">Estado del servicio</th>
                        <th scope="col">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assigned.map((service) => {
                        const active = service.isActive === 1 || service.isActive === true;
                        const isBusy = busyAssignedId === service.id;
                        return (
                          <tr key={service.id}>
                            <td>{service.name}</td>
                            <td>{service.durationMinutes} min</td>
                            <td>
                              <span
                                className={
                                  active
                                    ? 'status-badge service-status-badge service-status-badge--active'
                                    : 'status-badge service-status-badge service-status-badge--inactive'
                                }
                              >
                                {active ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                            <td className="data-table__actions">
                              <button
                                type="button"
                                className="button button--small button--danger"
                                disabled={isBusy}
                                onClick={() => handleUnassignService(service)}
                              >
                                Quitar asignación
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <form className="config-section__form" noValidate onSubmit={handleAssignService}>
                <div className="form-field">
                  <label htmlFor="config-assign-service">Servicio</label>
                  <select
                    ref={assignSelectRef}
                    id="config-assign-service"
                    name="config-assign-service"
                    value={selectedServiceId}
                    onChange={(e) => setSelectedServiceId(e.target.value)}
                  >
                    {assignableServices.length === 0 ? (
                      <option value="">No hay servicios activos disponibles</option>
                    ) : (
                      <>
                        <option value="">Selecciona un servicio</option>
                        {assignableServices.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.name}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
                <button
                  type="submit"
                  className="button button--primary"
                  disabled={assignBusy || assignableServices.length === 0}
                >
                  Asignar servicio
                </button>
              </form>
            </section>

            <section className="config-section">
              <h3>Horario semanal</h3>
              <div className="table-wrap">
                {schedules.length === 0 ? (
                  <p className="panel-status">No hay intervalos de horario.</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Día</th>
                        <th scope="col">Inicio</th>
                        <th scope="col">Fin</th>
                        <th scope="col">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedules.map((schedule) => {
                        const isBusy = busyScheduleId === schedule.id;
                        return (
                          <tr key={schedule.id}>
                            <td>{dayLabel(schedule.dayOfWeek)}</td>
                            <td>{schedule.startTime}</td>
                            <td>{schedule.endTime}</td>
                            <td className="data-table__actions">
                              <button
                                type="button"
                                className="button button--small"
                                disabled={isBusy}
                                onClick={() => {
                                  setEditingSchedule(schedule);
                                  setScheduleDay(String(schedule.dayOfWeek));
                                  setScheduleStart(schedule.startTime);
                                  setScheduleEnd(schedule.endTime);
                                  setScheduleError('');
                                  scheduleDayRef.current?.focus();
                                }}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="button button--small button--danger"
                                disabled={isBusy}
                                onClick={() => handleDeleteSchedule(schedule)}
                              >
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <div>
                <form
                  className="config-section__form config-section__form--schedule"
                  noValidate
                  onSubmit={handleScheduleSubmit}
                >
                  <div className="form-field">
                    <label htmlFor="config-schedule-day">Día</label>
                    <select
                      ref={scheduleDayRef}
                      id="config-schedule-day"
                      name="config-schedule-day"
                      value={scheduleDay}
                      onChange={(e) => setScheduleDay(e.target.value)}
                    >
                      {Object.entries(DAY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="config-schedule-start">Hora inicio</label>
                    <input
                      ref={scheduleStartRef}
                      id="config-schedule-start"
                      name="config-schedule-start"
                      type="time"
                      required
                      value={scheduleStart}
                      onChange={(e) => setScheduleStart(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="config-schedule-end">Hora fin</label>
                    <input
                      id="config-schedule-end"
                      name="config-schedule-end"
                      type="time"
                      required
                      value={scheduleEnd}
                      onChange={(e) => setScheduleEnd(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="button button--primary" disabled={scheduleBusy}>
                    {editingSchedule ? 'Guardar horario' : 'Agregar horario'}
                  </button>
                </form>
                <p className="panel-error" role="alert">
                  {scheduleError}
                </p>
                {editingSchedule && (
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => {
                      resetScheduleForm();
                      scheduleDayRef.current?.focus();
                    }}
                  >
                    Cancelar edición
                  </button>
                )}
              </div>
            </section>

            <section className="config-section">
              <h3>Bloqueos de disponibilidad</h3>
              <p className="config-section__lead">
                Los bloqueos representan períodos excepcionales en los que el profesional no estará
                disponible.
              </p>
              <div className="table-wrap">
                {blocks.length === 0 ? (
                  <p className="panel-status">No hay bloqueos registrados.</p>
                ) : (
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
                      {blocks.map((block) => {
                        const isBusy = busyBlockId === block.id;
                        return (
                          <tr key={block.id}>
                            <td>{formatBlockDateTime(block.startAt)}</td>
                            <td>{formatBlockDateTime(block.endAt)}</td>
                            <td>{displayReason(block.reason)}</td>
                            <td className="data-table__actions">
                              <button
                                type="button"
                                className="button button--small"
                                disabled={isBusy}
                                onClick={() => {
                                  setEditingBlock(block);
                                  setBlockStart(normalizeDateTime(block.startAt));
                                  setBlockEnd(normalizeDateTime(block.endAt));
                                  setBlockReason(block.reason ?? '');
                                  setBlockError('');
                                  blockStartRef.current?.focus();
                                }}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="button button--small button--danger"
                                disabled={isBusy}
                                onClick={() => handleDeleteBlock(block)}
                              >
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <div>
                <form
                  className="config-section__form config-section__form--block"
                  noValidate
                  onSubmit={handleBlockSubmit}
                >
                  <div className="form-field">
                    <label htmlFor="config-block-start">Inicio</label>
                    <input
                      ref={blockStartRef}
                      id="config-block-start"
                      name="config-block-start"
                      type="datetime-local"
                      required
                      value={blockStart}
                      onChange={(e) => setBlockStart(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="config-block-end">Fin</label>
                    <input
                      id="config-block-end"
                      name="config-block-end"
                      type="datetime-local"
                      required
                      value={blockEnd}
                      onChange={(e) => setBlockEnd(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="config-block-reason">Motivo</label>
                    <textarea
                      id="config-block-reason"
                      name="config-block-reason"
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="button button--primary" disabled={blockBusy}>
                    {editingBlock ? 'Guardar bloqueo' : 'Agregar bloqueo'}
                  </button>
                </form>
                <p className="panel-error" role="alert">
                  {blockError}
                </p>
                {editingBlock && (
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => {
                      resetBlockForm();
                      blockStartRef.current?.focus();
                    }}
                  >
                    Cancelar edición
                  </button>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </dialog>
  );
}

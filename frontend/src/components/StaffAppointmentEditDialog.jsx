import { useEffect, useMemo, useRef, useState } from 'react';
import { updateAppointment } from '../api/appointments.api.js';
import { listProfessionalServices } from '../api/professionalServices.api.js';
import { getSafeErrorMessage } from '../utils/apiMessages.js';
import { formatLocalDate, formatLocalTime } from '../utils/dateTime.js';
import { sortByName } from '../utils/references.js';

function isActiveRecord(item) {
  return item?.isActive === true || item?.isActive === 1;
}

export function StaffAppointmentEditDialog({
  appointment,
  clients = [],
  professionals = [],
  services = [],
  onClose,
  onUpdated,
}) {
  const dialogRef = useRef(null);
  const clientSelectRef = useRef(null);
  const serviceRequestIdRef = useRef(0);

  const [clientId, setClientId] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [assignedServices, setAssignedServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [servicesError, setServicesError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [busy, setBusy] = useState(false);

  const activeClients = useMemo(() => sortByName(clients.filter(isActiveRecord)), [clients]);
  const activeProfessionals = useMemo(
    () => sortByName(professionals.filter(isActiveRecord)),
    [professionals]
  );

  const inactiveCurrentClient = useMemo(() => {
    if (!appointment) return null;
    const found = clients.find((c) => c.id === appointment.clientId);
    return found && !isActiveRecord(found) ? found : null;
  }, [appointment, clients]);

  const inactiveCurrentProfessional = useMemo(() => {
    if (!appointment) return null;
    const found = professionals.find((p) => p.id === appointment.professionalId);
    return found && !isActiveRecord(found) ? found : null;
  }, [appointment, professionals]);

  const currentServiceRecord = useMemo(() => {
    if (!appointment) return null;
    return services.find((s) => s.id === appointment.serviceId) ?? null;
  }, [appointment, services]);

  async function loadServicesForProfessional(targetProfessionalId, preferredServiceId) {
    const reqId = ++serviceRequestIdRef.current;
    if (!targetProfessionalId) {
      setAssignedServices([]);
      setServiceId('');
      setLoadingServices(false);
      setServicesError('');
      return;
    }

    setLoadingServices(true);
    setServicesError('');

    try {
      const payload = await listProfessionalServices(targetProfessionalId);
      if (reqId !== serviceRequestIdRef.current) {
        return;
      }

      const activeAssigned = sortByName((payload?.services ?? []).filter(isActiveRecord));
      setAssignedServices(activeAssigned);

      if (preferredServiceId && activeAssigned.some((s) => s.id === preferredServiceId)) {
        setServiceId(preferredServiceId);
      } else {
        setServiceId('');
      }
    } catch (err) {
      if (reqId !== serviceRequestIdRef.current) {
        return;
      }
      setAssignedServices([]);
      setServiceId('');
      setServicesError(
        getSafeErrorMessage(err, 'No se pudieron cargar los servicios del profesional.')
      );
    } finally {
      if (reqId === serviceRequestIdRef.current) {
        setLoadingServices(false);
      }
    }
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (appointment) {
      setClientId(appointment.clientId);
      setProfessionalId(appointment.professionalId);
      setServiceId(appointment.serviceId);
      setSubmitError('');
      setServicesError('');
      setBusy(false);

      if (!dialog.open) {
        dialog.showModal();
      }
      clientSelectRef.current?.focus();
      loadServicesForProfessional(appointment.professionalId, appointment.serviceId);
    } else if (dialog.open) {
      serviceRequestIdRef.current += 1;
      dialog.close();
    }
  }, [appointment]);

  function handleProfessionalChange(nextProId) {
    setProfessionalId(nextProId);
    setSubmitError('');
    loadServicesForProfessional(nextProId, serviceId);
  }

  const hasChanges = Boolean(
    appointment &&
      (clientId !== appointment.clientId ||
        professionalId !== appointment.professionalId ||
        serviceId !== appointment.serviceId)
  );

  const canSave = Boolean(
    appointment &&
      !busy &&
      !loadingServices &&
      clientId &&
      professionalId &&
      serviceId &&
      hasChanges
  );

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSave) {
      return;
    }

    setBusy(true);
    setSubmitError('');

    try {
      const updated = await updateAppointment(appointment.id, {
        clientId,
        professionalId,
        serviceId,
      });
      await onUpdated?.(updated);
    } catch (err) {
      setSubmitError(getSafeErrorMessage(err, 'No se pudo actualizar la cita.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="booking-dialog"
      aria-labelledby="staff-edit-appointment-title"
      onCancel={(e) => {
        if (busy) {
          e.preventDefault();
        } else {
          onClose();
        }
      }}
      onClose={() => {
        if (appointment) {
          onClose();
        }
      }}
    >
      <h2 id="staff-edit-appointment-title">Editar cita</h2>
      <form className="booking-dialog__form" noValidate onSubmit={handleSubmit}>
        {appointment && (
          <section className="client-profile-summary" aria-label="Horario actual de la cita">
            <dl className="client-appointment-card__details">
              <div>
                <dt>Fecha</dt>
                <dd>{formatLocalDate(appointment.startAt)}</dd>
              </div>
              <div>
                <dt>Hora inicio</dt>
                <dd>{formatLocalTime(appointment.startAt)}</dd>
              </div>
            </dl>
            <p className="panel-status">
              Para cambiar la fecha u hora utiliza Reprogramar.
            </p>
          </section>
        )}

        <div className="form-field">
          <label htmlFor="edit-appointment-client">Cliente *</label>
          <select
            ref={clientSelectRef}
            id="edit-appointment-client"
            required
            disabled={busy}
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setSubmitError('');
            }}
          >
            <option value="">Selecciona un cliente</option>
            {inactiveCurrentClient && (
              <option value={inactiveCurrentClient.id} disabled>
                {inactiveCurrentClient.name} (Inactivo - actual)
              </option>
            )}
            {activeClients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="edit-appointment-professional">Profesional *</label>
          <select
            id="edit-appointment-professional"
            required
            disabled={busy}
            value={professionalId}
            onChange={(e) => handleProfessionalChange(e.target.value)}
          >
            <option value="">Selecciona un profesional</option>
            {inactiveCurrentProfessional && (
              <option value={inactiveCurrentProfessional.id} disabled>
                {inactiveCurrentProfessional.name} (Inactivo - actual)
              </option>
            )}
            {activeProfessionals.map((pro) => (
              <option key={pro.id} value={pro.id}>
                {pro.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="edit-appointment-service">Servicio *</label>
          <select
            id="edit-appointment-service"
            required
            disabled={busy || loadingServices || !professionalId}
            value={serviceId}
            onChange={(e) => {
              setServiceId(e.target.value);
              setSubmitError('');
            }}
          >
            <option value="">
              {loadingServices
                ? 'Cargando servicios...'
                : assignedServices.length === 0
                  ? 'Sin servicios activos asignados'
                  : 'Selecciona un servicio'}
            </option>
            {appointment &&
              serviceId === appointment.serviceId &&
              currentServiceRecord &&
              !assignedServices.some((s) => s.id === currentServiceRecord.id) && (
                <option value={currentServiceRecord.id} disabled>
                  {currentServiceRecord.name} (No disponible - actual)
                </option>
              )}
            {assignedServices.map((svc) => (
              <option key={svc.id} value={svc.id}>
                {svc.name} ({svc.durationMinutes} min)
              </option>
            ))}
          </select>
        </div>

        {servicesError && (
          <p className="panel-error" role="alert">
            {servicesError}
          </p>
        )}

        <p className="panel-error" role="alert" aria-live="polite">
          {submitError}
        </p>

        <div className="booking-dialog__actions">
          <button type="submit" className="button button--primary" disabled={!canSave}>
            {busy ? 'Guardando...' : 'Guardar cambios'}
          </button>
          <button
            type="button"
            className="button button--ghost"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
        </div>
      </form>
    </dialog>
  );
}

import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import themePlugin from '@fullcalendar/react/themes/classic';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import interactionPlugin from '@fullcalendar/react/interaction';
import esLocale from '@fullcalendar/react/locales/es';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import '@fullcalendar/react/themes/classic/palette.css';
import {
  getMyAvailabilityBlocks,
  getMyProfessional,
  getMyProfessionalAppointments,
} from '../api/self.api.js';
import { listServices } from '../api/services.api.js';
import { ProfessionalAppointmentDialog } from '../components/ProfessionalAppointmentDialog.jsx';
import { getSafeErrorMessage } from '../utils/apiMessages.js';
import { getStatusLabel, STATUS_LABELS } from '../utils/appointmentStatus.js';
import { createNameLookup } from '../utils/references.js';

const CALENDAR_PLUGINS = [themePlugin, dayGridPlugin, timeGridPlugin, interactionPlugin];

const HEADER_TOOLBAR = {
  left: 'prev,next today',
  center: 'title',
  right: 'dayGridMonth,timeGridWeek,timeGridDay',
};

const BUTTONS = {
  prev: { text: 'Anterior' },
  next: { text: 'Siguiente' },
  today: { text: 'Hoy' },
};

const VIEWS = {
  dayGridMonth: { buttonText: 'Mes' },
  timeGridWeek: { buttonText: 'Semana' },
  timeGridDay: { buttonText: 'Día' },
};

export function toRangeFromDatesSet(info) {
  // FullCalendar entrega un end exclusivo; el backend espera "to" inclusivo.
  const from = info.startStr.slice(0, 10);
  const endExclusive = info.endStr.slice(0, 10);
  const to = dayjs(endExclusive).subtract(1, 'day').format('YYYY-MM-DD');
  return { from, to };
}

export function ProfessionalAgendaPage() {
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [serviceLookup, setServiceLookup] = useState(() => () => 'Servicio');
  const [blocks, setBlocks] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [range, setRange] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const requestIdRef = useRef(0);
  const rangeRef = useRef(null);

  useEffect(() => {
    let active = true;

    (async () => {
      const [profileResult, servicesResult, blocksResult] = await Promise.allSettled([
        getMyProfessional(),
        listServices(),
        getMyAvailabilityBlocks(),
      ]);

      if (!active) {
        return;
      }

      if (profileResult.status === 'fulfilled') {
        setProfile(profileResult.value?.professional ?? null);
      } else {
        setProfileError(
          getSafeErrorMessage(profileResult.reason, 'No se pudo cargar tu perfil.')
        );
      }

      if (servicesResult.status === 'fulfilled') {
        const lookup = createNameLookup(servicesResult.value?.services ?? [], '');
        setServiceLookup(() => (id) => lookup(id) || 'Servicio');
      }

      if (blocksResult.status === 'fulfilled') {
        setBlocks(blocksResult.value?.blocks ?? []);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const loadAppointments = useCallback(async (targetRange) => {
    if (!targetRange) {
      return;
    }

    const currentRequest = ++requestIdRef.current;
    setLoading(true);
    setError('');

    try {
      const payload = await getMyProfessionalAppointments(targetRange);
      if (currentRequest !== requestIdRef.current) {
        return;
      }
      setAppointments(payload?.appointments ?? []);
    } catch (err) {
      if (currentRequest !== requestIdRef.current) {
        return;
      }
      setError(getSafeErrorMessage(err, 'No se pudo cargar tu agenda.'));
    } finally {
      if (currentRequest === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const handleDatesSet = useCallback(
    (info) => {
      const next = toRangeFromDatesSet(info);
      const prev = rangeRef.current;

      if (prev && prev.from === next.from && prev.to === next.to) {
        return;
      }

      rangeRef.current = next;
      setRange(next);
      loadAppointments(next);
    },
    [loadAppointments]
  );

  const visibleAppointments = useMemo(
    () => appointments.filter((item) => !statusFilter || item.status === statusFilter),
    [appointments, statusFilter]
  );

  const events = useMemo(() => {
    const appointmentEvents = visibleAppointments.map((appointment) => ({
      id: `apt-${appointment.id}`,
      title: `${serviceLookup(appointment.serviceId)} · ${appointment.clientName || 'Cliente no disponible'} · ${getStatusLabel(appointment.status)}`,
      start: appointment.startAt,
      end: appointment.endAt,
      className: `pro-event pro-event--${appointment.status}`,
      extendedProps: { kind: 'appointment', appointmentId: appointment.id },
    }));

    const blockEvents = blocks.map((block) => ({
      id: `blk-${block.id}`,
      title: 'Bloqueo / No disponible',
      start: block.startAt,
      end: block.endAt,
      display: 'background',
      className: 'pro-event pro-event--block',
      extendedProps: { kind: 'block' },
    }));

    return [...appointmentEvents, ...blockEvents];
  }, [visibleAppointments, blocks, serviceLookup]);

  function handleEventClick(info) {
    const props = info.event.extendedProps ?? {};
    if (props.kind !== 'appointment') {
      return;
    }

    const found = appointments.find((item) => item.id === props.appointmentId);
    if (found) {
      setSelected(found);
    }
  }

  const profileMeta = profile
    ? [profile.email, profile.phone].filter(Boolean).join(' · ')
    : '';

  return (
    <section className="staff-page professional-portal">
      <h1>Mi agenda</h1>
      <p className="staff-page__lead">
        Consulta tus citas por día, semana o mes y registra su resultado al finalizar.
      </p>

      {profile && (
        <section className="client-profile-summary" aria-label="Datos del profesional">
          <strong>{profile.name}</strong>
          {profileMeta ? <span> · {profileMeta}</span> : null}
        </section>
      )}
      {profileError && (
        <p className="panel-error" role="alert">
          {profileError}
        </p>
      )}

      <div className="pro-agenda-toolbar">
        <div className="form-field">
          <label htmlFor="pro-agenda-status">Estado</label>
          <select
            id="pro-agenda-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <ul className="pro-agenda-legend" aria-label="Leyenda de la agenda">
          <li>
            <span className="pro-legend-swatch pro-event--block" aria-hidden="true" />
            Bloqueo / No disponible
          </li>
        </ul>
      </div>

      <p className="panel-status" aria-live="polite">
        {loading ? 'Cargando agenda...' : ''}
      </p>
      {error && (
        <div>
          <p className="panel-error" role="alert">
            {error}
          </p>
          <button
            type="button"
            className="button button--primary"
            onClick={() => loadAppointments(range)}
          >
            Reintentar
          </button>
        </div>
      )}
      {!loading && !error && range && visibleAppointments.length === 0 && (
        <p className="panel-status">No hay citas para el rango y filtro seleccionados.</p>
      )}

      <div className="pro-calendar-wrap">
        <FullCalendar
          plugins={CALENDAR_PLUGINS}
          locale={esLocale}
          initialView="timeGridWeek"
          headerToolbar={HEADER_TOOLBAR}
          buttons={BUTTONS}
          views={VIEWS}
          events={events}
          datesSet={handleDatesSet}
          eventClick={handleEventClick}
          allDaySlot={false}
          nowIndicator
          height="auto"
          dayMaxEvents
        />
      </div>

      <ProfessionalAppointmentDialog
        appointment={selected}
        serviceName={selected ? serviceLookup(selected.serviceId) : ''}
        onClose={() => setSelected(null)}
        onChanged={async () => {
          await loadAppointments(rangeRef.current);
        }}
      />
    </section>
  );
}

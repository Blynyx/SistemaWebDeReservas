import { useCallback, useEffect, useRef, useState } from 'react';
import { listClients } from '../api/clients.api.js';
import { getDashboard } from '../api/dashboard.api.js';
import { listProfessionals } from '../api/professionals.api.js';
import { listServices } from '../api/services.api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { getSafeErrorMessage } from '../utils/apiMessages.js';
import { formatLocalTime } from '../utils/dateTime.js';
import { createNameLookup } from '../utils/references.js';

const COPY = {
  ADMIN: {
    title: 'Panel administrativo',
    description: 'Resumen operativo de la organización.',
  },
  RECEPTIONIST: {
    title: 'Panel de recepción',
    description: 'Consulta el estado operativo de las citas y clientes.',
  },
};

export function DashboardPage() {
  const { session } = useAuth();
  const copy = COPY[session?.user?.role] ?? COPY.ADMIN;

  const [date, setDate] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [names, setNames] = useState({
    clientName: () => 'Cliente no disponible',
    professionalName: () => 'Profesional no disponible',
    serviceName: () => 'Servicio no disponible',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestIdRef = useRef(0);

  const load = useCallback(async (targetDate) => {
    const currentRequest = ++requestIdRef.current;
    setLoading(true);
    setError('');

    try {
      const [dashboardResult, clientsResult, professionalsResult, servicesResult] =
        await Promise.all([
          getDashboard(targetDate),
          listClients(),
          listProfessionals(),
          listServices(),
        ]);

      if (currentRequest !== requestIdRef.current) {
        return;
      }

      setDate(dashboardResult.date || '');
      setDashboard(dashboardResult);
      setNames({
        clientName: createNameLookup(clientsResult.clients, 'Cliente no disponible'),
        professionalName: createNameLookup(
          professionalsResult.professionals,
          'Profesional no disponible'
        ),
        serviceName: createNameLookup(servicesResult.services, 'Servicio no disponible'),
      });
    } catch (err) {
      if (currentRequest !== requestIdRef.current) {
        return;
      }
      setError(getSafeErrorMessage(err, 'No se pudo cargar el dashboard.'));
    } finally {
      if (currentRequest === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleSubmit(event) {
    event.preventDefault();
    load(date || undefined);
  }

  return (
    <section className="staff-page">
      <h1>{copy.title}</h1>
      <p className="staff-page__lead">{copy.description}</p>

      <form className="dashboard-date-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="dashboard-date">Fecha</label>
          <input
            id="dashboard-date"
            name="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <button type="submit" className="button button--primary" disabled={loading}>
          Consultar
        </button>
      </form>

      <div className="dashboard-content">
        {loading && <p className="panel-status">Cargando dashboard...</p>}

        {!loading && error && (
          <div>
            <p className="panel-error" role="alert">
              {error}
            </p>
            <button
              type="button"
              className="button button--primary"
              onClick={() => load(date || undefined)}
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && dashboard && (
          <>
            <section className="metric-grid" aria-label="Métricas de citas">
              <MetricCard label="Citas totales" value={dashboard.appointments.total} />
              <MetricCard label="Programadas" value={dashboard.appointments.programada} />
              <MetricCard label="Confirmadas" value={dashboard.appointments.confirmada} />
              <MetricCard label="Completadas" value={dashboard.appointments.completada} />
              <MetricCard label="Canceladas" value={dashboard.appointments.cancelada} />
              <MetricCard label="No asistió" value={dashboard.appointments.noAsistio} />
            </section>

            <section
              className="metric-grid metric-grid--resources"
              aria-label="Recursos activos"
            >
              <MetricCard label="Clientes activos" value={dashboard.activeResources.clients} />
              <MetricCard
                label="Profesionales activos"
                value={dashboard.activeResources.professionals}
              />
              <MetricCard
                label="Servicios activos"
                value={dashboard.activeResources.services}
              />
            </section>

            <section className="today-section">
              <h2>Citas de la fecha</h2>
              {dashboard.today.length === 0 ? (
                <p className="panel-status">No hay citas para esta fecha.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Hora</th>
                        <th scope="col">Cliente</th>
                        <th scope="col">Profesional</th>
                        <th scope="col">Servicio</th>
                        <th scope="col">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.today.map((appointment) => (
                        <tr key={appointment.id}>
                          <td>{formatLocalTime(appointment.startAt)}</td>
                          <td>{names.clientName(appointment.clientId)}</td>
                          <td>{names.professionalName(appointment.professionalId)}</td>
                          <td>{names.serviceName(appointment.serviceId)}</td>
                          <td>
                            <StatusBadge status={appointment.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </section>
  );
}

function MetricCard({ label, value }) {
  return (
    <article className="metric-card">
      <p className="metric-card__label">{label}</p>
      <p className="metric-card__value">{String(value)}</p>
    </article>
  );
}

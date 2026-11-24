import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const STATUS_CHART_COLORS = [
  '#2563eb', // PROGRAMADA
  '#0f766e', // CONFIRMADA
  '#15803d', // COMPLETADA
  '#64748b', // CANCELADA
  '#b45309', // NO_ASISTIO
];

export function DashboardCharts({ appointments, topServices, frequentClients, names }) {
  const statusValues = [
    appointments.programada ?? 0,
    appointments.confirmada ?? 0,
    appointments.completada ?? 0,
    appointments.cancelada ?? 0,
    appointments.noAsistio ?? 0,
  ];
  const hasAppointments = statusValues.some((value) => value > 0);

  const statusData = {
    labels: ['Programada', 'Confirmada', 'Completada', 'Cancelada', 'No asistió'],
    datasets: [
      {
        label: 'Citas',
        data: statusValues,
        backgroundColor: STATUS_CHART_COLORS,
        borderColor: '#fffdf8',
        borderWidth: 2,
      },
    ],
  };

  const statusOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
    },
  };

  const servicesList = Array.isArray(topServices) ? topServices : [];
  const servicesData = {
    labels: servicesList.map((item) => names.serviceName(item.serviceId)),
    datasets: [
      {
        label: 'Solicitudes',
        data: servicesList.map((item) => item.total),
        backgroundColor: '#1f5f63',
        borderRadius: 6,
      },
    ],
  };

  const clientsList = Array.isArray(frequentClients) ? frequentClients : [];
  const clientsData = {
    labels: clientsList.map((item) => names.clientName(item.clientId)),
    datasets: [
      {
        label: 'Citas',
        data: clientsList.map((item) => item.total),
        backgroundColor: '#2c7a7b',
        borderRadius: 6,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          precision: 0,
          stepSize: 1,
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
    },
  };

  return (
    <section className="dashboard-charts" aria-label="Visualizaciones KPI">
      <article className="chart-card">
        <h2>Citas por estado</h2>
        {hasAppointments ? (
          <div className="chart-card__canvas">
            <Doughnut data={statusData} options={statusOptions} />
          </div>
        ) : (
          <p className="panel-status">No hay citas registradas para esta fecha.</p>
        )}
      </article>

      <article className="chart-card">
        <h2>Servicios más solicitados</h2>
        {servicesList.length > 0 ? (
          <>
            <div className="chart-card__canvas">
              <Bar data={servicesData} options={barOptions} />
            </div>
            <ol className="kpi-ranking">
              {servicesList.map((item) => (
                <li key={item.serviceId}>
                  <span>{names.serviceName(item.serviceId)}</span>
                  <strong>{item.total}</strong>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="panel-status">No hay servicios solicitados en esta fecha.</p>
        )}
      </article>

      <article className="chart-card">
        <h2>Clientes frecuentes</h2>
        {clientsList.length > 0 ? (
          <>
            <div className="chart-card__canvas">
              <Bar data={clientsData} options={barOptions} />
            </div>
            <ol className="kpi-ranking">
              {clientsList.map((item) => (
                <li key={item.clientId}>
                  <span>{names.clientName(item.clientId)}</span>
                  <strong>{item.total}</strong>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="panel-status">No hay clientes frecuentes registrados en esta fecha.</p>
        )}
      </article>
    </section>
  );
}

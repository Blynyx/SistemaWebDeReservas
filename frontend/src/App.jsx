import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext.jsx';
import { AppShell } from './layouts/AppShell.jsx';
import { AppointmentsPage } from './pages/AppointmentsPage.jsx';
import { ClientAppointmentsPage } from './pages/ClientAppointmentsPage.jsx';
import { ClientBookingPage } from './pages/ClientBookingPage.jsx';
import { ClientsPage } from './pages/ClientsPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';
import { NotificationsPage } from './pages/NotificationsPage.jsx';
import { ProfessionalAgendaPage } from './pages/ProfessionalAgendaPage.jsx';
import { ProfessionalBlocksPage } from './pages/ProfessionalBlocksPage.jsx';
import { ProfessionalsPage } from './pages/ProfessionalsPage.jsx';
import { ReceptionistsPage } from './pages/ReceptionistsPage.jsx';
import { ServicesPage } from './pages/ServicesPage.jsx';
import { ProtectedRoute } from './router/ProtectedRoute.jsx';
import { getRoleHomePath, PROTECTED_ROUTES } from './router/routes.js';

function AppRoutes() {
  const { session, booting } = useAuth();

  if (booting) {
    return <p className="boot-status">Restaurando sesión...</p>;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          session ? (
            <Navigate to={getRoleHomePath(session.user.role)} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={PROTECTED_ROUTES['/dashboard']}>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/citas"
        element={
          <ProtectedRoute allowedRoles={PROTECTED_ROUTES['/citas']}>
            <AppointmentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clientes"
        element={
          <ProtectedRoute allowedRoles={PROTECTED_ROUTES['/clientes']}>
            <ClientsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/servicios"
        element={
          <ProtectedRoute allowedRoles={PROTECTED_ROUTES['/servicios']}>
            <ServicesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profesionales"
        element={
          <ProtectedRoute allowedRoles={PROTECTED_ROUTES['/profesionales']}>
            <ProfessionalsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/recepcionistas"
        element={
          <ProtectedRoute allowedRoles={PROTECTED_ROUTES['/recepcionistas']}>
            <ReceptionistsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/agenda"
        element={
          <ProtectedRoute allowedRoles={PROTECTED_ROUTES['/agenda']}>
            <ProfessionalAgendaPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mis-bloqueos"
        element={
          <ProtectedRoute allowedRoles={PROTECTED_ROUTES['/mis-bloqueos']}>
            <ProfessionalBlocksPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mis-citas"
        element={
          <ProtectedRoute allowedRoles={PROTECTED_ROUTES['/mis-citas']}>
            <ClientAppointmentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reservar"
        element={
          <ProtectedRoute allowedRoles={PROTECTED_ROUTES['/reservar']}>
            <ClientBookingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notificaciones"
        element={
          <ProtectedRoute allowedRoles={PROTECTED_ROUTES['/notificaciones']}>
            <NotificationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="*"
        element={
          session ? (
            <AppShell>
              <NotFoundPage />
            </AppShell>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  );
}

import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { Header } from '../components/Header.jsx';
import { Sidebar } from '../components/Sidebar.jsx';

export function AppShell({ children }) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  if (!session) {
    return null;
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <Header
        organization={session.organization}
        user={session.user}
        onLogout={handleLogout}
      />
      <div className="app-shell__body">
        <Sidebar role={session.user.role} />
        <main className="app-main" id="app-main">
          {children}
        </main>
      </div>
    </div>
  );
}

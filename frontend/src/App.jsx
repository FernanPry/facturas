import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Profile from './components/Profile';
import LandingPage from './pages/LandingPage';
import Auth from './pages/Auth';
import ProtectedRoute from './components/ProtectedRoute';
import Settings from './components/Settings';
import { API_BASE } from './config';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (token) {
      if (savedUser) {
        setUser(JSON.parse(savedUser));
        setIsAuthenticated(true);
      }

      // Refrescar datos del perfil completos desde el servidor
      fetch(`${API_BASE}/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('No autorizado');
        })
        .then(fullUser => {
          setUser(fullUser);
          localStorage.setItem('user', JSON.stringify(fullUser));
          setIsAuthenticated(true);
        })
        .catch(err => {
          console.error("Error fetching profile:", err);
          if (err.message === 'No autorizado') {
            handleLogout();
          }
        });
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<Auth onLogin={handleLogin} />} />

        <Route
          path="/dashboard/*"
          element={
            <ProtectedRoute>
              <div className="app-container">
                <Sidebar
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  onLogout={handleLogout}
                  user={user}
                />
                <main className="main-content">
                  <header className="mb-6 flex justify-between items-center">
                    <div>
                      <h1 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                        {activeTab === 'dashboard' ? 'Facturas' :
                          activeTab === 'profile' ? 'Configuración de Perfil' : 'Ajustes de Cuenta'}
                      </h1>
                      <p style={{ color: 'var(--text-muted)' }}>
                        {activeTab === 'dashboard'
                          ? 'Gestiona y visualiza tus facturas procesadas por IA'
                          : activeTab === 'profile'
                            ? 'Personaliza tus datos de facturación y canales de ingesta'
                            : 'Gestiona tus credenciales de acceso y seguridad'}
                      </p>
                    </div>
                    <div className="user-profile-badge">
                      <span className="text-sm font-medium">{user?.name}</span>
                    </div>
                  </header>

                  {activeTab === 'dashboard' && <Dashboard apiBase={API_BASE} user={user} />}
                  {activeTab === 'profile' && (
                    <Profile user={user} setUser={setUser} apiBase={API_BASE} />
                  )}
                  {activeTab === 'settings' && (
                    <Settings user={user} setUser={setUser} apiBase={API_BASE} />
                  )}
                </main>
              </div>
            </ProtectedRoute>
          }
        />

        {/* Redirect any other route to landing or dashboard depending on auth */}
        <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/"} replace />} />
      </Routes>
    </Router>
  );
}

export default App;

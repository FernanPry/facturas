import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import LandingPage from './pages/LandingPage';
import Auth from './pages/Auth';
import ProtectedRoute from './components/ProtectedRoute';
import Settings from './components/Settings';
import ManualUpload from './components/ManualUpload';
import Activities from './components/Activities';
import FinanceDashboard from './components/FinanceDashboard';
import { API_BASE } from './config';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

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
        .then(async res => {
          if (res.ok) return res.json();
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || 'No autorizado');
        })
        .then(fullUser => {
          setUser(fullUser);
          localStorage.setItem('user', JSON.stringify(fullUser));
          setIsAuthenticated(true);
        })
        .catch(err => {
          console.error("Error fetching profile:", err);
          if (err.message.includes('No autorizado') || err.message.includes('Token inválido')) {
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
                  theme={theme}
                  setTheme={setTheme}
                />
                <main className="main-content">
                  <header className="mb-6 flex justify-between items-center">
                    <div>
                      <h1 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                        {activeTab === 'dashboard' ? 'Facturas' :
                          activeTab === 'finance' ? 'Análisis' :
                          activeTab === 'upload' ? 'Subir Facturas' :
                          activeTab === 'activities' ? 'Configuración de Actividades' : 'Ajustes y Configuración'}
                      </h1>
                      <p style={{ color: 'var(--text-muted)' }}>
                        {activeTab === 'dashboard'
                          ? 'Gestiona y visualiza tus facturas procesadas por IA'
                          : activeTab === 'finance'
                            ? 'Análisis BI de gastos, impuestos y canales de ingesta'
                          : activeTab === 'upload'
                            ? 'Carga manualmente una factura desde tu PC para procesarla por IA'
                            : activeTab === 'activities'
                              ? 'Relaciona tus emisores con actividades económicas específicas'
                              : 'Configura tus datos de facturación, canales de ingesta y credenciales'}
                      </p>
                    </div>
                    <div className="user-profile-badge">
                      <span className="text-sm font-medium">{user?.name}</span>
                    </div>
                  </header>

                  {activeTab === 'dashboard' && <Dashboard apiBase={API_BASE} user={user} />}
                  {activeTab === 'finance' && <FinanceDashboard apiBase={API_BASE} user={user} />}
                  {activeTab === 'settings' && (
                    <Settings user={user} setUser={setUser} apiBase={API_BASE} />
                  )}
                  {activeTab === 'upload' && (
                    <ManualUpload apiBase={API_BASE} />
                  )}
                  {activeTab === 'activities' && (
                    <Activities apiBase={API_BASE} />
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

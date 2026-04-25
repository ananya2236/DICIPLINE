import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Layout from './Layout';
import Login from './Login';
import Dashboard from './pages/Dashboard';
import Tracker from './pages/Tracker';
import DSATracker from './pages/DSATracker';
import Stats from './pages/Stats';
import Reflections from './pages/Reflections';
import { requestNotificationPermission } from './notifications';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user) {
      requestNotificationPermission();
    }
  }, [user]);
  
  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-gold border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return user ? <Layout>{children}</Layout> : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/tracker" element={<PrivateRoute><Tracker /></PrivateRoute>} />
          <Route path="/dsa" element={<PrivateRoute><DSATracker /></PrivateRoute>} />
          <Route path="/stats" element={<PrivateRoute><Stats /></PrivateRoute>} />
          <Route path="/reflections" element={<PrivateRoute><Reflections /></PrivateRoute>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;


import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import LoginPage from './pages/LoginPage';
import MenuPage from './pages/MenuPage';
import KitchenPage from './pages/KitchenPage';
import AdminPage from './pages/AdminPage';
import ScreensaverPage from './pages/ScreensaverPage';
import Header from './components/Header';
import Chatbot from './components/Chatbot';
import InactivityGuard from './components/InactivityGuard';

// A wrapper to protect routes that require authentication
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  if (!currentUser) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <CartProvider>
        <HashRouter>
          <RouterBody />
        </HashRouter>
      </CartProvider>
    </AuthProvider>
  );
};

const RouterBody: React.FC = () => {
  const location = useLocation();
  const isScreensaver = location.pathname === '/';

  return (
    <div className="min-h-screen bg-stone-100 text-stone-800">
      <InactivityGuard />
      {!isScreensaver && <Header />}
      <main className={isScreensaver ? '' : 'p-4 md:p-8'}>
        <Routes>
          <Route path="/" element={<ScreensaverPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/menu" element={<ProtectedRoute><MenuPage /></ProtectedRoute>} />
          <Route path="/kitchen" element={<ProtectedRoute><KitchenPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        </Routes>
      </main>
      {!isScreensaver && <Chatbot />}
    </div>
  );
};

export default App;

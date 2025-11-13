
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import LoginPage from './pages/LoginPage';
import MenuPage from './pages/MenuPage';
import KitchenPage from './pages/KitchenPage';
import AdminPage from './pages/AdminPage';
import Header from './components/Header';
import Chatbot from './components/Chatbot';

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
          <div className="min-h-screen bg-stone-100 text-stone-800">
            <Header />
            <main className="p-4 md:p-8">
              <Routes>
                <Route path="/" element={<LoginPage />} />
                <Route path="/menu" element={<ProtectedRoute><MenuPage /></ProtectedRoute>} />
                <Route path="/kitchen" element={<ProtectedRoute><KitchenPage /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
              </Routes>
            </main>
            <Chatbot />
          </div>
        </HashRouter>
      </CartProvider>
    </AuthProvider>
  );
};

export default App;

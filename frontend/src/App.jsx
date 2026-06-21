import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Plants from './pages/Plants';
import Products from './pages/Products';
import Purchases from './pages/Purchases';
import Transfers from './pages/Transfers';
import Invoices from './pages/Invoices';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import Employees from './pages/Employees';
import Attendance from './pages/Attendance';
import Salaries from './pages/Salaries';
import Expenses from './pages/Expenses';
import CashBook from './pages/CashBook';
import Reports from './pages/Reports';
import { AuthProvider, useAuth } from './context/AuthContext';

// Session guard
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Manager/Admin Guard
const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return null; // Avoid quick flickers before state resolution

  const role = user?.role || localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user'))?.role : null;

  if (role && !['Admin', 'Manager'].includes(role)) {
    // Redirect standard staff users directly to products master
    return <Navigate to="/products" replace />;
  }
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          
          <Route path="dashboard" element={
            <AdminRoute>
              <Dashboard />
            </AdminRoute>
          } />
          
          <Route path="plants" element={<Plants />} />
          <Route path="products" element={<Products />} />
          <Route path="purchases" element={<Purchases />} />
          <Route path="transfers" element={<Transfers />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="customers" element={<Customers />} />
          <Route path="suppliers" element={<Suppliers />} />
          
          <Route path="employees" element={<Employees />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="salaries" element={<Salaries />} />
          
          <Route path="expenses" element={<Expenses />} />
          <Route path="cashbook" element={<CashBook />} />
          
          <Route path="reports" element={
            <AdminRoute>
              <Reports />
            </AdminRoute>
          } />
          
          {/* Fallback Catch-all redirect */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;

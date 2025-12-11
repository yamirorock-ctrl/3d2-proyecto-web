import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Props {
  children: React.ReactNode;
}

const AdminGuard: React.FC<Props> = ({ children }) => {
  const { isAdmin, loading } = useAuth();

  if (loading) {
     return <div className="p-10 text-center">Verificando acceso...</div>;
  }

  if (!isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
};

export default AdminGuard;

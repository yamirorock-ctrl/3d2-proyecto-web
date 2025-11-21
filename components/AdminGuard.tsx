import React from 'react';
import { Navigate } from 'react-router-dom';
import { isSessionAuthenticated } from '../utils/auth';

interface Props {
  children: React.ReactNode;
}

const AdminGuard: React.FC<Props> = ({ children }) => {
  if (!isSessionAuthenticated()) {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
};

export default AdminGuard;

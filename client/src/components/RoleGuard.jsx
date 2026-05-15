import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function RoleGuard({ role, children }) {
  const { isAuthenticated, role: userRole } = useAuth();

  if (!isAuthenticated) return <Navigate to="/connect" replace />;
  if (userRole !== role)  return <Navigate to="/"       replace />;

  return children;
}

import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Navbar          from "./components/Navbar";
import RoleGuard       from "./components/RoleGuard";
import Landing         from "./pages/Landing";
import Register        from "./pages/Register";
import ConnectWallet   from "./pages/ConnectWallet";
import DonorDashboard  from "./pages/DonorDashboard";
import AdminDashboard  from "./pages/AdminDashboard";
import BeneficiaryPortal from "./pages/BeneficiaryPortal";

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Routes>
          <Route path="/"          element={<Landing />} />
          <Route path="/register"  element={<Register />} />
          <Route path="/connect"   element={<ConnectWallet />} />

          <Route path="/donor/*" element={
            <RoleGuard role="donor">
              <DonorDashboard />
            </RoleGuard>
          } />

          <Route path="/admin/*" element={
            <RoleGuard role="admin">
              <AdminDashboard />
            </RoleGuard>
          } />

          <Route path="/beneficiary/*" element={
            <RoleGuard role="beneficiary">
              <BeneficiaryPortal />
            </RoleGuard>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}

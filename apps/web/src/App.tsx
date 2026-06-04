import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import AppShell from "@/components/layout/AppShell";
import PrivateRoute from "@/components/auth/PrivateRoute";
import SessionManager from "@/components/auth/SessionManager";
import LoginPage from "@/pages/LoginPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import DashboardPage from "@/pages/DashboardPage";
import PatientsListPage from "@/pages/patients/PatientsListPage";
import PatientFormPage from "@/pages/patients/PatientFormPage";
import PatientDetailPage from "@/pages/patients/PatientDetailPage";
import ConsultationFormPage from "@/pages/consultations/ConsultationFormPage";
import ConsultationDetailPage from "@/pages/consultations/ConsultationDetailPage";
import ConsultationsListPage from "@/pages/consultations/ConsultationsListPage";
import SpecialistsListPage from "@/pages/admin/SpecialistsListPage";
import SettingsPage from "@/pages/SettingsPage";
import RemindersPage from "@/pages/reminders/RemindersPage";

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: "10px",
            background: "#1e293b",
            color: "#f1f5f9",
          },
        }}
      />
      <SessionManager />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route
          element={
            <PrivateRoute>
              <AppShell />
            </PrivateRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Patients */}
          <Route path="/patients" element={<PatientsListPage />} />
          <Route path="/patients/new" element={<PatientFormPage />} />
          <Route path="/patients/:id" element={<PatientDetailPage />} />
          <Route path="/patients/:id/edit" element={<PatientFormPage />} />

          {/* Consultations */}
          <Route path="/consultations" element={<ConsultationsListPage />} />
          <Route path="/consultations/new" element={<ConsultationFormPage />} />
          <Route path="/consultations/:id" element={<ConsultationDetailPage />} />

          {/* Admin */}
          <Route path="/specialists" element={<SpecialistsListPage />} />

          {/* Reminders */}
          <Route path="/reminders" element={<RemindersPage />} />

          {/* Settings */}
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

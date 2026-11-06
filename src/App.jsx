import { Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AttendanceReport from "./pages/AttendanceReport";
import Dashboard from "./pages/Dashboard";
import EmailConfirmed from "./pages/EmailConfirmed";
import EventForm from "./pages/EventForm";
import ForgotPassword from "./pages/ForgotPassword";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Register />} />
      <Route path="/email-confirmado" element={<EmailConfirmed />} />
      <Route path="/esqueci-senha" element={<ForgotPassword />} />
      <Route path="/redefinir-senha" element={<ResetPassword />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/eventos/novo"
        element={
          <ProtectedRoute>
            <EventForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/eventos/:id"
        element={
          <ProtectedRoute>
            <EventForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/eventos/:id/presenca"
        element={
          <ProtectedRoute>
            <AttendanceReport />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

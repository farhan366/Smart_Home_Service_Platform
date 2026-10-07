import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ServiceDiscovery from "./pages/ServiceDiscovery";
import ProviderPublicProfile from "./pages/ProviderPublicProfile";
import CustomerAddresses from "./pages/CustomerAddresses";
import ProviderDashboard from "./pages/ProviderDashboard";

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<ServiceDiscovery />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/providers/:id" element={<ProviderPublicProfile />} />
        <Route path="/account/addresses" element={<ProtectedRoute roles={["customer"]}><CustomerAddresses /></ProtectedRoute>} />
        <Route path="/provider/dashboard" element={<ProtectedRoute roles={["provider"]}><ProviderDashboard /></ProtectedRoute>} />
        {/* Module 2 / 3 routes mount here: /bookings, /disputes, /admin/analytics */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

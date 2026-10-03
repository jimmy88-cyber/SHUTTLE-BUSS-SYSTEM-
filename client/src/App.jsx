import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/passenger/Home";
import Book from "./pages/passenger/Book";
import Bookings from "./pages/passenger/Bookings";
import Driver from "./pages/driver/Driver";
import DriverScan from "./pages/driver/DriverScan";
import Admin from "./pages/admin/Admin";
import AdminVehicles from "./pages/admin/AdminVehicles";
import AdminRoutes from "./pages/admin/AdminRoutes";
import AdminTrips from "./pages/admin/AdminTrips";
import AdminBookings from "./pages/admin/AdminBookings";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminEmployees from "./pages/admin/AdminEmployees";
import AdminBoarding from "./pages/admin/AdminBoarding";
import AdminReports from "./pages/admin/AdminReports";
import "./index.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/home" element={<Home />} />
        <Route path="/book" element={<Book />} />
        <Route path="/bookings" element={<Bookings />} />

        <Route path="/driver" element={<Driver />} />
        <Route path="/driver/scan" element={<DriverScan />} />

        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/vehicles" element={<AdminVehicles />} />
        <Route path="/admin/routes" element={<AdminRoutes />} />
        <Route path="/admin/trips" element={<AdminTrips />} />
        <Route path="/admin/bookings" element={<AdminBookings />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/employees" element={<AdminEmployees />} />
        <Route path="/admin/boarding" element={<AdminBoarding />} />
        <Route path="/admin/reports" element={<AdminReports />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

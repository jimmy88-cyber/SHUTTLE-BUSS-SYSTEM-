import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { refreshUser } from "./api/auth";
import { useCurrentUser } from "./hooks/useCurrentUser";
import { getFirstPermittedPath, getPermissionBits } from "./permissions";
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

const REFRESH_INTERVAL_MS = 30000;

/**
 * ตรวจข้อมูลผู้ใช้/สิทธิ์จาก server เมื่อเปลี่ยนหน้า กลับมาเปิดแท็บ
 * และทุก 30 วินาที เพื่อให้การเปลี่ยน permission มีผลระหว่างใช้งาน
 */
function PermissionSync() {
  const { pathname } = useLocation();

  useEffect(() => {
    // โหลดข้อมูลตำแหน่งและสิทธิ์ล่าสุดเมื่อเปลี่ยนหน้า
    refreshUser();
  }, [pathname]);

  useEffect(() => {
    // อัปเดตสิทธิ์เมื่อกลับมาเปิดแท็บ และตรวจซ้ำเป็นระยะ
    window.addEventListener("focus", refreshUser);
    const timer = setInterval(refreshUser, REFRESH_INTERVAL_MS);
    return () => {
      // เอาตัวตรวจสอบออกเมื่อ component ถูกถอด เพื่อไม่ให้เกิด listener/timer ค้าง
      window.removeEventListener("focus", refreshUser);
      clearInterval(timer);
    };
  }, []);

  return null;
}

// Route guard สำหรับหน้าที่จำกัดสิทธิ์:
// ต้องมีข้อมูลผู้ใช้ก่อน และต้องมี permission bit ของหน้าที่ร้องขอ
function PermissionRoute({ bit, requiredBits = [], children, allowPassenger = false }) {
  const user = useCurrentUser();
  // ไม่มีข้อมูลผู้ใช้ใน browser ให้กลับไปหน้า Login
  if (!user) return <Navigate to="/" replace />;
  // route หน้าผู้โดยสารอนุญาตบัญชี passenger โดยตรง
  if (allowPassenger && user.user_type === "passenger") return children;

  // ตรวจ permission หลักและ permission เพิ่มเติม (ถ้ามี) ว่าได้รับอนุญาตทั้งหมดหรือไม่
  const permission = getPermissionBits(user.permission, user.position_id);
  if ([bit, ...requiredBits].every((index) => permission[index] === "1")) return children;
  // ถ้าไม่มีสิทธิ์หน้านี้ ให้ส่งไปหน้าที่มีสิทธิ์แทน
  return <Navigate to={getFirstPermittedPath(user)} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      {/* ซิงก์ข้อมูลผู้ใช้และสิทธิ์ให้ครอบคลุมทุก route */}
      <PermissionSync />
      <Routes>
        {/* หน้าสาธารณะ: Login และ Register ไม่ต้องมีสถานะผู้ใช้ก่อนเข้า */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* หน้าผู้โดยสาร: ต้อง login; passenger เข้าได้ตาม user_type
            ส่วนบัญชีพนักงานต้องมี permission bit 8 */}
        <Route path="/home" element={<PermissionRoute bit={8} allowPassenger><Home /></PermissionRoute>} />
        <Route path="/book" element={<PermissionRoute bit={8} allowPassenger><Book /></PermissionRoute>} />
        <Route path="/bookings" element={<PermissionRoute bit={8} allowPassenger><Bookings /></PermissionRoute>} />

        {/* หน้าคนขับ: ต้อง login และมี permission bit 9 */}
        <Route path="/driver" element={<PermissionRoute bit={9}><Driver /></PermissionRoute>} />
        <Route path="/driver/scan" element={<PermissionRoute bit={9}><DriverScan /></PermissionRoute>} />

        {/* หน้าแอดมิน: แต่ละหน้าใช้ AdminLayout ตรวจสถานะผู้ใช้และ permission ของเมนู */}
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/vehicles" element={<AdminVehicles />} />
        <Route path="/admin/routes" element={<AdminRoutes />} />
        <Route path="/admin/trips" element={<AdminTrips />} />
        <Route path="/admin/bookings" element={<AdminBookings />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/employees" element={<AdminEmployees />} />
        <Route path="/admin/boarding" element={<AdminBoarding />} />
        <Route path="/admin/reports" element={<AdminReports />} />

        {/* URL ที่ไม่ตรงกับ route ใดให้กลับไปหน้า Login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

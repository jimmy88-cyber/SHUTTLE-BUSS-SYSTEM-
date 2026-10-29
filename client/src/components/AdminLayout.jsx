import { Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { clearUser } from "../api/auth";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { getPermissionBits } from "../permissions";
import DriverNav from "./DriverNav";

const MENU = [
  { path: "/admin", label: "📊 แดชบอร์ด", exact: true, bit: 0 },
  { path: "/admin/vehicles", label: "🚌 จัดการรถและประเภท", bit: 1 },
  { path: "/admin/routes", label: "🗺️ เส้นทาง", bit: 2 },
  { path: "/admin/trips", label: "📅 รอบรถ", bit: 3 },
  { path: "/admin/bookings", label: "🎫 การจอง", bit: 4 },
  { path: "/admin/users", label: "🧑‍🎓 ผู้ใช้บริการ", bit: 5 },
  { path: "/admin/employees", label: "👥 พนักงาน", bit: 6 },
  { path: "/admin/boarding", label: "✅ ขึ้นรถ", bit: 7 },
  { path: "/admin/reports", label: "📈 รายงาน", bit: 10 },
  { path: "/home", label: "👤 หน้าผู้ใช้บริการ", bit: 8 },
  { path: "/driver", label: "🚌 หน้าคนขับ", bit: 9, exact: true },
];

export default function AdminLayout({ title, subtitle, children }) {
  // อ่านผู้ใช้แบบ reactive เพื่อให้หน้าเปลี่ยนทันทีเมื่อ Login/Logout หรือสิทธิ์ถูกอัปเดต
  const user = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) {
    // ไม่มีสถานะ Login ให้กลับไปหน้า Login
    return <Navigate to="/" replace />;
  }

  const permission = getPermissionBits(user.permission, user.position_id);
  // ใช้หน้าจอแบบมือถือของคนขับ เมื่อตำแหน่งมีสิทธิ์หน้าคนขับแต่ไม่มีสิทธิ์แดชบอร์ด (ไม่ผูกกับรหัสตำแหน่ง)
  const isDriver = permission[9] === "1" && permission[0] !== "1";
  // ตรวจ permission bit ของแต่ละรายการ เพื่อใช้ทั้งกรองเมนูและป้องกัน URL ที่ไม่มีสิทธิ์
  function hasAccess(item) {
    // หน้าคนขับพิจารณาสิทธิ์คนขับโดยตรง
    if (item.path === "/driver") {
      return permission[9] === "1";
    }
    return permission[item.bit] === "1";
  }

  const currentPage = MENU.find((item) =>
    item.exact
      ? location.pathname === item.path
      : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
  );
  if (currentPage && !hasAccess(currentPage)) {
    // ถ้าเปิด URL ที่ไม่มีสิทธิ์ ให้ redirect ไปเมนูแรกที่ได้รับอนุญาต
    const firstAllowedPage = MENU.find(hasAccess);
    return <Navigate to={firstAllowedPage?.path || "/"} replace />;
  }

  // ออกจากระบบหลังผู้ใช้ยืนยันในกล่องถาม
  function logout() {
    // ถ้าผู้ใช้กดยกเลิก ให้คงสถานะ login และอยู่หน้าเดิม
    if (!confirm("ออกจากระบบ?")) return;
    // ลบข้อมูลผู้ใช้ออกจาก localStorage และแจ้งส่วนต่าง ๆ ในแอป
    clearUser();
    // กลับไปยังหน้า Login ที่ URL /
    navigate("/");
  }

  function isActive(item) {
    return item.exact
      ? location.pathname === item.path
      : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
  }

  return (
    <div className={`admin-shell${isDriver ? " driver-admin-shell" : ""}`}>
      <nav className="admin-navbar">
        <div className="admin-navbar-inner">
          <div className="admin-brand">
            🚌 <span>Shuttle</span> Admin
          </div>
          <div className="admin-user">
            <div className="avatar" style={{ background: "#0d9488", color: "#fff" }}>
              {user.first_name?.charAt(0)}
            </div>
            <span>
              {user.first_name} {user.last_name}
              {user.position_name ? ` (${user.position_name})` : ""}
            </span>
            {/* เรียก logout เมื่อผู้ใช้กดปุ่มออกจากระบบ */}
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={logout}
              style={{ color: "#fff", borderColor: "rgba(255,255,255,0.35)", background: "transparent" }}
            >
              ออก
            </button>
          </div>
        </div>
      </nav>
      <div className="admin-body">
        <aside className="admin-sidebar">
          <ul className="sidebar-menu">
            {MENU.filter(hasAccess).map((m) => (
              <li key={m.path}>
                <Link to={m.path} className={isActive(m) ? "active" : ""}>
                  {m.label}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
        <main className="admin-main">
          {(title || subtitle) && (
            <div className="page-header" style={{ paddingTop: 0 }}>
              {title && <h1>{title}</h1>}
              {subtitle && <p>{subtitle}</p>}
            </div>
          )}
          {children}
        </main>
      </div>
      {isDriver && <DriverNav />}
    </div>
  );
}

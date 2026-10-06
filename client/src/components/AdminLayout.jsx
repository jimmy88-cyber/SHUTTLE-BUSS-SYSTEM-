import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { getUser, clearUser } from "../api/auth";
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
  { path: "/admin/reports", label: "📈 รายงาน", bit: 0 },
  { path: "/home", label: "👤 หน้าผู้ใช้บริการ", bit: 8 },
  { path: "/driver", label: "🚌 หน้าคนขับ", bit: 9, exact: true },
];

export default function AdminLayout({ title, subtitle, children }) {
  const [user, setUser] = useState(getUser);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    function refreshUser() {
      setUser(getUser());
    }
    window.addEventListener("shuttle-user-change", refreshUser);
    return () => window.removeEventListener("shuttle-user-change", refreshUser);
  }, []);

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const isDriver = String(user.position_id || "").padStart(2, "0") === "03";
  const permission = getPermissionBits(user.permission, user.position_id);
  function hasAccess(item) {
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
    const firstAllowedPage = MENU.find(hasAccess);
    return <Navigate to={firstAllowedPage?.path || "/"} replace />;
  }

  function logout() {
    if (!confirm("ออกจากระบบ?")) return;
    clearUser();
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

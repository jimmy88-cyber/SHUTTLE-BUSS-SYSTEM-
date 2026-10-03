import { Link, useNavigate, useLocation } from "react-router-dom";
import { getUser, clearUser } from "../api/auth";

const MENU = [
  { path: "/admin", label: "📊 แดชบอร์ด", exact: true },
  { path: "/admin/vehicles", label: "🚌 จัดการรถและประเภท" },
  { path: "/admin/routes", label: "🗺️ เส้นทาง" },
  { path: "/admin/trips", label: "📅 รอบรถ" },
  { path: "/admin/bookings", label: "🎫 การจอง" },
  { path: "/admin/users", label: "🧑‍🎓 ผู้ใช้บริการ" },
  { path: "/admin/employees", label: "👥 พนักงาน" },
  { path: "/admin/boarding", label: "✅ ขึ้นรถ" },
  { path: "/admin/reports", label: "📈 รายงาน" },
];

export default function AdminLayout({ title, subtitle, children }) {
  const user = getUser();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) {
    navigate("/");
    return null;
  }

  function logout() {
    if (!confirm("ออกจากระบบ?")) return;
    clearUser();
    navigate("/");
  }

  function isActive(item) {
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  }

  return (
    <div className="admin-shell">
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
            {MENU.map((m) => (
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
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getUser } from "../api/auth";
import { getPermissionBits } from "../permissions";

const ADMIN_LINKS = [
  { bit: 0, path: "/admin", icon: "📊", label: "แดชบอร์ด" },
  { bit: 1, path: "/admin/vehicles", icon: "🚌", label: "จัดการรถ" },
  { bit: 2, path: "/admin/routes", icon: "🗺️", label: "เส้นทาง" },
  { bit: 3, path: "/admin/trips", icon: "📅", label: "รอบรถ" },
  { bit: 4, path: "/admin/bookings", icon: "🎫", label: "การจอง" },
  { bit: 5, path: "/admin/users", icon: "🧑‍🎓", label: "ผู้ใช้บริการ" },
  { bit: 6, path: "/admin/employees", icon: "👥", label: "พนักงาน" },
  { bit: 7, path: "/admin/boarding", icon: "✅", label: "ขึ้นรถ" },
  { bit: 0, path: "/admin/reports", icon: "📈", label: "รายงาน" },
];

export default function DriverNav() {
  const { pathname } = useLocation();
  const [user, setUser] = useState(getUser);
  const permission = getPermissionBits(user?.permission, user?.position_id);
  const permittedLinks = [
    ...(permission[9] === "1"
      ? [{ path: "/driver", icon: "🚐", label: "หน้าคนขับ" }]
      : []),
    ...ADMIN_LINKS.filter((item) => permission[item.bit] === "1"),
    ...(permission[8] === "1"
      ? [{ path: "/home", icon: "👤", label: "ผู้ใช้บริการ" }]
      : []),
  ];

  useEffect(() => {
    function refreshUser() {
      setUser(getUser());
    }
    window.addEventListener("shuttle-user-change", refreshUser);
    return () => window.removeEventListener("shuttle-user-change", refreshUser);
  }, []);

  return (
    <nav className={`m-nav driver-nav${permittedLinks.length > 6 ? " driver-nav-many" : ""}`}>
      {permittedLinks.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className={pathname === item.path ? "active" : ""}
        >
          <span className="ico">{item.icon}</span>
          <span className="driver-nav-label">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

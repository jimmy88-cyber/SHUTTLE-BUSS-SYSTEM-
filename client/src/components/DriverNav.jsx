import { Link, useLocation } from "react-router-dom";

export default function DriverNav() {
  const { pathname } = useLocation();
  return (
    <nav className="m-nav">
      <Link to="/driver" className={pathname === "/driver" || pathname.startsWith("/driver/") ? "active" : ""}>
        <span className="ico">🚌</span>
        รอบรถ
      </Link>
    </nav>
  );
}

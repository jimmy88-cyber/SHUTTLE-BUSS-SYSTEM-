import { Link } from 'react-router-dom';

export default function BottomNav({ active }) {
  return (
    <nav className="m-nav">
      <Link to="/home" className={active === 'home' ? 'active' : ''}>
        <span className="ico">🗺️</span>เส้นทาง
      </Link>
      <Link to="/book" className={active === 'book' ? 'active' : ''}>
        <span className="ico">🎫</span>จองรถ
      </Link>
      <Link to="/bookings" className={active === 'bookings' ? 'active' : ''}>
        <span className="ico">📋</span>การจอง
      </Link>
    </nav>
  );
}

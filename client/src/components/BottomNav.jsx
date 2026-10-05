import { Link } from 'react-router-dom';
import { getUser } from '../api/auth';
import { getPermissionBits } from '../permissions';

export default function BottomNav({ active }) {
  const user = getUser();
  const passenger = user?.user_type === 'passenger';
  const permission = getPermissionBits(user?.permission, user?.position_id);

  return (
    <nav className="m-nav">
      {(passenger || permission[8] === '1') && (
        <Link to="/home" className={active === 'home' ? 'active' : ''}>
          <span className="ico">🗺️</span>เส้นทาง
        </Link>
      )}
      {(passenger || permission[8] === '1') && (
        <Link to="/book" className={active === 'book' ? 'active' : ''}>
          <span className="ico">🎫</span>จองรถ
        </Link>
      )}
      {(passenger || permission[8] === '1') && (
        <Link to="/bookings" className={active === 'bookings' ? 'active' : ''}>
          <span className="ico">📋</span>การจอง
        </Link>
      )}
      {!passenger && permission[0] === '1' && (
        <Link to="/admin">
          <span className="ico">⚙️</span>หลังบ้าน
        </Link>
      )}
    </nav>
  );
}

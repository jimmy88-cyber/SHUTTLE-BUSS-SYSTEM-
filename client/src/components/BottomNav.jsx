import { Link } from 'react-router-dom';
import { getUser } from '../api/auth';
import { getPermissionBits } from '../permissions';

// เมนูนำทางด้านล่างสำหรับหน้าผู้โดยสารและบัญชีพนักงานที่ได้รับ permission
export default function BottomNav({ active }) {
  const user = getUser();
  const passenger = user?.user_type === 'passenger';
  const permission = getPermissionBits(user?.permission, user?.position_id);

  return (
    <nav className="m-nav">
      {/* passenger ใช้เมนูผู้โดยสารได้; พนักงานต้องมี bit 8 */}
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
      {/* ซ่อนเมนูหลังบ้านจาก passenger และแสดงให้ผู้มีสิทธิ์ dashboard (bit 0) */}
      {!passenger && permission[0] === '1' && (
        <Link to="/admin">
          <span className="ico">⚙️</span>หลังบ้าน
        </Link>
      )}
    </nav>
  );
}

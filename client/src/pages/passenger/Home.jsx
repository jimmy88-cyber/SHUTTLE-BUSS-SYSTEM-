import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { getUser, clearUser } from '../../api/auth';
import BottomNav from '../../components/BottomNav';

export default function Home() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = getUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    api.getRoutes()
      .then(setRoutes)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function logout() {
    if (!confirm('ต้องการออกจากระบบ?')) return;
    clearUser();
    navigate('/');
  }

  if (!user) return null;

  return (
    <div className="m-body">
      <div className="m-status">
        <span>{new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
        <span>Shuttle MUT</span>
      </div>
      <header className="m-header rounded">
        <div className="row">
          <div>
            <h1>สวัสดี, {user.first_name} 👋</h1>
            <p>จองรถรับส่ง MUT</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="m-btn m-btn-ghost" onClick={logout}>ออก</button>
            <div className="avatar">{user.first_name?.charAt(0)}</div>
          </div>
        </div>
      </header>
      <div className="m-content">
        <div style={{ margin: '4px 2px 10px' }}>
          <strong style={{ fontSize: '0.95rem' }}>🗺️ เส้นทางทั้งหมด</strong>
        </div>
        {loading ? (
          <div className="m-empty">กำลังโหลด...</div>
        ) : routes.length === 0 ? (
          <div className="m-empty"><div className="big">🗺️</div>ยังไม่มีเส้นทาง</div>
        ) : (
          routes.map((r) => (
            <div className="m-card" key={r.route_id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <strong>{r.route_name}</strong>
                <span className="m-badge m-badge-planned">{r.total_minutes} นาที</span>
              </div>
              <div className="tl">
                {(r.stops || []).map((s) => (
                  <div className="tl-i" key={s.sequence_no}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{s.stop_name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {s.minutes_from_prev === 0 ? 'จุดเริ่ม' : `+${s.minutes_from_prev} นาที`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      <BottomNav active="home" />
    </div>
  );
}

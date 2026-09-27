import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { getUser, clearUser } from '../../api/auth';

export default function Driver() {
  const user = getUser();
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [passengers, setPassengers] = useState([]);
  const [paxLoading, setPaxLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    api
      .getSchedules({ driver_id: user.user_id })
      .then(setTrips)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function openTrip(t) {
    setSelected(t);
    setPaxLoading(true);
    try {
      const list = await api.getBookings({ schedule_id: t.schedule_id });
      setPassengers(list.filter((b) => b.status === 'booked'));
    } catch (e) {
      console.error(e);
      setPassengers([]);
    } finally {
      setPaxLoading(false);
    }
  }

  if (!user) return null;

  return (
    <div className="m-body">
      <div className="m-status">
        <span>คนขับ</span>
        <span>{user.first_name}</span>
      </div>
      <header className="m-header rounded">
        <div className="row">
          <div>
            <h1>🚌 รอบรถของฉัน</h1>
            <p>{user.first_name} {user.last_name}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link to="/driver/scan" className="m-btn m-btn-ghost" style={{ fontSize: '0.8rem' }}>
              สแกน QR
            </Link>
            <button
              className="m-btn m-btn-ghost"
              onClick={() => {
                if (confirm('ออกจากระบบ?')) {
                  clearUser();
                  navigate('/');
                }
              }}
            >
              ออก
            </button>
          </div>
        </div>
      </header>

      <div className="m-content">
        {selected ? (
          <>
            <button
              className="m-btn m-btn-outline"
              style={{ marginBottom: 12, width: 'auto' }}
              onClick={() => setSelected(null)}
            >
              ← กลับรายการรอบ
            </button>
            <div className="m-card">
              <strong>{selected.route?.route_name}</strong>
              <div style={{ fontSize: '0.9rem', color: '#64748b', marginTop: 4 }}>
                {selected.departure_time
                  ? new Date(selected.departure_time).toLocaleString('th-TH')
                  : '-'}
                {' · '}
                {selected.vehicle?.plate_number}
              </div>
              <div style={{ marginTop: 6 }}>
                <span className="m-badge m-badge-planned">{selected.status}</span>
                {' '}ว่าง {selected.seats_available}/{selected.vehicle?.capacity}
              </div>
            </div>
            <div style={{ fontWeight: 600, margin: '12px 0 8px' }}>
              ผู้โดยสาร ({passengers.length})
            </div>
            {paxLoading ? (
              <div className="m-empty">กำลังโหลด...</div>
            ) : passengers.length === 0 ? (
              <div className="m-empty">
                <div className="big">👤</div>
                ยังไม่มีผู้จอง
              </div>
            ) : (
              passengers.map((p) => (
                <div className="m-card" key={p.booking_id} style={{ padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{p.user?.passenger_name || `#${p.user?.user_id}`}</strong>
                    <span className="m-badge m-badge-booked">{p.num_seats} ที่</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>
                    {p.pickup?.stop_name} → {p.dropoff?.stop_name}
                  </div>
                  <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', marginTop: 4 }}>
                    {p.qr_code}
                  </div>
                </div>
              ))
            )}
          </>
        ) : loading ? (
          <div className="m-empty">กำลังโหลด...</div>
        ) : trips.length === 0 ? (
          <div className="m-empty">
            <div className="big">🚌</div>
            ยังไม่มีรอบรถที่มอบหมาย
          </div>
        ) : (
          trips.map((t) => (
            <div
              className="m-card"
              key={t.schedule_id}
              style={{ cursor: 'pointer' }}
              onClick={() => openTrip(t)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <strong>{t.route?.route_name}</strong>
                <span className="m-badge m-badge-planned">{t.status}</span>
              </div>
              <div style={{ fontSize: '0.9rem', color: '#475569' }}>
                🕐{' '}
                {t.departure_time
                  ? new Date(t.departure_time).toLocaleString('th-TH', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '-'}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                รถ {t.vehicle?.plate_number} · จองแล้ว {t.seats_booked}/{t.vehicle?.capacity}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

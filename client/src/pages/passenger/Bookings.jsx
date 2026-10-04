import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { getUser } from '../../api/auth';
import BottomNav from '../../components/BottomNav';

export default function Bookings() {
  const user = getUser();
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    if (!user) return;
    setLoading(true);
    api.getBookings(user.user_id)
      .then(setList)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    load();
  }, []);

  async function cancel(id) {
    if (!confirm('ต้องการยกเลิกการจองนี้?')) return;
    try {
      await api.cancelBooking(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  if (!user) return null;

  return (
    <div className="m-body">
      <div className="m-status"><span>Shuttle</span><span>การจอง</span></div>
      <header className="m-header rounded">
        <h1>📋 การจองของฉัน</h1>
        <p>ดูและยกเลิกการจอง</p>
      </header>
      <div className="m-content">
        {loading ? (
          <div className="m-empty">กำลังโหลด...</div>
        ) : list.length === 0 ? (
          <div className="m-empty">
            <div className="big">📋</div>
            ยังไม่มีการจอง
            <div style={{ marginTop: 12 }}>
              <button className="m-btn m-btn-primary" style={{ width: 'auto' }} onClick={() => navigate('/book')}>
                ไปจองรถ
              </button>
            </div>
          </div>
        ) : (
          list.map((b) => (
            <div className="m-card" key={b.booking_id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong>#{b.booking_id}</strong>
                <span className={`m-badge ${b.status === 'booked' ? 'm-badge-booked' : 'm-badge-cancelled'}`}>
                  {b.status === 'booked' ? 'จองแล้ว' : 'ยกเลิก'}
                </span>
              </div>
              <div style={{ fontSize: '0.9rem', color: '#475569' }}>
                <div><strong>{b.route?.route_name}</strong></div>
                <div>
                  {b.schedule?.departure_time
                    ? new Date(b.schedule.departure_time).toLocaleString('th-TH', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })
                    : '-'}
                </div>
                <div>{b.pickup?.stop_name} → {b.dropoff?.stop_name}</div>
                <div>{b.num_seats} ที่นั่ง · {b.vehicle?.plate_number}</div>
                {b.qr_code && <div style={{ marginTop: 4, fontFamily: 'monospace', fontSize: '0.8rem' }}>QR: {b.qr_code}</div>}
              </div>
              {b.status === 'booked' && (
                <button
                  className="m-btn m-btn-outline"
                  style={{ marginTop: 12, width: '100%', color: '#b91c1c', borderColor: '#fca5a5' }}
                  onClick={() => cancel(b.booking_id)}
                >
                  ยกเลิกการจอง
                </button>
              )}
            </div>
          ))
        )}
      </div>
      <BottomNav active="bookings" />
    </div>
  );
}

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { getUser, clearUser } from '../../api/auth';

export default function DriverScan() {
  const user = getUser();
  const navigate = useNavigate();
  const [qr, setQr] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  if (!user) {
    navigate('/');
    return null;
  }

  async function lookup() {
    setError('');
    setSuccess('');
    setResult(null);
    if (!qr.trim()) {
      setError('กรุณาใส่รหัส QR');
      return;
    }
    setLoading(true);
    try {
      const data = await api.getBookingByQr(qr.trim());
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function confirmBoard() {
    if (!result) return;
    setLoading(true);
    setError('');
    try {
      await api.createBoarding({
        booking_id: result.booking_id,
        schedule_id: result.schedule?.schedule_id,
        stop_id: result.pickup?.stop_id,
        scanned_by: user.user_id,
      });
      setSuccess('บันทึกขึ้นรถสำเร็จ');
      setResult(null);
      setQr('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="m-body">
      <div className="m-status">
        <span>คนขับ</span>
        <span>สแกน QR</span>
      </div>
      <header className="m-header rounded">
        <div className="row">
          <div>
            <h1>📷 สแกนขึ้นรถ</h1>
            <p>กรอกรหัส QR จากผู้โดยสาร</p>
          </div>
          <Link to="/driver" className="m-btn m-btn-ghost">
            รอบรถ
          </Link>
        </div>
      </header>
      <div className="m-content">
        {error && <div className="error-msg">{error}</div>}
        {success && <div className="success-msg">{success}</div>}

        <div className="m-card">
          <label className="m-label">รหัส QR</label>
          <input
            className="m-input"
            value={qr}
            onChange={(e) => setQr(e.target.value)}
            placeholder="MUT-0001-XXXXXX"
          />
          <button className="m-btn m-btn-primary" onClick={lookup} disabled={loading}>
            {loading ? 'กำลังค้นหา...' : 'ค้นหาการจอง'}
          </button>
        </div>

        {result && (
          <div className="m-card">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              {result.user?.passenger_name}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#475569' }}>
              <div>เส้นทาง: {result.route?.route_name}</div>
              <div>
                เวลา:{' '}
                {result.schedule?.departure_time
                  ? new Date(result.schedule.departure_time).toLocaleString('th-TH')
                  : '-'}
              </div>
              <div>
                {result.pickup?.stop_name} → {result.dropoff?.stop_name}
              </div>
              <div>{result.num_seats} ที่นั่ง · สถานะ {result.status}</div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', marginTop: 4 }}>
                {result.qr_code}
              </div>
            </div>
            {result.status === 'booked' ? (
              <button
                className="m-btn m-btn-primary"
                style={{ marginTop: 14 }}
                onClick={confirmBoard}
                disabled={loading}
              >
                ✅ ยืนยันขึ้นรถ
              </button>
            ) : (
              <div className="error-msg" style={{ marginTop: 12 }}>
                การจองนี้ไม่สามารถขึ้นรถได้ (สถานะ: {result.status})
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

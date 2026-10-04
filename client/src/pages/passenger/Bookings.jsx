import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../../api/client';
import { getUser } from '../../api/auth';
import BottomNav from '../../components/BottomNav';

const FILTERS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'booked', label: 'จองแล้ว' },
  { key: 'checked_in', label: 'เสร็จ' },
  { key: 'cancelled', label: 'ยกเลิก' },
];

// no_show (รอบถูกปิดแล้ว) แสดงเป็น success และนับอยู่ในกลุ่ม "เสร็จ"
const DONE = ['checked_in', 'no_show'];
const BADGE = { booked: 'm-badge-booked', checked_in: 'm-badge-checked', cancelled: 'm-badge-cancel', no_show: 'm-badge-checked' };

// สถานะที่แสดง: การจองที่สแกนขึ้นรถแล้วถือว่า checked_in
const statusOf = (b) => (b.status === 'booked' && b.boarded ? 'checked_in' : b.status);
const isActive = (b) => statusOf(b) === 'booked';

function groupStatus(items) {
  const sts = items.map(statusOf);
  if (sts.every((s) => s === 'cancelled')) return 'cancelled';
  if (sts.some((s) => DONE.includes(s))) return 'checked_in';
  return 'booked';
}

function fmtDateTime(t) {
  if (!t) return '';
  const d = new Date(t);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function Bookings() {
  const user = getUser();
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [qrItems, setQrItems] = useState(null);

  function load() {
    if (!user) return;
    api.getBookings({ user_id: user.user_id })
      .then(setList)
      .catch((e) => alert(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    load();
  }, []);

  async function cancelTrip(scheduleId, items) {
    const active = items.filter(isActive);
    if (!active.length) return;
    if (!confirm(`ยกเลิกการจองรอบ ${scheduleId} ทั้งหมด (${active.length} รายการ)?\nที่นั่งจะว่างกลับ`)) return;
    try {
      for (const b of active) await api.cancelBooking(b.booking_id);
    } catch (e) {
      alert(e.message);
    }
    load();
  }

  if (!user) return null;

  // กรองตามแท็บ
  const filtered = list.filter((b) => {
    const st = statusOf(b);
    if (filter === 'all') return true;
    if (filter === 'checked_in') return DONE.includes(st);
    return st === filter;
  });

  // จัดกลุ่มตามรอบ — จองหลายที่ในรอบเดียวกัน = การ์ดเดียว
  // การจองที่ยกเลิกแยกการ์ดตามครั้งที่กดจอง (การจองที่สร้างพร้อมกันมี booked_at วินาทีเดียวกัน)
  // เพื่อไม่ให้ประวัติหลายครั้งรวมเป็นก้อนเดียวและไม่ปนกับที่นั่งที่ยังใช้งานอยู่
  const groups = {};
  filtered.forEach((b) => {
    const sid = b.schedule?.schedule_id;
    const key = statusOf(b) === 'cancelled' ? `${sid}|c|${(b.booked_at || '').slice(0, 19)}` : `${sid}|a`;
    (groups[key] ||= []).push(b);
  });
  const keys = Object.keys(groups).sort((a, b) => {
    const ca = a.includes('|c|') ? 1 : 0;
    const cb = b.includes('|c|') ? 1 : 0;
    if (ca !== cb) return ca - cb;
    // ใช้งานอยู่: เรียงตามรอบ · ประวัติยกเลิก: ล่าสุดก่อน
    return ca ? b.split('|c|')[1].localeCompare(a.split('|c|')[1]) : a.localeCompare(b);
  });

  return (
    <div className="m-body bookings-page">
      <div className="m-status"><span>Shuttle</span><span>การจอง</span></div>
      <header className="m-header rounded">
        <h1>📋 การจองของฉัน</h1>
        <p>QR · ยกเลิก · ประวัติ</p>
      </header>
      <div className="m-content">
        <div className="m-chip-row">
          {FILTERS.map((f) => (
            <button key={f.key} className={`m-chip${filter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="m-empty">กำลังโหลด...</div>
        ) : keys.length === 0 ? (
          <div className="m-empty"><div className="big">📭</div>ไม่มีรายการ</div>
        ) : (
          keys.map((key) => {
            const items = groups[key];
            const scheduleId = items[0].schedule?.schedule_id;
            const st = groupStatus(items);
            const totalSeats = items.reduce((s, b) => s + b.num_seats, 0);
            const active = items.filter(isActive);
            return (
              <div className="m-card" key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <strong>รอบ {scheduleId}</strong>
                  <span className={`m-badge ${BADGE[st] || ''}`}>{st}</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5 }}>
                  {fmtDateTime(items[0].schedule?.departure_time) || scheduleId} ·{' '}
                  {st === 'cancelled' ? `ยกเลิก ${totalSeats} ที่` : `รวม ${totalSeats} ที่`}
                  {st === 'cancelled' && items[0].booked_at && <div>จองเมื่อ {fmtDateTime(items[0].booked_at)}</div>}
                  {items.map((b) => (
                    <div key={b.booking_id}>
                      #{b.booking_id} {b.pickup?.stop_name} → {b.dropoff?.stop_name} · {b.num_seats} ที่
                    </div>
                  ))}
                </div>
                {active.length > 0 && (
                  <div className="m-btn-row">
                    <button className="m-btn m-btn-primary m-btn-sm" onClick={() => setQrItems(active)}>ดู QR</button>
                    <button className="m-btn m-btn-outline m-btn-sm" onClick={() => cancelTrip(scheduleId, items)}>ยกเลิกทั้งรอบ</button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {qrItems && (
        <div className="m-sheet-overlay" onClick={() => setQrItems(null)}>
          <div className="m-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="m-sheet-handle"></div>
            <h2>QR Code</h2>
            <div className="m-qr-box" style={{ marginBottom: 10 }}>
              <QRCodeSVG
                value={qrItems[0].qr_code}
                size={220}
                level="H"
                includeMargin
                title={`QR สำหรับรอบ ${qrItems[0].schedule?.schedule_id}`}
                style={{ display: 'block', maxWidth: '100%', height: 'auto', margin: '0 auto 10px' }}
              />
              <strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{qrItems[0].qr_code}</strong>
              <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#334155' }}>
                {qrItems.map((b) => (
                  <div key={b.booking_id}>
                    #{b.booking_id} {b.pickup?.stop_name} → {b.dropoff?.stop_name} · {b.num_seats} ที่
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '6px 0 0' }}>ใช้ QR หรือรหัสนี้เช็คอินทุกการจองของบัญชีนี้ในรอบเดียวกัน</p>
            </div>
            <button className="m-btn m-btn-outline" style={{ marginTop: 2 }} onClick={() => setQrItems(null)}>ปิด</button>
          </div>
        </div>
      )}

      <BottomNav active="bookings" />
    </div>
  );
}

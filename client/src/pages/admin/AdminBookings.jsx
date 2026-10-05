import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';

export default function AdminBookings() {
  const [list, setList] = useState([]);

  function load() {
    api.getBookings().then(setList).catch(console.error);
  }
  useEffect(load, []);

  async function cancel(id) {
    if (!confirm('ยกเลิกการจองนี้?')) return;
    try {
      await api.cancelBooking(id);
      load();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <AdminLayout title="การจอง" subtitle="รายการจองทั้งหมด">
      <div className="admin-card admin-bookings-card">
        <div className="driver-booking-cards">
          {list.map((b) => (
            <article className="driver-booking-card" key={b.booking_id}>
              <div className="driver-booking-card-top">
                <div>
                  <span className="driver-booking-id">#{b.booking_id}</span>
                  <strong>{b.user?.passenger_name || b.user?.user_id}</strong>
                </div>
                <span className={`m-badge ${b.status === 'booked' ? 'm-badge-booked' : 'm-badge-cancelled'}`}>
                  {b.status}
                </span>
              </div>
              <div className="driver-booking-route">
                <span>{b.pickup?.stop_name || '-'}</span>
                <span className="driver-booking-arrow">→</span>
                <span>{b.dropoff?.stop_name || '-'}</span>
              </div>
              <div className="driver-booking-meta">
                <div>
                  <span>เส้นทาง</span>
                  <strong>{b.route?.route_name || '-'}</strong>
                </div>
                <div>
                  <span>เวลาเดินทาง</span>
                  <strong>
                    {b.schedule?.departure_time
                      ? new Date(b.schedule.departure_time).toLocaleString('th-TH')
                      : '-'}
                  </strong>
                </div>
                <div>
                  <span>ที่นั่ง</span>
                  <strong>{b.num_seats}</strong>
                </div>
              </div>
              {b.status === 'booked' && (
                <button className="btn-danger-sm driver-booking-cancel" onClick={() => cancel(b.booking_id)}>
                  ยกเลิกการจอง
                </button>
              )}
            </article>
          ))}
        </div>
        <table className="admin-table driver-booking-table">
          <thead>
            <tr>
              <th>รหัส</th>
              <th>ผู้จอง</th>
              <th>เส้นทาง</th>
              <th>เวลา</th>
              <th>ขึ้น → ลง</th>
              <th>ที่นั่ง</th>
              <th>สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.booking_id}>
                <td>{b.booking_id}</td>
                <td>{b.user?.passenger_name || b.user?.user_id}</td>
                <td>{b.route?.route_name}</td>
                <td>
                  {b.schedule?.departure_time
                    ? new Date(b.schedule.departure_time).toLocaleString('th-TH')
                    : '-'}
                </td>
                <td>
                  {b.pickup?.stop_name} → {b.dropoff?.stop_name}
                </td>
                <td>{b.num_seats}</td>
                <td>
                  <span
                    className={`m-badge ${
                      b.status === 'booked' ? 'm-badge-booked' : 'm-badge-cancelled'
                    }`}
                  >
                    {b.status}
                  </span>
                </td>
                <td>
                  {b.status === 'booked' && (
                    <button className="btn-danger-sm" onClick={() => cancel(b.booking_id)}>
                      ยกเลิก
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <div className="m-empty">ยังไม่มีการจอง</div>}
      </div>
    </AdminLayout>
  );
}

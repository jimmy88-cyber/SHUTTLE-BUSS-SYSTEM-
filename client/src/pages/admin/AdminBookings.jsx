import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import SortableHeader from '../../components/SortableHeader';
import { useSortableRows } from '../../hooks/useSortableRows';

const STATUS_FILTERS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'booked', label: 'จองแล้ว' },
  { value: 'checked_in', label: 'ขึ้นรถแล้ว' },
  { value: 'cancelled', label: 'ยกเลิก' },
];

function bookingStatus(booking) {
  if (booking.status === 'cancelled') return 'cancelled';
  if (booking.status === 'checked_in' || booking.boarded) return 'checked_in';
  return booking.status;
}

function statusLabel(status) {
  if (status === 'booked') return 'จองแล้ว';
  if (status === 'checked_in') return 'ขึ้นรถแล้ว';
  if (status === 'cancelled') return 'ยกเลิก';
  return status || 'ไม่ทราบสถานะ';
}

function statusBadge(status) {
  if (status === 'checked_in') return 'm-badge-checked';
  if (status === 'cancelled') return 'm-badge-cancel';
  return 'm-badge-booked';
}

export default function AdminBookings() {
  const [list, setList] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const { sortedRows, sort, sortBy } = useSortableRows(list);
  const visibleRows = sortedRows.filter(
    (booking) => statusFilter === 'all' || bookingStatus(booking) === statusFilter
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setList(await api.getBookings());
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    api.getBookings()
      .then((bookings) => {
        if (active) setList(bookings);
      })
      .catch((e) => {
        if (active) setLoadError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function cancel(id) {
    if (!confirm('ยกเลิกการจองนี้?')) return;
    try {
      await api.cancelBooking(id);
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <AdminLayout title="การจอง" subtitle="รายการจองทั้งหมด">
      <div className="admin-card admin-bookings-card">
        <div className="m-chip-row" aria-label="กรองตามสถานะการจอง">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={`m-chip${statusFilter === filter.value ? ' active' : ''}`}
              aria-pressed={statusFilter === filter.value}
              onClick={() => setStatusFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
          <button type="button" className="btn btn-outline" onClick={load} disabled={loading}>
            {loading ? 'กำลังตรวจสอบ...' : 'ตรวจสอบสถานะล่าสุด'}
          </button>
        </div>
        {loadError && (
          <div role="alert" className="m-empty">
            โหลดสถานะการจองไม่สำเร็จ: {loadError}
            <button type="button" className="btn btn-outline" onClick={load}>ลองอีกครั้ง</button>
          </div>
        )}
        <div className="driver-booking-cards">
          {visibleRows.map((b) => {
            const status = bookingStatus(b);
            return (
            <article className="driver-booking-card" key={b.booking_id}>
              <div className="driver-booking-card-top">
                <div>
                  <span className="driver-booking-id">#{b.booking_id}</span>
                  <strong>{b.user?.passenger_name || b.user?.user_id}</strong>
                </div>
                <span className={`m-badge ${statusBadge(status)}`}>
                  {statusLabel(status)}
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
                      ? new Date(b.schedule.departure_time).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Asia/Bangkok',
                        }).replace(',', '')
                      : '-'}
                  </strong>
                </div>
                <div>
                  <span>ที่นั่ง</span>
                  <strong>{b.num_seats}</strong>
                </div>
              </div>
              {status === 'booked' && (
                <button className="btn-danger-sm driver-booking-cancel" onClick={() => cancel(b.booking_id)}>
                  ยกเลิกการจอง
                </button>
              )}
            </article>
            );
          })}
        </div>
        <table className="admin-table driver-booking-table">
          <thead>
            <tr>
              <th><SortableHeader label="รหัส" sortKey="booking_id" sort={sort} onSort={sortBy} /></th>
              <th>ผู้จอง</th>
              <th>เส้นทาง</th>
              <th><SortableHeader label="เวลา" sortKey="schedule.departure_time" sort={sort} onSort={sortBy} /></th>
              <th>ขึ้น → ลง</th>
              <th>ที่นั่ง</th>
              <th>สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((b) => {
              const status = bookingStatus(b);
              return (
              <tr key={b.booking_id}>
                <td>{b.booking_id}</td>
                <td>{b.user?.passenger_name || b.user?.user_id}</td>
                <td>{b.route?.route_name}</td>
                <td>
                  {b.schedule?.departure_time
                    ? new Date(b.schedule.departure_time).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Asia/Bangkok',
                      }).replace(',', '')
                    : '-'}
                </td>
                <td>
                  {b.pickup?.stop_name} → {b.dropoff?.stop_name}
                </td>
                <td>{b.num_seats}</td>
                <td>
                  <span className={`m-badge ${statusBadge(status)}`}>
                    {statusLabel(status)}
                  </span>
                </td>
                <td>
                  {status === 'booked' && (
                    <button className="btn-danger-sm" onClick={() => cancel(b.booking_id)}>
                      ยกเลิก
                    </button>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        {!loadError && visibleRows.length === 0 && (
          <div className="m-empty">
            {loading ? 'กำลังโหลดการจอง...' : list.length === 0 ? 'ยังไม่มีการจอง' : 'ไม่พบรายการจองในสถานะนี้'}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

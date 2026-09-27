import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';

export default function AdminTrips() {
  const [list, setList] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState({
    schedule_id: '',
    departure_time: '',
    driver_id: '',
    vehicle_id: '',
    route_id: '',
  });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  function load() {
    api.getSchedules().then(setList).catch(console.error);
    api.getRoutes().then(setRoutes).catch(console.error);
    api.getVehicles().then(setVehicles).catch(console.error);
    api.getUsers().then((u) => setDrivers(u.filter((x) => x.position?.position_id === '03'))).catch(console.error);
  }
  useEffect(load, []);

  async function add(e) {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      // convert datetime-local to ISO-ish string
      const dt = form.departure_time ? form.departure_time.replace('T', ' ') + ':00' : '';
      await api.createSchedule({
        ...form,
        departure_time: dt,
        driver_id: Number(form.driver_id),
      });
      setMsg('เพิ่มรอบรถสำเร็จ');
      setForm({ schedule_id: '', departure_time: '', driver_id: '', vehicle_id: '', route_id: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AdminLayout title="รอบการเดินรถ" subtitle="กำหนดรอบและคนขับ">
      {error && <div className="error-msg">{error}</div>}
      {msg && <div className="success-msg">{msg}</div>}

      <div className="admin-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12 }}>เพิ่มรอบรถ</h3>
        <form onSubmit={add} className="admin-form-grid">
          <input
            className="form-control"
            placeholder="รหัสรอบ เช่น 0009"
            value={form.schedule_id}
            onChange={(e) => setForm({ ...form, schedule_id: e.target.value })}
            required
          />
          <input
            type="datetime-local"
            className="form-control"
            value={form.departure_time}
            onChange={(e) => setForm({ ...form, departure_time: e.target.value })}
            required
          />
          <select
            className="form-control"
            value={form.route_id}
            onChange={(e) => setForm({ ...form, route_id: e.target.value })}
            required
          >
            <option value="">-- เส้นทาง --</option>
            {routes.map((r) => (
              <option key={r.route_id} value={r.route_id}>
                {r.name}
              </option>
            ))}
          </select>
          <select
            className="form-control"
            value={form.vehicle_id}
            onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
            required
          >
            <option value="">-- รถ --</option>
            {vehicles.map((v) => (
              <option key={v.vehicle_id} value={v.vehicle_id}>
                {v.plate_number}
              </option>
            ))}
          </select>
          <select
            className="form-control"
            value={form.driver_id}
            onChange={(e) => setForm({ ...form, driver_id: e.target.value })}
            required
          >
            <option value="">-- คนขับ --</option>
            {drivers.map((d) => (
              <option key={d.user_id} value={d.user_id}>
                {d.first_name} {d.last_name}
              </option>
            ))}
          </select>
          <button type="submit" className="m-btn m-btn-primary" style={{ width: 'auto' }}>
            เพิ่มรอบ
          </button>
        </form>
      </div>

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>รหัส</th>
              <th>เวลา</th>
              <th>เส้นทาง</th>
              <th>รถ</th>
              <th>คนขับ</th>
              <th>ที่นั่ง</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.schedule_id}>
                <td>{s.schedule_id}</td>
                <td>
                  {s.departure_time
                    ? new Date(s.departure_time).toLocaleString('th-TH')
                    : '-'}
                </td>
                <td>{s.route?.route_name}</td>
                <td>{s.vehicle?.plate_number}</td>
                <td>{s.driver?.driver_name}</td>
                <td>
                  {s.seats_booked}/{s.vehicle?.capacity}
                </td>
                <td>
                  <span className="m-badge m-badge-planned">{s.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

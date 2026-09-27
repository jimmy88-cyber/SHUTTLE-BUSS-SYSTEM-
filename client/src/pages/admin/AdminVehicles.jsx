import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';

export default function AdminVehicles() {
  const [list, setList] = useState([]);
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState({ vehicle_id: '', plate_number: '', vehicle_type_id: '' });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  function load() {
    api.getVehicles().then(setList).catch(console.error);
    api.getVehicleTypes().then(setTypes).catch(console.error);
  }
  useEffect(load, []);

  async function add(e) {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      await api.createVehicle(form);
      setMsg('เพิ่มรถสำเร็จ');
      setForm({ vehicle_id: '', plate_number: '', vehicle_type_id: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!confirm('ลบรถคันนี้?')) return;
    try {
      await api.deleteVehicle(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <AdminLayout title="จัดการรถ" subtitle="ประเภทรถและทะเบียน">
      {error && <div className="error-msg">{error}</div>}
      {msg && <div className="success-msg">{msg}</div>}

      <div className="admin-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12 }}>เพิ่มรถ</h3>
        <form onSubmit={add} className="admin-form-row">
          <input
            className="form-control"
            placeholder="รหัสรถ เช่น 04"
            value={form.vehicle_id}
            onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
            required
          />
          <input
            className="form-control"
            placeholder="ทะเบียน"
            value={form.plate_number}
            onChange={(e) => setForm({ ...form, plate_number: e.target.value })}
            required
          />
          <select
            className="form-control"
            value={form.vehicle_type_id}
            onChange={(e) => setForm({ ...form, vehicle_type_id: e.target.value })}
            required
          >
            <option value="">-- ประเภท --</option>
            {types.map((t) => (
              <option key={t.vehicle_type_id} value={t.vehicle_type_id}>
                {t.name} ({t.capacity} ที่)
              </option>
            ))}
          </select>
          <button type="submit" className="m-btn m-btn-primary" style={{ width: 'auto' }}>
            เพิ่ม
          </button>
        </form>
      </div>

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>รหัส</th>
              <th>ทะเบียน</th>
              <th>ประเภท</th>
              <th>ความจุ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((v) => (
              <tr key={v.vehicle_id}>
                <td>{v.vehicle_id}</td>
                <td>{v.plate_number}</td>
                <td>{v.vehicle_type?.type_name}</td>
                <td>{v.vehicle_type?.capacity}</td>
                <td>
                  <button className="btn-danger-sm" onClick={() => remove(v.vehicle_id)}>
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

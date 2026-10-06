import { useEffect, useState } from "react";
import { api } from "../../api/client";
import AdminLayout from "../../components/AdminLayout";
import SortableHeader from "../../components/SortableHeader";
import { useSortableRows } from "../../hooks/useSortableRows";

const STATUS_OPTS = [
  { value: "planned", label: "รอออก (planned)" },
  { value: "in_progress", label: "กำลังวิ่ง (in_progress)" },
  { value: "completed", label: "เสร็จแล้ว (completed)" },
  { value: "cancelled", label: "ยกเลิก (cancelled)" },
];

function statusBadge(status) {
  const map = {
    planned: "badge badge-planned",
    in_progress: "badge badge-completed",
    completed: "badge badge-checked_in",
    cancelled: "badge badge-cancelled",
  };
  return <span className={map[status] || "badge"}>{status}</span>;
}

function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function vehicleLabel(v) {
  const type = v.vehicle_type?.type_name || "";
  const cap = v.vehicle_type?.capacity;
  const st =
    v.status === "available"
      ? "ว่าง"
      : v.status === "in_use"
        ? "กำลังใช้"
        : v.status === "inactive"
          ? "ไม่ใช้"
          : v.status || "";
  return `${v.plate_number}${type ? ` · ${type}` : ""}${cap ? ` (${cap} ที่)` : ""}${st ? ` · ${st}` : ""}`;
}

const empty = {
  schedule_id: "",
  departure_time: "",
  driver_id: "",
  vehicle_id: "",
  route_id: "",
  status: "planned",
};

export default function AdminTrips() {
  const [list, setList] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [modal, setModal] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const { sortedRows, sort, sortBy } = useSortableRows(list);

  function load() {
    api.getSchedules().then(setList).catch(console.error);
    api.getRoutes().then(setRoutes).catch(console.error);
    api.getVehicles().then(setVehicles).catch(console.error);
    api
      .getUsers()
      .then((u) => setDrivers(u.filter((x) => x.position?.position_id === "03")))
      .catch(console.error);
  }
  useEffect(load, []);

  function openAdd() {
    setEditId(null);
    setForm(empty);
    setError("");
    setModal(true);
  }

  function openEdit(s) {
    setEditId(s.schedule_id);
    setForm({
      schedule_id: s.schedule_id,
      departure_time: toLocalInput(s.departure_time),
      driver_id: String(s.driver?.driver_id || ""),
      vehicle_id: s.vehicle?.vehicle_id || "",
      route_id: s.route?.route_id || "",
      status: s.status || "planned",
    });
    setError("");
    setModal(true);
  }

  async function save(e) {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      const dt = form.departure_time ? form.departure_time.replace("T", " ") + ":00" : "";
      const body = {
        departure_time: dt,
        driver_id: Number(form.driver_id),
        vehicle_id: form.vehicle_id,
        route_id: form.route_id,
        status: form.status,
      };
      if (editId) {
        await api.updateSchedule(editId, body);
        setMsg("แก้ไขรอบรถสำเร็จ");
      } else {
        await api.createSchedule({ ...body, schedule_id: form.schedule_id });
        setMsg("เพิ่มรอบรถสำเร็จ");
      }
      setModal(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!confirm("ลบรอบนี้? (การจองที่ผูกกับรอบอาจถูกลบด้วย)")) return;
    try {
      await api.deleteSchedule(id);
      setMsg("ลบรอบรถสำเร็จ");
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <AdminLayout title="รอบการเดินรถ" subtitle="กำหนดรอบและคนขับ">
      {error && !modal && <div className="error-msg">{error}</div>}
      {msg && <div className="success-msg">{msg}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h2 className="card-title">รายการรอบรถ</h2>
          <button type="button" className="btn btn-primary btn-sm" onClick={openAdd}>
            + เพิ่มรอบ
          </button>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th><SortableHeader label="รหัส" sortKey="schedule_id" sort={sort} onSort={sortBy} /></th>
                <th><SortableHeader label="เวลา" sortKey="departure_time" sort={sort} onSort={sortBy} /></th>
                <th>เส้นทาง</th>
                <th>รถ</th>
                <th>คนขับ</th>
                <th>ที่นั่ง</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((s) => (
                <tr key={s.schedule_id}>
                  <td>{s.schedule_id}</td>
                  <td>
                    {s.departure_time
                      ? new Date(s.departure_time).toLocaleString("th-TH")
                      : "-"}
                  </td>
                  <td>{s.route?.route_name}</td>
                  <td>
                    {s.vehicle?.plate_number}
                    {s.vehicle?.capacity ? ` (${s.vehicle.capacity})` : ""}
                  </td>
                  <td>{s.driver?.driver_name}</td>
                  <td>
                    {s.seats_booked}/{s.vehicle?.capacity}
                  </td>
                  <td>{statusBadge(s.status)}</td>
                  <td>
                    <div className="actions">
                      <button type="button" className="btn-edit-sm" onClick={() => openEdit(s)}>
                        แก้ไข
                      </button>
                      <button type="button" className="btn-danger-sm" onClick={() => remove(s.schedule_id)}>
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2>{editId ? "แก้ไขรอบรถ" : "เพิ่มรอบรถ"}</h2>
              <button type="button" className="close-btn" onClick={() => setModal(false)}>
                ×
              </button>
            </div>
            {error && <div className="error-msg">{error}</div>}
            <form onSubmit={save}>
              {!editId && (
                <div className="form-group">
                  <label className="form-label">รหัสรอบ *</label>
                  <input
                    className="form-control"
                    value={form.schedule_id}
                    onChange={(e) => setForm({ ...form, schedule_id: e.target.value })}
                    placeholder="เช่น 0009"
                    required
                  />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">วันเวลาออก *</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={form.departure_time}
                  onChange={(e) => setForm({ ...form, departure_time: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">เส้นทาง *</label>
                <select
                  className="form-control"
                  value={form.route_id}
                  onChange={(e) => setForm({ ...form, route_id: e.target.value })}
                  required
                >
                  <option value="">-- เส้นทาง --</option>
                  {routes.map((r) => (
                    <option key={r.route_id} value={r.route_id}>
                      {r.route_name || r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">รถ *</label>
                <select
                  className="form-control"
                  value={form.vehicle_id}
                  onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
                  required
                >
                  <option value="">-- รถ --</option>
                  {vehicles.map((v) => (
                    <option key={v.vehicle_id} value={v.vehicle_id}>
                      {vehicleLabel(v)}
                    </option>
                  ))}
                </select>
                {form.vehicle_id && (
                  <p style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 6 }}>
                    เลือกแล้ว: {vehicleLabel(vehicles.find((v) => v.vehicle_id === form.vehicle_id) || {})}
                  </p>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">คนขับ *</label>
                <select
                  className="form-control"
                  value={form.driver_id}
                  onChange={(e) => setForm({ ...form, driver_id: e.target.value })}
                  required
                >
                  <option value="">-- คนขับ --</option>
                  {drivers.map((d) => (
                    <option key={d.user_id} value={d.user_id}>
                      {d.first_name} {d.last_name} ({d.username})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">สถานะ *</label>
                <select
                  className="form-control"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {STATUS_OPTS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setModal(false)}>
                  ยกเลิก
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1.4 }}>
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

import { useEffect, useState } from "react";
import { api } from "../../api/client";
import AdminLayout from "../../components/AdminLayout";
import SortableHeader from "../../components/SortableHeader";
import { useSortableRows } from "../../hooks/useSortableRows";

const STATUS_OPTS = [
  { value: "available", label: "ว่าง / พร้อมใช้" },
  { value: "in_use", label: "กำลังใช้งาน" },
  { value: "inactive", label: "ไม่ใช้งาน" },
];

function statusBadge(status) {
  const s = status || "available";
  if (s === "available") return <span className="badge" style={{ background: "#dcfce7", color: "#15803d" }}>ว่าง / พร้อมใช้</span>;
  if (s === "in_use" || s === "maintenance") return <span className="badge" style={{ background: "#fef3c7", color: "#b45309" }}>กำลังใช้งาน</span>;
  return <span className="badge" style={{ background: "#f1f5f9", color: "#64748b" }}>ไม่ใช้งาน</span>;
}

const emptyType = { vehicle_type_id: "", name: "", capacity: "" };
const emptyVeh = { vehicle_id: "", plate_number: "", vehicle_type_id: "", status: "available" };

/** หาเลขสูงสุดจากรหัสที่มีอยู่ แล้ว +1 (pad ตามความยาวเดิม อย่างน้อย 2 หลัก) */
function nextCode(items, key, minPad = 2) {
  let max = 0;
  let pad = minPad;
  for (const item of items) {
    const raw = String(item[key] || "");
    const n = parseInt(raw.replace(/\D/g, ""), 10);
    if (!Number.isNaN(n) && n > max) max = n;
    if (/^\d+$/.test(raw) && raw.length > pad) pad = raw.length;
  }
  return String(max + 1).padStart(pad, "0");
}

export default function AdminVehicles() {
  const [types, setTypes] = useState([]);
  const [list, setList] = useState([]);
  const { sortedRows: sortedTypes, sort: typeSort, sortBy: sortTypesBy } = useSortableRows(types);
  const { sortedRows: sortedVehicles, sort: vehicleSort, sortBy: sortVehiclesBy } = useSortableRows(list);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [typeModal, setTypeModal] = useState(false);
  const [typeForm, setTypeForm] = useState(emptyType);
  const [typeEditId, setTypeEditId] = useState(null);

  const [vehModal, setVehModal] = useState(false);
  const [vehForm, setVehForm] = useState(emptyVeh);
  const [vehEditId, setVehEditId] = useState(null);

  function load() {
    api.getVehicleTypes().then(setTypes).catch(console.error);
    api.getVehicles().then(setList).catch(console.error);
  }
  useEffect(load, []);

  function openTypeAdd() {
    setTypeEditId(null);
    setTypeForm({ ...emptyType, vehicle_type_id: nextCode(types, "vehicle_type_id", 2) });
    setTypeModal(true);
  }
  function openTypeEdit(t) {
    setTypeEditId(t.vehicle_type_id);
    setTypeForm({ vehicle_type_id: t.vehicle_type_id, name: t.name, capacity: t.capacity });
    setTypeModal(true);
  }
  async function saveType(e) {
    e.preventDefault();
    setError("");
    try {
      if (typeEditId) {
        await api.updateVehicleType(typeEditId, { name: typeForm.name, capacity: typeForm.capacity });
      } else {
        await api.createVehicleType(typeForm);
      }
      setTypeModal(false);
      setMsg("บันทึกประเภทรถสำเร็จ");
      load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function removeType(id) {
    if (!confirm("ลบประเภทรถนี้?")) return;
    try {
      await api.deleteVehicleType(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  function openVehAdd() {
    setVehEditId(null);
    setVehForm({ ...emptyVeh, vehicle_id: nextCode(list, "vehicle_id", 2) });
    setVehModal(true);
  }
  function openVehEdit(v) {
    setVehEditId(v.vehicle_id);
    setVehForm({
      vehicle_id: v.vehicle_id,
      plate_number: v.plate_number,
      vehicle_type_id: v.vehicle_type?.vehicle_type_id || "",
      status: v.status === "maintenance" ? "in_use" : v.status === "retired" ? "inactive" : v.status || "available",
    });
    setVehModal(true);
  }
  async function saveVeh(e) {
    e.preventDefault();
    setError("");
    try {
      if (vehEditId) {
        await api.updateVehicle(vehEditId, {
          plate_number: vehForm.plate_number,
          vehicle_type_id: vehForm.vehicle_type_id,
          status: vehForm.status,
        });
      } else {
        await api.createVehicle(vehForm);
      }
      setVehModal(false);
      setMsg("บันทึกรถสำเร็จ");
      load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function removeVeh(id) {
    if (!confirm("ลบรถคันนี้?")) return;
    try {
      await api.deleteVehicle(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <AdminLayout title="จัดการรถและประเภทรถ">
      {error && <div className="error-msg">{error}</div>}
      {msg && <div className="success-msg">{msg}</div>}

      {/* ประเภทรถ */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h2 className="card-title">ประเภทรถ</h2>
          <button type="button" className="btn btn-primary btn-sm" onClick={openTypeAdd}>
            + เพิ่มประเภท
          </button>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th><SortableHeader label="รหัส" sortKey="vehicle_type_id" sort={typeSort} onSort={sortTypesBy} /></th>
                <th>ชื่อ</th>
                <th>ที่นั่ง</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {sortedTypes.map((t) => (
                <tr key={t.vehicle_type_id}>
                  <td>{t.vehicle_type_id}</td>
                  <td>{t.name}</td>
                  <td>{t.capacity}</td>
                  <td>
                    <div className="actions">
                      <button type="button" className="btn-edit-sm" onClick={() => openTypeEdit(t)}>แก้ไข</button>
                      <button type="button" className="btn-danger-sm" onClick={() => removeType(t.vehicle_type_id)}>ลบ</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* รถ */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">รถ</h2>
          <button type="button" className="btn btn-primary btn-sm" onClick={openVehAdd}>
            + เพิ่มรถ
          </button>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th><SortableHeader label="รหัส" sortKey="vehicle_id" sort={vehicleSort} onSort={sortVehiclesBy} /></th>
                <th>ทะเบียน</th>
                <th>ประเภท</th>
                <th>ที่นั่ง</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {sortedVehicles.map((v) => (
                <tr key={v.vehicle_id}>
                  <td>{v.vehicle_id}</td>
                  <td>{v.plate_number}</td>
                  <td>{v.vehicle_type?.type_name}</td>
                  <td>{v.vehicle_type?.capacity}</td>
                  <td>{statusBadge(v.status)}</td>
                  <td>
                    <div className="actions">
                      <button type="button" className="btn-edit-sm" onClick={() => openVehEdit(v)}>แก้ไข</button>
                      <button type="button" className="btn-danger-sm" onClick={() => removeVeh(v.vehicle_id)}>ลบ</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal ประเภท */}
      {typeModal && (
        <div className="modal-overlay" onClick={() => setTypeModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{typeEditId ? "แก้ไขประเภทรถ" : "เพิ่มประเภทรถ"}</h2>
              <button type="button" className="close-btn" onClick={() => setTypeModal(false)}>×</button>
            </div>
            <form onSubmit={saveType}>
              {!typeEditId && (
                <div className="form-group">
                  <label className="form-label">รหัส *</label>
                  <input className="form-control" value={typeForm.vehicle_type_id} onChange={(e) => setTypeForm({ ...typeForm, vehicle_type_id: e.target.value })} required maxLength={10} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">ชื่อประเภท *</label>
                <input className="form-control" value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">จำนวนที่นั่ง *</label>
                <input type="number" className="form-control" min={1} value={typeForm.capacity} onChange={(e) => setTypeForm({ ...typeForm, capacity: e.target.value })} required />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
                <button type="button" className="btn btn-outline" onClick={() => setTypeModal(false)}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary">บันทึก</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal รถ */}
      {vehModal && (
        <div className="modal-overlay" onClick={() => setVehModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{vehEditId ? "แก้ไขรถ" : "เพิ่มรถ"}</h2>
              <button type="button" className="close-btn" onClick={() => setVehModal(false)}>×</button>
            </div>
            <form onSubmit={saveVeh}>
              {!vehEditId && (
                <div className="form-group">
                  <label className="form-label">รหัสรถ *</label>
                  <input className="form-control" value={vehForm.vehicle_id} onChange={(e) => setVehForm({ ...vehForm, vehicle_id: e.target.value })} required />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">ทะเบียน *</label>
                <input className="form-control" value={vehForm.plate_number} onChange={(e) => setVehForm({ ...vehForm, plate_number: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">ประเภท *</label>
                <select className="form-control" value={vehForm.vehicle_type_id} onChange={(e) => setVehForm({ ...vehForm, vehicle_type_id: e.target.value })} required>
                  <option value="">-- เลือกประเภท --</option>
                  {types.map((t) => (
                    <option key={t.vehicle_type_id} value={t.vehicle_type_id}>{t.name} ({t.capacity} ที่)</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">สถานะ *</label>
                <select className="form-control" value={vehForm.status} onChange={(e) => setVehForm({ ...vehForm, status: e.target.value })}>
                  {STATUS_OPTS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
                <button type="button" className="btn btn-outline" onClick={() => setVehModal(false)}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary">บันทึก</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

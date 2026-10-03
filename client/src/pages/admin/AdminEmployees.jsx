import { useEffect, useState } from "react";
import { api } from "../../api/client";
import AdminLayout from "../../components/AdminLayout";

const RIGHT_LABELS = [
  "แดชบอร์ด",
  "จัดการรถ",
  "เส้นทาง",
  "รอบรถ",
  "จอง+ผู้ใช้",
  "พนักงาน+ขึ้นรถ",
];

function permissionScreens(perm) {
  const p = String(perm || "000000").padEnd(6, "0").slice(0, 6);
  const names = [];
  for (let i = 0; i < 6; i++) {
    if (p[i] === "1") names.push(RIGHT_LABELS[i]);
  }
  return names.length ? names.join(", ") : "-";
}

function PermissionBits({ value, onChange }) {
  const bits = String(value || "000000").padEnd(6, "0").slice(0, 6).split("");
  function toggle(i) {
    const next = [...bits];
    next[i] = next[i] === "1" ? "0" : "1";
    onChange(next.join(""));
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {RIGHT_LABELS.map((label, i) => (
        <label
          key={label}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            background: bits[i] === "1" ? "#f0fdfa" : "#fff",
            fontSize: "0.85rem",
            cursor: "pointer",
          }}
        >
          <input type="checkbox" checked={bits[i] === "1"} onChange={() => toggle(i)} />
          {i + 1}. {label}
        </label>
      ))}
    </div>
  );
}

export default function AdminEmployees() {
  const [positions, setPositions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  // modals
  const [posModal, setPosModal] = useState(false);
  const [posForm, setPosForm] = useState({ position_id: "", name: "", permission: "000000" });
  const [posEditId, setPosEditId] = useState(null);

  const [deptModal, setDeptModal] = useState(false);
  const [deptForm, setDeptForm] = useState({ department_id: "", name: "" });
  const [deptEditId, setDeptEditId] = useState(null);

  const [empModal, setEmpModal] = useState(false);
  const [empForm, setEmpForm] = useState({
    user_id: null,
    username: "",
    first_name: "",
    last_name: "",
    department_id: "",
    position_id: "",
    password: "",
  });
  const [empEditId, setEmpEditId] = useState(null);

  function load() {
    api.getPositions().then(setPositions).catch(console.error);
    api.getDepartments().then(setDepartments).catch(console.error);
    api.getUsers().then((all) => {
      const staff = all.filter((u) => u.position?.position_id || u.user_type === "employee");
      setEmployees(staff.length ? staff : all.filter((u) => u.user_type !== "passenger"));
    }).catch(console.error);
  }
  useEffect(load, []);

  // ---- Position ----
  function openPosAdd() {
    setPosEditId(null);
    setPosForm({ position_id: "", name: "", permission: "000000" });
    setPosModal(true);
  }
  function openPosEdit(p) {
    setPosEditId(p.position_id);
    setPosForm({ position_id: p.position_id, name: p.name, permission: p.permission || "000000" });
    setPosModal(true);
  }
  async function savePos(e) {
    e.preventDefault();
    setError("");
    try {
      if (posEditId) {
        await api.updatePosition(posEditId, { name: posForm.name, permission: posForm.permission });
      } else {
        await api.createPosition(posForm);
      }
      setPosModal(false);
      setMsg("บันทึกตำแหน่งสำเร็จ");
      load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function removePos(id) {
    if (!confirm("ลบตำแหน่งนี้?")) return;
    try {
      await api.deletePosition(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  // ---- Department ----
  function openDeptAdd() {
    setDeptEditId(null);
    setDeptForm({ department_id: "", name: "" });
    setDeptModal(true);
  }
  function openDeptEdit(d) {
    setDeptEditId(d.department_id);
    setDeptForm({ department_id: d.department_id, name: d.name });
    setDeptModal(true);
  }
  async function saveDept(e) {
    e.preventDefault();
    setError("");
    try {
      if (deptEditId) {
        await api.updateDepartment(deptEditId, { name: deptForm.name });
      } else {
        await api.createDepartment(deptForm);
      }
      setDeptModal(false);
      setMsg("บันทึกแผนกสำเร็จ");
      load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function removeDept(id) {
    if (!confirm("ลบแผนกนี้?")) return;
    try {
      await api.deleteDepartment(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  // ---- Employee ----
  function openEmpAdd() {
    setEmpEditId(null);
    setEmpForm({
      user_id: null,
      username: "",
      first_name: "",
      last_name: "",
      department_id: "",
      position_id: "",
      password: "1234",
    });
    setEmpModal(true);
  }
  function openEmpEdit(u) {
    setEmpEditId(u.user_id);
    setEmpForm({
      user_id: u.user_id,
      username: u.username,
      first_name: u.first_name,
      last_name: u.last_name,
      department_id: u.department?.department_id || "",
      position_id: u.position?.position_id || "",
      password: "",
    });
    setEmpModal(true);
  }
  async function saveEmp(e) {
    e.preventDefault();
    setError("");
    try {
      if (empEditId) {
        await api.updateEmployee(empEditId, {
          first_name: empForm.first_name,
          last_name: empForm.last_name,
          department_id: empForm.department_id || null,
          position_id: empForm.position_id,
          password: empForm.password || undefined,
        });
      } else {
        await api.createEmployee(empForm);
      }
      setEmpModal(false);
      setMsg("บันทึกพนักงานสำเร็จ");
      load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function removeEmp(id) {
    if (!confirm("ลบพนักงานคนนี้?")) return;
    try {
      await api.deleteEmployee(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <AdminLayout title="จัดการพนักงาน & สิทธิ์" subtitle="Master.1 จัดการพนักงาน + Master.2 กำหนดสิทธิ์แบบ Dynamic">
      {error && <div className="error-msg">{error}</div>}
      {msg && <div className="success-msg">{msg}</div>}

      {/* ตำแหน่ง */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h2 className="card-title">ตำแหน่ง & สิทธิ์การเข้าถึงหน้าจอ (Dynamic)</h2>
          <button type="button" className="btn btn-primary btn-sm" onClick={openPosAdd}>+ เพิ่มตำแหน่ง</button>
        </div>
        <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: 12 }}>
          สิทธิ์ 6 หลัก · ติ๊ก = 1 (เข้าถึงได้) · ไม่ติ๊ก = 0 · แก้ไขได้ตลอดเวลาไม่ fix
        </p>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ชื่อตำแหน่ง</th>
                <th>รหัสสิทธิ์</th>
                <th>หน้าจอที่เข้าถึง</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.position_id}>
                  <td>{p.position_id}</td>
                  <td>{p.name}</td>
                  <td>
                    <code style={{ background: "#f1f5f9", padding: "2px 8px", borderRadius: 6 }}>
                      {p.permission || "000000"}
                    </code>
                  </td>
                  <td style={{ fontSize: "0.85rem", color: "#475569" }}>{permissionScreens(p.permission)}</td>
                  <td>
                    <div className="actions">
                      <button type="button" className="btn-edit-sm" onClick={() => openPosEdit(p)}>แก้ไขสิทธิ์</button>
                      <button type="button" className="btn-danger-sm" onClick={() => removePos(p.position_id)}>ลบ</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 10 }}>
          ● 1=แดชบอร์ด · 2=จัดการรถ · 3=เส้นทาง · 4=รอบรถ · 5=จอง+ผู้ใช้ · 6=พนักงาน+ขึ้นรถ
        </p>
      </div>

      {/* แผนก */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h2 className="card-title">แผนก</h2>
          <button type="button" className="btn btn-primary btn-sm" onClick={openDeptAdd}>+ เพิ่มแผนก</button>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ชื่อแผนก</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.department_id}>
                  <td>{d.department_id}</td>
                  <td>{d.name}</td>
                  <td>
                    <div className="actions">
                      <button type="button" className="btn-edit-sm" onClick={() => openDeptEdit(d)}>แก้ไข</button>
                      <button type="button" className="btn-danger-sm" onClick={() => removeDept(d.department_id)}>ลบ</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* พนักงาน */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">พนักงาน</h2>
          <button type="button" className="btn btn-primary btn-sm" onClick={openEmpAdd}>+ เพิ่มพนักงาน</button>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ชื่อ-นามสกุล</th>
                <th>แผนก</th>
                <th>ตำแหน่ง</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((u) => (
                <tr key={u.user_id}>
                  <td>{u.username}</td>
                  <td>
                    {u.first_name} {u.last_name}
                  </td>
                  <td>{u.department?.department_name || "-"}</td>
                  <td>{u.position?.position_name || "-"}</td>
                  <td>
                    <div className="actions">
                      <button type="button" className="btn-edit-sm" onClick={() => openEmpEdit(u)}>แก้ไข</button>
                      <button type="button" className="btn-danger-sm" onClick={() => removeEmp(u.user_id)}>ลบ</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal ตำแหน่ง */}
      {posModal && (
        <div className="modal-overlay" onClick={() => setPosModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h2>{posEditId ? "แก้ไขสิทธิ์ตำแหน่ง" : "เพิ่มตำแหน่ง"}</h2>
              <button type="button" className="close-btn" onClick={() => setPosModal(false)}>×</button>
            </div>
            <form onSubmit={savePos}>
              {!posEditId && (
                <div className="form-group">
                  <label className="form-label">รหัสตำแหน่ง *</label>
                  <input className="form-control" value={posForm.position_id} onChange={(e) => setPosForm({ ...posForm, position_id: e.target.value })} required />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">ชื่อตำแหน่ง *</label>
                <input className="form-control" value={posForm.name} onChange={(e) => setPosForm({ ...posForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">สิทธิ์เข้าถึงหน้าจอ</label>
                <PermissionBits value={posForm.permission} onChange={(permission) => setPosForm({ ...posForm, permission })} />
                <p style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 8 }}>
                  รหัสสิทธิ์: <code>{posForm.permission}</code>
                </p>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
                <button type="button" className="btn btn-outline" onClick={() => setPosModal(false)}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary" style={{ minWidth: 120 }}>บันทึก</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal แผนก */}
      {deptModal && (
        <div className="modal-overlay" onClick={() => setDeptModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{deptEditId ? "แก้ไขแผนก" : "เพิ่มแผนก"}</h2>
              <button type="button" className="close-btn" onClick={() => setDeptModal(false)}>×</button>
            </div>
            <form onSubmit={saveDept}>
              {!deptEditId && (
                <div className="form-group">
                  <label className="form-label">รหัสแผนก *</label>
                  <input className="form-control" value={deptForm.department_id} onChange={(e) => setDeptForm({ ...deptForm, department_id: e.target.value })} required />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">ชื่อแผนก *</label>
                <input className="form-control" value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} required />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
                <button type="button" className="btn btn-outline" onClick={() => setDeptModal(false)}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary" style={{ minWidth: 120 }}>บันทึก</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal พนักงาน — ตามรูป */}
      {empModal && (
        <div className="modal-overlay" onClick={() => setEmpModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2>{empEditId ? "แก้ไขพนักงาน" : "เพิ่มพนักงาน"}</h2>
              <button type="button" className="close-btn" onClick={() => setEmpModal(false)}>×</button>
            </div>
            <form onSubmit={saveEmp}>
              <div className="form-group">
                <label className="form-label">รหัสพนักงาน *</label>
                <input
                  className="form-control"
                  value={empForm.username}
                  onChange={(e) => setEmpForm({ ...empForm, username: e.target.value })}
                  required
                  disabled={!!empEditId}
                  placeholder="EMP001"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">ชื่อ *</label>
                  <input className="form-control" value={empForm.first_name} onChange={(e) => setEmpForm({ ...empForm, first_name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">นามสกุล *</label>
                  <input className="form-control" value={empForm.last_name} onChange={(e) => setEmpForm({ ...empForm, last_name: e.target.value })} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">แผนก *</label>
                <select
                  className="form-control"
                  value={empForm.department_id}
                  onChange={(e) => setEmpForm({ ...empForm, department_id: e.target.value })}
                  required
                >
                  <option value="">-- เลือกแผนก --</option>
                  {departments.map((d) => (
                    <option key={d.department_id} value={d.department_id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">ตำแหน่ง *</label>
                <select
                  className="form-control"
                  value={empForm.position_id}
                  onChange={(e) => setEmpForm({ ...empForm, position_id: e.target.value })}
                  required
                >
                  <option value="">-- เลือกตำแหน่ง --</option>
                  {positions.map((p) => (
                    <option key={p.position_id} value={p.position_id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">รหัสผ่าน {empEditId ? "(ว่างไว้ถ้าไม่เปลี่ยน)" : "*"}</label>
                <input
                  type="text"
                  className="form-control"
                  value={empForm.password}
                  onChange={(e) => setEmpForm({ ...empForm, password: e.target.value })}
                  required={!empEditId}
                  placeholder={empEditId ? "ไม่เปลี่ยนถ้าว่าง" : "1234"}
                />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setEmpModal(false)}>
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

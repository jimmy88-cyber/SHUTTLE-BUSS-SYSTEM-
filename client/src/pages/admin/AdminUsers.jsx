import { useEffect, useState } from "react";
import { api } from "../../api/client";
import AdminLayout from "../../components/AdminLayout";

const empty = {
  username: "",
  password: "",
  first_name: "",
  last_name: "",
  email: "",
};

export default function AdminUsers() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [modal, setModal] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  function load() {
    api
      .getUsers({ user_type: "passenger" })
      .then(setList)
      .catch(() =>
        api.getUsers().then((all) => setList(all.filter((u) => u.user_type === "passenger" || !u.position?.position_id)))
      );
  }
  useEffect(load, []);

  function openAdd() {
    setEditId(null);
    setForm(empty);
    setError("");
    setModal(true);
  }

  function openEdit(u) {
    setEditId(u.user_id);
    setForm({
      username: u.username,
      password: "",
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email || "",
    });
    setError("");
    setModal(true);
  }

  async function save(e) {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      if (editId) {
        await api.updateUser(editId, {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email || null,
          password: form.password || undefined,
        });
        setMsg("แก้ไขผู้ใช้บริการสำเร็จ");
      } else {
        if (!form.password) {
          setError("กรุณากำหนดรหัสผ่าน");
          return;
        }
        await api.createUser(form);
        setMsg("เพิ่มผู้ใช้บริการสำเร็จ");
      }
      setModal(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!confirm("ลบผู้ใช้บริการนี้? (การจองที่เกี่ยวข้องอาจถูกลบ)")) return;
    try {
      await api.deleteUser(id);
      setMsg("ลบผู้ใช้บริการสำเร็จ");
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <AdminLayout title="ผู้ใช้บริการ" subtitle="บัญชีผู้โดยสาร">
      {msg && <div className="success-msg">{msg}</div>}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">รายชื่อผู้ใช้บริการ</h2>
          <button type="button" className="btn btn-primary btn-sm" onClick={openAdd}>
            + เพิ่มผู้ใช้
          </button>
        </div>
        <div className="table-wrapper driver-user-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>ชื่อ-สกุล</th>
                <th>อีเมล</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.user_id}>
                  <td>{u.user_id}</td>
                  <td>{u.username}</td>
                  <td>
                    {u.first_name} {u.last_name}
                  </td>
                  <td>{u.email || "-"}</td>
                  <td>
                    <div className="actions">
                      <button type="button" className="btn-edit-sm" onClick={() => openEdit(u)}>
                        แก้ไข
                      </button>
                      <button type="button" className="btn-danger-sm" onClick={() => remove(u.user_id)}>
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="driver-user-cards">
          {list.map((u) => (
            <article className="driver-user-card" key={u.user_id}>
              <div className="driver-user-card-top">
                <span className="driver-user-id">ID {u.user_id}</span>
                <span className="driver-user-name">{u.first_name} {u.last_name}</span>
              </div>
              <div className="driver-user-details">
                <div>
                  <span>Username</span>
                  <strong>{u.username}</strong>
                </div>
                <div>
                  <span>อีเมล</span>
                  <strong>{u.email || "-"}</strong>
                </div>
              </div>
              <div className="driver-user-actions">
                <button type="button" className="btn-edit-sm" onClick={() => openEdit(u)}>
                  แก้ไข
                </button>
                <button type="button" className="btn-danger-sm" onClick={() => remove(u.user_id)}>
                  ลบ
                </button>
              </div>
            </article>
          ))}
        </div>
        {list.length === 0 && <div className="m-empty">ยังไม่มีผู้ใช้บริการ</div>}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2>{editId ? "แก้ไขผู้ใช้บริการ" : "เพิ่มผู้ใช้บริการ"}</h2>
              <button type="button" className="close-btn" onClick={() => setModal(false)}>
                ×
              </button>
            </div>
            {error && <div className="error-msg">{error}</div>}
            <form onSubmit={save}>
              <div className="form-group">
                <label className="form-label">Username *</label>
                <input
                  className="form-control"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                  disabled={!!editId}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">ชื่อ *</label>
                  <input
                    className="form-control"
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">นามสกุล *</label>
                  <input
                    className="form-control"
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">อีเมล</label>
                <input
                  type="email"
                  className="form-control"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">รหัสผ่าน {editId ? "(ว่างไว้ถ้าไม่เปลี่ยน)" : "*"}</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editId}
                  placeholder={editId ? "ไม่เปลี่ยนถ้าว่าง" : "1234"}
                />
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

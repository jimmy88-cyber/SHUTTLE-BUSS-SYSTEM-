import { useEffect, useState } from "react";
import { api } from "../../api/client";
import AdminLayout from "../../components/AdminLayout";
import SortableHeader from "../../components/SortableHeader";
import { useSortableRows } from "../../hooks/useSortableRows";

const emptyRoute = { route_id: "", route_name: "", total_minutes: "" };

export default function AdminRoutes() {
  const [list, setList] = useState([]);
  const { sortedRows, sort, sortBy } = useSortableRows(list);
  const [stopsMaster, setStopsMaster] = useState([]);
  const [form, setForm] = useState(emptyRoute);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  // editor จุดจอด
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorRouteId, setEditorRouteId] = useState("");
  const [editorStops, setEditorStops] = useState([]);
  const [editorError, setEditorError] = useState("");
  const [editorMsg, setEditorMsg] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    api.getRoutes().then(setList).catch(console.error);
    api.getStops().then(setStopsMaster).catch(console.error);
  }
  useEffect(load, []);

  function startEdit(r) {
    setEditId(r.route_id);
    setForm({
      route_id: r.route_id,
      route_name: r.route_name,
      total_minutes: r.total_minutes ?? "",
    });
    setError("");
    setMsg("");
  }

  function cancelEdit() {
    setEditId(null);
    setForm(emptyRoute);
  }

  async function saveRoute(e) {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      if (editId) {
        await api.updateRoute(editId, {
          route_name: form.route_name,
          total_minutes: form.total_minutes,
        });
        setMsg("แก้ไขเส้นทางสำเร็จ");
      } else {
        await api.createRoute(form);
        setMsg("เพิ่มเส้นทางสำเร็จ");
      }
      cancelEdit();
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!confirm("ลบเส้นทางนี้? (จุดจอดในเส้นทางจะถูกลบด้วย)")) return;
    try {
      await api.deleteRoute(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  function openStopsEditor(r) {
    setEditorRouteId(r.route_id);
    setEditorStops(
      (r.stops || []).map((s) => ({
        stop_id: String(s.stop_id),
        minutes_from_prev: s.minutes_from_prev ?? 0,
      }))
    );
    setEditorError("");
    setEditorMsg("");
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditorRouteId("");
    setEditorStops([]);
  }

  function updateStopRow(i, key, value) {
    setEditorStops((rows) => rows.map((row, idx) => (idx === i ? { ...row, [key]: value } : row)));
  }

  function addRow() {
    setEditorStops((rows) => [...rows, { stop_id: "", minutes_from_prev: rows.length === 0 ? 0 : 5 }]);
  }

  function removeRow(i) {
    setEditorStops((rows) => rows.filter((_, idx) => idx !== i));
  }

  function moveRow(i, dir) {
    setEditorStops((rows) => {
      const j = i + dir;
      if (j < 0 || j >= rows.length) return rows;
      const next = [...rows];
      [next[i], next[j]] = [next[j], next[i]];
      // จุดแรก minutes = 0
      if (next.length) next[0] = { ...next[0], minutes_from_prev: 0 };
      return next;
    });
  }

  const totalMinutes = editorStops.reduce((sum, s, i) => sum + (i === 0 ? 0 : Number(s.minutes_from_prev) || 0), 0);

  async function saveStops() {
    setEditorError("");
    setEditorMsg("");
    if (editorStops.length === 0) {
      setEditorError("ต้องมีอย่างน้อย 1 จุดจอด");
      return;
    }
    if (editorStops.some((s) => !s.stop_id)) {
      setEditorError("กรุณาเลือกจุดจอดให้ครบ");
      return;
    }
    setSaving(true);
    try {
      const payload = editorStops.map((s, i) => ({
        stop_id: Number(s.stop_id),
        minutes_from_prev: i === 0 ? 0 : Number(s.minutes_from_prev) || 0,
      }));
      const res = await api.updateRouteStops(editorRouteId, payload);
      setEditorMsg(`บันทึกสำเร็จ · เวลารวม ${res.total_minutes} นาที`);
      load();
    } catch (err) {
      setEditorError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout title="เส้นทาง" subtitle="รายการเส้นทาง + แก้ไขจุดจอดแบบ list">
      {error && <div className="error-msg">{error}</div>}
      {msg && <div className="success-msg">{msg}</div>}

      <div className="admin-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12 }}>{editId ? `แก้ไข ${editId}` : "เพิ่มเส้นทาง"}</h3>
        <form onSubmit={saveRoute} className="admin-form-row">
          {!editId && (
            <input
              className="form-control"
              placeholder="รหัส เช่น 04"
              value={form.route_id}
              onChange={(e) => setForm({ ...form, route_id: e.target.value })}
              required
            />
          )}
          <input
            className="form-control"
            placeholder="ชื่อเส้นทาง"
            value={form.route_name}
            onChange={(e) => setForm({ ...form, route_name: e.target.value })}
            required
          />
          <input
            className="form-control"
            type="number"
            min="0"
            placeholder="เวลารวม (นาที)"
            value={form.total_minutes}
            onChange={(e) => setForm({ ...form, total_minutes: e.target.value })}
          />
          <button type="submit" className="m-btn m-btn-primary" style={{ width: "auto" }}>
            {editId ? "บันทึก" : "เพิ่ม"}
          </button>
          {editId && (
            <button type="button" className="m-btn m-btn-outline" style={{ width: "auto" }} onClick={cancelEdit}>
              ยกเลิก
            </button>
          )}
        </form>
      </div>

      <div className="admin-card">
        <div className="driver-route-cards">
          {sortedRows.map((r) => (
            <article className="driver-route-card" key={r.route_id}>
              <div className="driver-route-card-header">
                <div>
                  <span className="driver-route-id">เส้นทาง {r.route_id}</span>
                  <h3>{r.route_name}</h3>
                </div>
                <span className="driver-route-duration">{r.total_minutes} นาที</span>
              </div>
              <div className="driver-route-stops">
                <span className="driver-route-section-label">จุดจอด</span>
                {(r.stops || []).length ? (
                  <ol>
                    {r.stops.map((stop, index) => (
                      <li key={`${r.route_id}-${stop.stop_id}-${index}`}>{stop.stop_name}</li>
                    ))}
                  </ol>
                ) : (
                  <p>ยังไม่มีจุดจอด</p>
                )}
              </div>
              <div className="driver-route-actions">
                <button className="btn-edit-sm" onClick={() => openStopsEditor(r)}>จัดการจุดจอด</button>
                <button className="btn-edit-sm" onClick={() => startEdit(r)}>แก้ไข</button>
                <button className="btn-danger-sm" onClick={() => remove(r.route_id)}>ลบ</button>
              </div>
            </article>
          ))}
        </div>
        <table className="admin-table driver-route-table">
          <thead>
            <tr>
              <th><SortableHeader label="รหัส" sortKey="route_id" sort={sort} onSort={sortBy} /></th>
              <th>ชื่อเส้นทาง</th>
              <th>เวลารวม</th>
              <th>จุดจอด</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => (
              <tr key={r.route_id}>
                <td>{r.route_id}</td>
                <td>{r.route_name}</td>
                <td>{r.total_minutes} นาที</td>
                <td style={{ fontSize: "0.85rem", color: "#64748b", maxWidth: 280 }}>
                  {(r.stops || []).map((s) => s.stop_name).join(" → ") || "-"}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn-edit-sm" onClick={() => openStopsEditor(r)}>จุดจอด</button>{" "}
                  <button className="btn-edit-sm" onClick={() => startEdit(r)}>แก้ไข</button>{" "}
                  <button className="btn-danger-sm" onClick={() => remove(r.route_id)}>ลบ</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <div className="m-empty">ยังไม่มีเส้นทาง</div>}
      </div>

      {/* Modal จุดจอดในเส้นทาง */}
      {editorOpen && (
        <div className="modal-backdrop" onClick={closeEditor}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>จุดจอดในเส้นทาง</h3>
              <button type="button" className="modal-close" onClick={closeEditor}>×</button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="m-label">เส้นทาง *</label>
              <select
                className="form-control"
                value={editorRouteId}
                onChange={(e) => {
                  const r = list.find((x) => x.route_id === e.target.value);
                  if (r) openStopsEditor(r);
                }}
              >
                {list.map((r) => (
                  <option key={r.route_id} value={r.route_id}>
                    {r.route_name}
                  </option>
                ))}
              </select>
            </div>

            {editorError && <div className="error-msg">{editorError}</div>}
            {editorMsg && <div className="success-msg">{editorMsg}</div>}

            <div className="stops-editor-table-wrap">
              <table className="admin-table stops-editor-table">
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>ลำดับ</th>
                    <th>จุดจอด</th>
                    <th style={{ width: 130 }}>นาทีจากจุดก่อน</th>
                    <th style={{ width: 120 }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {editorStops.map((row, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>
                        <select
                          className="form-control"
                          value={row.stop_id}
                          onChange={(e) => updateStopRow(i, "stop_id", e.target.value)}
                        >
                          <option value="">-- เลือกจุดจอด --</option>
                          {stopsMaster.map((s) => (
                            <option key={s.stop_id} value={s.stop_id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {i === 0 ? (
                          <span style={{ color: "#64748b", fontSize: "0.85rem" }}>0 (จุดเริ่ม)</span>
                        ) : (
                          <input
                            className="form-control"
                            type="number"
                            min="0"
                            value={row.minutes_from_prev}
                            onChange={(e) => updateStopRow(i, "minutes_from_prev", e.target.value)}
                          />
                        )}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button type="button" className="btn-edit-sm" onClick={() => moveRow(i, -1)} disabled={i === 0}>▲</button>{" "}
                        <button type="button" className="btn-edit-sm" onClick={() => moveRow(i, 1)} disabled={i === editorStops.length - 1}>▼</button>{" "}
                        <button type="button" className="btn-danger-sm" onClick={() => removeRow(i)}>ลบ</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
              <button type="button" className="m-btn m-btn-outline" style={{ width: "auto" }} onClick={addRow}>
                + เพิ่มแถว
              </button>
              <div style={{ fontWeight: 600, color: "#0f766e" }}>เวลารวม: {totalMinutes} นาที</div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
              <button type="button" className="m-btn m-btn-outline" style={{ width: "auto" }} onClick={closeEditor}>
                ยกเลิก
              </button>
              <button
                type="button"
                className="m-btn m-btn-primary"
                style={{ width: "auto", minWidth: 140 }}
                onClick={saveStops}
                disabled={saving}
              >
                {saving ? "กำลังบันทึก..." : "บันทึกทั้งหมด"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

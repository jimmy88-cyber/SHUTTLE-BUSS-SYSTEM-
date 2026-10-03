import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../api/client";
import { getUser } from "../../api/auth";
import BottomNav from "../../components/BottomNav";

const MAX_SEATS = 4;

// วันเวลาออกรถแบบ "YYYY-MM-DD HH:MM" (เวลาท้องถิ่น)
function fmtDateTime(t) {
  const d = new Date(t);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// สถานะรอบ → ข้อความ (null = จองได้)
function closedLabel(s) {
  if (s.status === "completed") return "ปิดรอบการจองแล้ว";
  if (s.status !== "planned" && s.status !== "in_progress") return "ไม่เปิดจอง";
  if (s.seats_available <= 0) return "เต็ม";
  return null;
}

// จุดจอดไม่ซ้ำ เรียงตามลำดับที่เจอครั้งแรกในเส้นทาง
function uniqueStops(stops) {
  const seen = new Set();
  return stops.filter((s) => !seen.has(s.stop_id) && seen.add(s.stop_id));
}

// จุดลงที่เป็นไปได้: หลังจุดขึ้นในลำดับ ถ้าไม่มี (เส้นทางวน) ใช้จุดอื่นทั้งหมดที่ไม่ใช่จุดขึ้น
function dropOptions(stops, pickupId) {
  const pickupSeq = stops.find((s) => String(s.stop_id) === String(pickupId))?.sequence_no ?? 0;
  const others = stops.filter((s) => String(s.stop_id) !== String(pickupId));
  const after = uniqueStops(others.filter((s) => s.sequence_no > pickupSeq));
  return after.length ? after : uniqueStops(others);
}

export default function Book() {
  const user = getUser();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [routes, setRoutes] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [seats, setSeats] = useState(1);
  const [routeId, setRouteId] = useState("");
  const [pickup, setPickup] = useState("");
  const [drops, setDrops] = useState([""]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return navigate("/");
    api.getRoutes().then(setRoutes).catch((e) => alert(e.message));
  }, []);

  const route = routes.find((r) => r.route_id === routeId);
  const stops = route?.stops || [];
  const options = pickup ? dropOptions(stops, pickup) : [];
  const stopName = (id) => stops.find((s) => String(s.stop_id) === String(id))?.stop_name || id;
  const canNext = routeId && pickup && drops.length === seats && drops.every(Boolean);

  function changeRoute(id) {
    setRouteId(id);
    setPickup("");
    setDrops(Array(seats).fill(""));
  }

  function changePickup(id) {
    setPickup(id);
    setDrops(Array(seats).fill(""));
  }

  function chgSeats(d) {
    const n = Math.max(1, Math.min(MAX_SEATS, seats + d));
    setSeats(n);
    setDrops((prev) => Array.from({ length: n }, (_, i) => prev[i] || ""));
  }

  function setDrop(i, value) {
    setDrops((prev) => prev.map((v, j) => (j === i ? value : v)));
  }

  async function loadSchedules() {
    const list = await api.getSchedules({ route_id: routeId });
    setSchedules(list);
    return list;
  }

  async function goStep2() {
    if (!canNext) return alert("กรุณากรอกข้อมูลให้ครบ");
    if (drops.some((d) => d === pickup)) return alert("จุดขึ้น–ลงต้องต่างกัน");
    setSelected(null);
    try {
      await loadSchedules();
      setStep(2);
    } catch (e) {
      alert(e.message);
    }
  }

  function backStep1() {
    setSelected(null);
    setStep(1);
  }

  async function confirmBook() {
    if (!selected) return alert("เลือกรอบก่อน");
    setLoading(true);
    try {
      const res = await api.createBooking({
        user_id: user.user_id,
        schedule_id: selected.schedule_id,
        pickup_stop_id: Number(pickup),
        dropoff_stop_ids: drops.map(Number),
        num_seats: seats,
      });
      const list = res.bookings || [res.booking];
      const msg =
        list.length === 1
          ? `จองสำเร็จ!\nรหัส ${list[0].booking_id}\nQR: ${list[0].qr_code}\n${seats} ที่นั่ง`
          : `จองสำเร็จ ${list.length} รายการ!\n` +
            list.map((b) => `${b.booking_id} → ${b.dropoff?.stop_name} (${b.num_seats} ที่) QR: ${b.qr_code}`).join("\n");
      alert(msg);
      navigate("/bookings");
    } catch (e) {
      alert("ไม่สามารถจองได้\n" + e.message);
      // ที่นั่งหรือสถานะรอบอาจเปลี่ยนไปแล้ว โหลดรอบใหม่
      setSelected(null);
      loadSchedules().catch(() => {});
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  const availableCount = schedules.filter((s) => !closedLabel(s) && s.seats_available >= seats).length;

  return (
    <div className="m-body book-page">
      <div className="m-status"><span>Shuttle</span><span>จองรถ</span></div>
      <header className="m-header rounded">
        <h1>🎫 จองรถรับส่ง</h1>
        <p>ที่นั่งตามว่างจริง · สูงสุด {MAX_SEATS} ที่/ครั้ง</p>
      </header>
      <div className="m-content">
        <div className="step-indicator">
          <div className={`step-dot ${step === 1 ? "active" : "done"}`}>1</div>
          <div className={`step-dot ${step === 2 ? "active" : ""}`}>2</div>
        </div>

        {/* ========== STEP 1: รายละเอียด + จำนวนคน + เส้นทาง ========== */}
        {step === 1 && (
          <div className="m-card">
            <label className="m-label">จำนวนคนที่จอง</label>
            <div className="m-seat-row">
              <button type="button" className="m-seat-btn" disabled={seats <= 1} onClick={() => chgSeats(-1)}>−</button>
              <div className="m-seat-num">{seats}</div>
              <button type="button" className="m-seat-btn" disabled={seats >= MAX_SEATS} onClick={() => chgSeats(1)}>+</button>
            </div>
            <p style={{ textAlign: "center", fontSize: "0.8rem", color: "#64748b", margin: "0 0 14px" }}>
              {seats === MAX_SEATS ? "สูงสุดแล้ว" : `สูงสุด ${MAX_SEATS} คน`}
            </p>

            <label className="m-label">เส้นทาง</label>
            <select className="m-select" value={routeId} onChange={(e) => changeRoute(e.target.value)}>
              <option value="">-- เลือกเส้นทาง --</option>
              {routes.map((r) => (
                <option key={r.route_id} value={r.route_id}>{r.route_name} ({r.total_minutes} นาที)</option>
              ))}
            </select>

            <label className="m-label">จุดขึ้นรถ (ร่วมกันทุกคน)</label>
            <select className="m-select" value={pickup} onChange={(e) => changePickup(e.target.value)}>
              <option value="">-- เลือกจุดขึ้น --</option>
              {uniqueStops(stops).map((s) => (
                <option key={s.stop_id} value={s.stop_id}>{s.stop_name}</option>
              ))}
            </select>

            {!routeId || !pickup ? (
              <p style={{ textAlign: "center", fontSize: "0.82rem", color: "#94a3b8", margin: "8px 0" }}>
                เลือกเส้นทางและจุดขึ้นก่อน เพื่อแสดงช่องจุดลง
              </p>
            ) : (
              drops.map((d, i) => (
                <div className="passenger-card" key={i}>
                  <div className="p-title">ผู้โดยสาร {i + 1}</div>
                  <label className="m-label">จุดขึ้นรถ</label>
                  <select className="m-select" disabled>
                    <option>{stopName(pickup)}</option>
                  </select>
                  <label className="m-label">จุดลงรถ</label>
                  <select className="m-select" value={d} onChange={(e) => setDrop(i, e.target.value)}>
                    <option value="">-- เลือกจุดลง --</option>
                    {options.map((s) => (
                      <option key={s.stop_id} value={s.stop_id}>{s.stop_name}</option>
                    ))}
                  </select>
                </div>
              ))
            )}

            <button className="m-btn m-btn-primary" disabled={!canNext} onClick={goStep2}>ถัดไป · เลือกรอบ</button>
            <Link to="/home" className="m-btn m-btn-outline" style={{ marginTop: 8 }}>ยกเลิก</Link>
          </div>
        )}

        {/* ========== STEP 2: เลือกรอบ ========== */}
        {step === 2 && (
          <div>
            <div className="m-card">
              <div className="m-card-title">สรุปรายละเอียด</div>
              <div style={{ fontSize: "0.85rem", lineHeight: 1.6, color: "#334155" }}>
                <b>เส้นทาง</b> {route?.route_name}<br />
                <b>จุดขึ้น</b> {stopName(pickup)}<br />
                <b>จำนวน</b> {seats} คน<br />
                {drops.map((d, i) => (
                  <span key={i}><b>ผู้โดยสาร {i + 1} ลงที่</b> {stopName(d)}<br /></span>
                ))}
              </div>
            </div>
            <div className="m-card">
              <div className="m-card-title">เลือกรอบที่มีในเส้นทาง</div>
              {schedules.length === 0 ? (
                <div className="m-empty" style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>ไม่มีรอบในเส้นทางนี้</div>
              ) : (
                schedules.map((s) => {
                  const closed = closedLabel(s);
                  const r = s.seats_available;
                  const enough = r >= seats;
                  const disabled = !!closed || !enough;
                  const capacity = s.vehicle?.capacity;
                  return (
                    <div
                      key={s.schedule_id}
                      className={`trip-option${disabled ? " disabled" : ""}${selected?.schedule_id === s.schedule_id ? " selected" : ""}`}
                      onClick={() => !disabled && setSelected(s)}
                    >
                      <div className="t-time">{fmtDateTime(s.departure_time)}</div>
                      <div className="t-meta">
                        {s.vehicle?.plate_number}{capacity ? ` (${capacity} ที่)` : ""} ·{" "}
                        {closed || (enough ? `ว่าง ${r} ที่` : `ว่าง ${r} ที่ (ไม่พอ)`)}
                      </div>
                    </div>
                  );
                })
              )}
              {schedules.length > 0 && (
                <p style={{ textAlign: "center", fontSize: "0.8rem", color: "#64748b", margin: "8px 0 0" }}>
                  {availableCount ? `มี ${availableCount} รอบที่จองได้สำหรับ ${seats} คน` : "ไม่มีรอบที่ว่างพอในขณะนี้"}
                </p>
              )}
            </div>
            <button className="m-btn m-btn-primary" disabled={!selected || loading} onClick={confirmBook}>
              {loading ? "กำลังจอง..." : "ยืนยันจอง + สร้าง QR"}
            </button>
            <button className="m-btn m-btn-outline" style={{ marginTop: 8 }} onClick={backStep1}>← กลับแก้ไข</button>
          </div>
        )}
      </div>
      <BottomNav active="book" />
    </div>
  );
}

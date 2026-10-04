import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { getUser } from "../../api/auth";
import BottomNav from "../../components/BottomNav";

const fmt = (t) => (t ? new Date(t).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "-");
const stopName = (stops, id) => stops.find((s) => String(s.stop_id) === String(id))?.stop_name || "";

export default function Book() {
  const user = getUser();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [routes, setRoutes] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [seats, setSeats] = useState(1);
  const [routeId, setRouteId] = useState("");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return navigate("/");
    api.getRoutes().then(setRoutes).catch(console.error);
  }, []);

  const route = routes.find((r) => r.route_id === routeId);
  const stops = route?.stops || [];

  async function changeRoute(id) {
    setRouteId(id);
    setPickup("");
    setDropoff("");
    setSelected(null);
    setSchedules(id ? await api.getSchedules({ route_id: id }).catch(() => []) : []);
  }

  async function confirm() {
    if (!selected || !pickup || !dropoff) return setError("กรุณาเลือกข้อมูลให้ครบ");
    if (pickup === dropoff) return setError("จุดขึ้นและจุดลงต้องต่างกัน");
    setError("");
    setLoading(true);
    try {
      const res = await api.createBooking({
        user_id: user.user_id,
        schedule_id: selected.schedule_id,
        pickup_stop_id: Number(pickup),
        dropoff_stop_id: Number(dropoff),
        num_seats: seats,
      });
      setSuccess(res.booking);
      setStep(3);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <div className="m-body">
      <div className="m-status"><span>Shuttle</span><span>จองรถ</span></div>
      <header className="m-header rounded">
        <h1>🎫 จองรถรับส่ง</h1>
        <p>ที่นั่งตามว่างจริง · สูงสุด 4 ที่/ครั้ง</p>
      </header>
      <div className="m-content">
        <div className="step-indicator">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`step-dot ${step === n ? "active" : step > n ? "done" : ""}`}>{n}</div>
          ))}
        </div>
        {error && <div className="error-msg">{error}</div>}

        {step === 1 && (
          <div className="m-card">
            <label className="m-label">จำนวนคนที่จอง</label>
            <div className="m-seat-row">
              <button type="button" className="m-seat-btn" onClick={() => setSeats((s) => Math.max(1, s - 1))}>−</button>
              <div className="m-seat-num">{seats}</div>
              <button type="button" className="m-seat-btn" onClick={() => setSeats((s) => Math.min(4, s + 1))}>+</button>
            </div>
            <p style={{ textAlign: "center", fontSize: "0.8rem", color: "#64748b", margin: "0 0 14px" }}>สูงสุด 4 คน</p>

            <label className="m-label">เส้นทาง</label>
            <select className="m-select" value={routeId} onChange={(e) => changeRoute(e.target.value)}>
              <option value="">-- เลือกเส้นทาง --</option>
              {routes.map((r) => (
                <option key={r.route_id} value={r.route_id}>{r.route_name} ({r.total_minutes} นาที)</option>
              ))}
            </select>

            <label className="m-label">จุดขึ้นรถ</label>
            <select className="m-select" value={pickup} onChange={(e) => setPickup(e.target.value)} disabled={!routeId}>
              <option value="">-- เลือกจุดขึ้น --</option>
              {stops.map((s) => <option key={"p" + s.sequence_no} value={s.stop_id}>{s.stop_name}</option>)}
            </select>

            <label className="m-label">จุดลงรถ</label>
            <select className="m-select" value={dropoff} onChange={(e) => setDropoff(e.target.value)} disabled={!routeId}>
              <option value="">-- เลือกจุดลง --</option>
              {stops.map((s) => <option key={"d" + s.sequence_no} value={s.stop_id}>{s.stop_name}</option>)}
            </select>

            <button className="m-btn m-btn-primary" disabled={!routeId || !pickup || !dropoff} onClick={() => setStep(2)}>
              เลือกรอบรถ →
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="m-card" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: "0.9rem", color: "#64748b" }}>{route?.route_name} · {seats} ที่นั่ง</div>
              <div style={{ fontWeight: 600 }}>{stopName(stops, pickup)} → {stopName(stops, dropoff)}</div>
            </div>
            <div style={{ marginBottom: 10, fontWeight: 600 }}>เลือกรอบรถ</div>
            {schedules.length === 0 ? (
              <div className="m-empty">ไม่มีรอบรถในเส้นทางนี้</div>
            ) : (
              schedules.map((s) => {
                const disabled = s.seats_available < seats;
                return (
                  <div
                    key={s.schedule_id}
                    className={`trip-option ${selected?.schedule_id === s.schedule_id ? "selected" : ""} ${disabled ? "disabled" : ""}`}
                    onClick={() => !disabled && setSelected(s)}
                  >
                    <div className="t-time">{fmt(s.departure_time)}</div>
                    <div className="t-meta">{s.vehicle?.plate_number} · คนขับ {s.driver?.driver_name} · ว่าง {s.seats_available}/{s.vehicle?.capacity}</div>
                  </div>
                );
              })
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button className="m-btn m-btn-outline" style={{ flex: 1 }} onClick={() => setStep(1)}>← กลับ</button>
              <button className="m-btn m-btn-primary" style={{ flex: 2 }} disabled={!selected || loading} onClick={confirm}>
                {loading ? "กำลังจอง..." : "ยืนยันการจอง"}
              </button>
            </div>
          </div>
        )}

        {step === 3 && success && (
          <div className="m-card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: 8 }}>✅</div>
            <h2 style={{ marginBottom: 8 }}>จองสำเร็จ!</h2>
            <p style={{ color: "#64748b", marginBottom: 16 }}>รหัสการจอง: <strong>{success.booking_id}</strong></p>
            <div style={{ background: "#f0fdfa", borderRadius: 12, padding: 16, marginBottom: 16, textAlign: "left", fontSize: "0.9rem" }}>
              <div><strong>QR:</strong> {success.qr_code}</div>
              <div><strong>เส้นทาง:</strong> {success.route?.route_name}</div>
              <div><strong>เวลา:</strong> {success.schedule?.departure_time ? new Date(success.schedule.departure_time).toLocaleString("th-TH") : "-"}</div>
              <div><strong>ขึ้น:</strong> {success.pickup?.stop_name}</div>
              <div><strong>ลง:</strong> {success.dropoff?.stop_name}</div>
              <div><strong>ที่นั่ง:</strong> {success.num_seats}</div>
              <div><strong>รถ:</strong> {success.vehicle?.plate_number}</div>
            </div>
            <button className="m-btn m-btn-primary" onClick={() => navigate("/bookings")}>ดูการจองของฉัน</button>
          </div>
        )}
      </div>
      <BottomNav active="book" />
    </div>
  );
}

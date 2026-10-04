import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { getUser, clearUser } from "../../api/auth";
import DriverNav from "../../components/DriverNav";

function timeOnly(iso) {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

export default function DriverScan() {
  const user = getUser();
  const navigate = useNavigate();
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [trips, setTrips] = useState([]);
  const [recent, setRecent] = useState([]);
  const [camOn, setCamOn] = useState(false);
  const [clk, setClk] = useState(() =>
    new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
  );
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }
    api.getSchedules({ driver_id: user.user_id }).then(setTrips).catch(console.error);
    loadRecent();
    const t = setInterval(() => {
      setClk(new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }));
    }, 30000);
    return () => {
      clearInterval(t);
      stopCam();
    };
  }, []);

  const activeTrip = useMemo(
    () => trips.find((t) => t.status === "in_progress") || null,
    [trips]
  );

  async function loadRecent() {
    try {
      const all = await api.getBoarding();
      const mine = all
        .filter(
          (r) =>
            String(r.scanned_by_user?.user_id) === String(user.user_id) ||
            String(r.scanned_by) === String(user.user_id)
        )
        .slice(0, 8);
      setRecent(mine);
    } catch {
      setRecent([]);
    }
  }

  async function stopCam() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamOn(false);
  }

  async function toggleCam() {
    if (camOn) {
      await stopCam();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamOn(true);
    } catch (e) {
      alert("เปิดกล้องไม่ได้ — กรุณากรอกรหัสด้วยตนเอง\n" + (e.message || ""));
    }
  }

  async function doCheckIn() {
    setError("");
    setSuccess("");
    const code = qr.trim();
    if (!code) {
      setError("กรุณากรอกรหัสจอง หรือ QR Code");
      return;
    }
    setLoading(true);
    try {
      let booking;
      try {
        booking = await api.getBookingByQr(code);
      } catch {
        const list = await api.getBookings(activeTrip ? { schedule_id: activeTrip.schedule_id } : {});
        booking = list.find((b) => b.booking_id === code || b.qr_code === code);
        if (!booking) throw new Error("ไม่พบรหัสจอง / QR นี้");
      }

      if (booking.boarded) throw new Error("รายการนี้ขึ้นรถไปแล้ว");
      if (booking.status !== "booked") throw new Error("สถานะการจองไม่พร้อมขึ้นรถ (" + booking.status + ")");

      const scheduleId = booking.schedule?.schedule_id;
      const stopId = booking.pickup?.stop_id;
      if (!scheduleId || !stopId) throw new Error("ข้อมูลรอบหรือจุดขึ้นไม่ครบ");

      if (activeTrip && String(scheduleId) !== String(activeTrip.schedule_id)) {
        if (!confirm("การจองนี้ไม่ใช่รอบที่กำลังวิ่ง ต้องการเช็คอินต่อหรือไม่?")) {
          setLoading(false);
          return;
        }
      }

      await api.createBoarding({
        booking_id: booking.booking_id,
        schedule_id: scheduleId,
        stop_id: stopId,
        scanned_by: user.user_id,
      });

      setSuccess(
        `✅ เช็คอินสำเร็จ · ${booking.user?.passenger_name || ""} · รหัส ${booking.booking_id} · ${booking.num_seats} ที่`
      );
      setQr("");
      loadRecent();
      // refresh seats on banner
      api.getSchedules({ driver_id: user.user_id }).then(setTrips).catch(() => {});
      inputRef.current?.focus();
    } catch (e) {
      setError(e.message || "เช็คอินไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <div className="m-body">
      <div className="m-status">
        <span>{clk}</span>
        <span>สแกน QR</span>
      </div>

      <header className="m-header rounded">
        <div className="row">
          <div>
            <h1>📷 สแกน QR ขึ้นรถ</h1>
            <p>สแกนจากผู้โดยสาร หรือกรอกรหัสจอง</p>
          </div>
          <button type="button" className="m-btn m-btn-ghost" onClick={() => navigate("/driver")}>
            ← กลับ
          </button>
        </div>
      </header>

      <div className="m-content">
        {activeTrip ? (
          <div className="m-card" style={{ borderLeft: "4px solid #0d9488" }}>
            <div className="drv-card-top">
              <div className="drv-info">
                <div style={{ fontSize: "0.75rem", color: "#0d9488", fontWeight: 600 }}>กำลังเดินทาง</div>
                <div style={{ fontWeight: 700, marginTop: 2 }}>
                  รอบ {activeTrip.schedule_id} · {timeOnly(activeTrip.departure_time)} น.
                </div>
                <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 2 }}>
                  {activeTrip.route?.route_name} · {activeTrip.vehicle?.plate_number}
                  {activeTrip.vehicle?.capacity ? ` (ตู้ ${activeTrip.vehicle.capacity} ที่)` : ""}
                </div>
                <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 2 }}>
                  ขึ้นรถแล้ว {activeTrip.seats_booked || 0} / {activeTrip.vehicle?.capacity || 0} ที่
                </div>
              </div>
              <span className="m-badge m-badge-progress">กำลังวิ่ง</span>
            </div>
          </div>
        ) : (
          <div className="m-card" style={{ background: "#fffbeb", borderColor: "#fde68a" }}>
            <div style={{ fontWeight: 600, color: "#92400e" }}>ยังไม่มีรอบที่กำลังเดินทาง</div>
            <div style={{ fontSize: "0.85rem", color: "#a16207", marginTop: 4 }}>
              ไปหน้ารอบรถ → เลือกรอบ → กดเริ่มเดินทาง / สแกนต่อ
            </div>
            <button type="button" className="m-btn m-btn-outline" style={{ marginTop: 10 }} onClick={() => navigate("/driver")}>
              ไปหน้ารอบรถ
            </button>
          </div>
        )}

        {error && <div className="result-err">{error}</div>}
        {success && <div className="result-ok">{success}</div>}

        <div className="m-card" style={{ textAlign: "center" }}>
          <div className="scan-frame">
            {!camOn && (
              <div className="placeholder">
                <div className="cam-ico">📷</div>
                <div>กล้องสแกน QR</div>
                <div style={{ fontSize: "0.75rem", opacity: 0.6 }}>กดปุ่มด้านล่างเพื่อเปิดกล้อง</div>
              </div>
            )}
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ display: camOn ? "block" : "none", width: "100%", height: "100%", objectFit: "cover" }}
            />
            <div className="scan-corner tl" />
            <div className="scan-corner tr" />
            <div className="scan-corner bl" />
            <div className="scan-corner br" />
            {camOn && <div className="scan-line" />}
          </div>

          <button type="button" className="m-btn m-btn-primary" onClick={toggleCam}>
            {camOn ? "ปิดกล้อง" : "เปิดกล้องสแกน"}
          </button>
          <p style={{ fontSize: "0.78rem", color: "#94a3b8", margin: "10px 0 0" }}>หรือกรอกรหัสจอง / QR ด้วยตนเอง</p>
        </div>

        <div className="m-card">
          <label className="m-label">รหัสจอง หรือ QR Code</label>
          <input
            ref={inputRef}
            className="m-input"
            value={qr}
            onChange={(e) => setQr(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doCheckIn()}
            placeholder="เช่น 01 หรือ QR-01-001"
            autoComplete="off"
          />
          <button type="button" className="m-btn m-btn-success" onClick={doCheckIn} disabled={loading}>
            {loading ? "กำลังบันทึก..." : "ยืนยันเช็คอิน"}
          </button>
        </div>

        <div className="m-card">
          <div className="m-card-title">เช็คอินล่าสุด</div>
          {recent.length === 0 ? (
            <div style={{ color: "#94a3b8", fontSize: "0.85rem", textAlign: "center", padding: "8px 0" }}>
              ยังไม่มีรายการ
            </div>
          ) : (
            recent.map((r) => (
              <div className="m-list-item" key={r.boarding_id}>
                <div>
                  <b>{r.booking_id}</b> {r.passenger?.passenger_name || ""}
                  <br />
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                    {r.scanned_at ? new Date(r.scanned_at).toLocaleString("th-TH") : ""} · {r.stop?.stop_name}
                  </span>
                </div>
                <span className="m-badge m-badge-checked">ขึ้นแล้ว</span>
              </div>
            ))
          )}
        </div>
      </div>

      <DriverNav />
    </div>
  );
}

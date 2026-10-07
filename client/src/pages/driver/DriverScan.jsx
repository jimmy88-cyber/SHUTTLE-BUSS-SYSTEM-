import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, sortByNumericId } from "../../api/client";
import { getUser } from "../../api/auth";
import { getPermissionBits } from "../../permissions";
import DriverNav from "../../components/DriverNav";

function timeOnly(iso) {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

export default function DriverScan() {
  const user = getUser();
  const userId = user?.user_id;
  const canViewTrips = getPermissionBits(user?.permission, user?.position_id)[3] === "1";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedScheduleId = searchParams.get("schedule_id");
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [checkInResults, setCheckInResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [trips, setTrips] = useState([]);
  const [recent, setRecent] = useState([]);
  const [recentScheduleId, setRecentScheduleId] = useState(null);
  const [camOn, setCamOn] = useState(false);
  const [clk, setClk] = useState(() =>
    new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
  );
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!userId) {
      navigate("/");
      return;
    }
    api
      .getSchedules({ driver_id: userId })
      .then((assignedTrips) => {
        setTrips(assignedTrips);
        const currentTrip = requestedScheduleId
          ? assignedTrips.find((trip) => String(trip.schedule_id) === requestedScheduleId)
          : assignedTrips.find((trip) => trip.status === "in_progress");
        if (requestedScheduleId && !currentTrip) {
          setError(`ไม่พบรอบ ${requestedScheduleId} ในรายการรอบรถของคุณ`);
          loadRecent();
          return;
        }
        loadRecent(currentTrip?.schedule_id);
      })
      .catch((e) => {
        console.error(e);
        setError(e.message || "โหลดรอบรถไม่สำเร็จ");
      });
    const t = setInterval(() => {
      setClk(new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }));
    }, 30000);
    return () => {
      clearInterval(t);
      stopCam();
    };
  }, [navigate, requestedScheduleId, userId]);

  const activeTrip = useMemo(
    () =>
      requestedScheduleId
        ? trips.find((t) => String(t.schedule_id) === requestedScheduleId) || null
        : trips.find((t) => t.status === "in_progress") || null,
    [trips, requestedScheduleId]
  );

  async function loadRecent(scheduleId) {
    if (!scheduleId) {
      setRecent([]);
      setRecentScheduleId(null);
      return;
    }
    try {
      const [all, bookings] = await Promise.all([
        api.getBoarding(),
        api.getBookings({ schedule_id: scheduleId }),
      ]);

      const validIds = new Set(
        bookings
          .filter((b) => b.boarded && b.status !== "cancelled")
          .map((b) => String(b.booking_id))
      );

      const mine = all
        .filter(
          (r) =>
            String(r.schedule_id) === String(scheduleId) &&
            validIds.has(String(r.booking_id))
        )
        .sort((a, b) => new Date(b.scanned_at) - new Date(a.scanned_at))
        .slice(0, 8);
      setRecent(sortByNumericId(mine, "boarding_id"));
      setRecentScheduleId(scheduleId);
    } catch (e) {
      setRecent([]);
      setRecentScheduleId(scheduleId);
      setError(e.message || "โหลดรายการเช็คอินล่าสุดไม่สำเร็จ");
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
    setCheckInResults([]);
    const code = qr.trim();
    if (!code) {
      setError("กรุณากรอกรหัสจอง หรือ QR Code");
      return;
    }
    setLoading(true);
    try {
      const result = await api.getBookingByQr(code);
      const bookings = result.bookings || [];
      if (!bookings.length) throw new Error("ไม่พบรหัสจอง / QR นี้");

      const scheduleId = bookings[0].schedule?.schedule_id;
      if (!scheduleId || bookings.some((booking) => String(booking.schedule?.schedule_id) !== String(scheduleId))) {
        throw new Error("ข้อมูลรอบการจองไม่ถูกต้อง");
      }

      if (activeTrip && String(scheduleId) !== String(activeTrip.schedule_id)) {
        if (!confirm("การจองนี้ไม่ใช่รอบที่กำลังวิ่ง ต้องการเช็คอินต่อหรือไม่?")) {
          return;
        }
      }

      const pending = bookings.filter((booking) => booking.status === "booked" && !booking.boarded);
      if (!pending.length) throw new Error("การจองทั้งหมดในรอบนี้ขึ้นรถแล้ว หรือถูกยกเลิกแล้ว");

      const checkedIn = [];
      for (const booking of pending) {
        const stopId = booking.pickup?.stop_id;
        if (!stopId) throw new Error(`ไม่พบจุดขึ้นรถของรายการ ${booking.booking_id}`);
        await api.createBoarding({
          booking_id: booking.booking_id,
          schedule_id: scheduleId,
          stop_id: stopId,
          scanned_by: user.user_id,
        });
        checkedIn.push(booking);
        setCheckInResults([...bookings.filter((item) => item.status === "checked_in" || item.boarded), ...checkedIn]);
      }

      const totalSeats = pending.reduce((total, booking) => total + booking.num_seats, 0);
      setSuccess(`✅ เช็คอินสำเร็จ ${pending.length} รายการ · รวม ${totalSeats} ที่นั่ง`);
      setQr("");
      loadRecent(scheduleId);
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
    <div className="m-body driver-app">
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
          {canViewTrips && (
            <button type="button" className="m-btn m-btn-ghost" onClick={() => navigate("/driver")}>
              ← กลับ
            </button>
          )}
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
                  จองแล้ว {activeTrip.seats_booked || 0} / {activeTrip.vehicle?.capacity || 0} ที่
                  {recent.length > 0 ? ` · ขึ้นแล้ว ${recent.length} คน` : ""}
                </div>
              </div>
              <span className="m-badge m-badge-progress">กำลังวิ่ง</span>
            </div>
          </div>
        ) : (
          <div className="m-card" style={{ background: "#fffbeb", borderColor: "#fde68a" }}>
            <div style={{ fontWeight: 600, color: "#92400e" }}>ยังไม่มีรอบที่กำลังเดินทาง</div>
            <div style={{ fontSize: "0.85rem", color: "#a16207", marginTop: 4 }}>
              {canViewTrips
                ? "ไปหน้ารอบรถ → เลือกรอบ → กดเริ่มเดินทาง / สแกนต่อ"
                : "สามารถสแกนรหัสจองได้ แต่ไม่มีสิทธิ์เข้าดูหน้ารอบรถ"}
            </div>
            {canViewTrips && (
              <button type="button" className="m-btn m-btn-outline" style={{ marginTop: 10 }} onClick={() => navigate("/driver")}>
                ไปหน้ารอบรถ
              </button>
            )}
          </div>
        )}

        {error && <div className="result-err">{error}</div>}
        {success && <div className="result-ok">{success}</div>}
        {checkInResults.length > 0 && (
          <div className="m-card">
            <div className="m-card-title">รายการจองในบัญชีนี้ · รอบ {checkInResults[0].schedule?.schedule_id}</div>
            {checkInResults.map((booking) => (
              <div className="m-list-item" key={booking.booking_id}>
                <div>
                  <b>#{booking.booking_id}</b> {booking.user?.passenger_name || ""}
                  <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                    {booking.pickup?.stop_name} → {booking.dropoff?.stop_name} · {booking.num_seats} ที่
                  </div>
                </div>
                <span className="m-badge m-badge-checked">ขึ้นแล้ว</span>
              </div>
            ))}
          </div>
        )}

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
            placeholder="สแกนหรือกรอกรหัส QR ของรอบนี้"
            autoComplete="off"
          />
          <button type="button" className="m-btn m-btn-success" onClick={doCheckIn} disabled={loading}>
            {loading ? "กำลังบันทึก..." : "ยืนยันเช็คอิน"}
          </button>
        </div>

        <div className="m-card">
          <div className="m-card-title">
            เช็คอินล่าสุด{recentScheduleId ? ` · รอบ ${recentScheduleId}` : ""}
          </div>
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

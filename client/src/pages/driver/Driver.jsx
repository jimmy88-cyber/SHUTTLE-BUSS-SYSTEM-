import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { getUser, clearUser } from "../../api/auth";
import { getPermissionBits } from "../../permissions";
import DriverNav from "../../components/DriverNav";

function timeOnly(iso) {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function dateTimeFull(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day} ${timeOnly(iso)} น.`;
}

function statusLabel(status) {
  if (status === "in_progress") return { text: "กำลังเดินทาง", cls: "m-badge m-badge-progress" };
  if (status === "completed") return { text: "เสร็จแล้ว", cls: "m-badge m-badge-checked" };
  if (status === "cancelled") return { text: "ยกเลิก", cls: "m-badge m-badge-cancel" };
  return { text: "รอออก", cls: "m-badge m-badge-planned" };
}

export default function Driver() {
  const user = getUser();
  const canScan = getPermissionBits(user?.permission, user?.position_id)[9] === "1";
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [passengers, setPassengers] = useState([]);
  const [paxLoading, setPaxLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clk, setClk] = useState(() =>
    new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
  );

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }
    loadTrips();
    const t = setInterval(() => {
      setClk(new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }));
    }, 30000);
    return () => clearInterval(t);
  }, []);

  async function loadTrips() {
    setLoading(true);
    try {
      const list = await api.getSchedules({ driver_id: user.user_id });
      setTrips(list);
    } catch (e) {
      console.error(e);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }

  async function openTrip(t) {
    setSelected(t);
    setPaxLoading(true);
    try {
      const list = await api.getBookings({ schedule_id: t.schedule_id });
      setPassengers(list.filter((b) => b.status !== "cancelled"));
    } catch (e) {
      console.error(e);
      setPassengers([]);
    } finally {
      setPaxLoading(false);
    }
  }

  async function setTripStatus(status) {
    if (!selected) return;
    const msg =
      status === "in_progress"
        ? "เริ่มเดินทางรอบนี้?"
        : status === "completed"
          ? "ปิดรอบนี้?"
          : status === "cancelled"
            ? "ยกเลิกรอบนี้?"
            : "อัปเดตสถานะ?";
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      await api.updateScheduleStatus(selected.schedule_id, status);
      const updated = { ...selected, status };
      setSelected(updated);
      setTrips((prev) => prev.map((x) => (x.schedule_id === updated.schedule_id ? updated : x)));
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  const boardedCount = useMemo(
    () => passengers.filter((p) => p.boarded || p.status === "checked_in").length,
    [passengers]
  );
  const seatBooked = useMemo(
    () => passengers.reduce((s, p) => s + (Number(p.num_seats) || 0), 0),
    [passengers]
  );

  const nextTripPax = useMemo(() => {
    const next = trips.find((t) => t.status === "in_progress") || trips.find((t) => t.status === "planned");
    return next?.seats_booked || 0;
  }, [trips]);

  // group passengers by name for display like mockup
  const groups = useMemo(() => {
    const map = {};
    for (const p of passengers) {
      const key = p.user?.passenger_name || `User ${p.user?.user_id || p.booking_id}`;
      if (!map[key]) map[key] = { name: key, seats: 0, items: [] };
      map[key].seats += Number(p.num_seats) || 0;
      map[key].items.push(p);
    }
    return Object.values(map);
  }, [passengers]);

  if (!user) return null;

  /* ========== หน้ารายละเอียดรอบ ========== */
  if (selected) {
    const st = statusLabel(selected.status);
    return (
      <div className="m-body driver-app">
        <div className="m-status">
          <span>{clk}</span>
          <span>รายละเอียด</span>
        </div>

        <header className="m-header rounded">
          <div className="row">
            <div>
              <h1>รอบ {selected.schedule_id}</h1>
              <p>{dateTimeFull(selected.departure_time)}</p>
            </div>
            <button type="button" className="m-btn m-btn-ghost" onClick={() => setSelected(null)}>
              ← กลับ
            </button>
          </div>
        </header>

        <div className="m-content">
          <div className="m-card">
            <div className="drv-card-top">
              <div className="drv-info">
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>เส้นทาง</div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{selected.route?.route_name || "-"}</div>
                <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 6 }}>
                  🚌 {selected.vehicle?.plate_number}
                  {selected.vehicle?.capacity ? ` (ตู้ ${selected.vehicle.capacity} ที่)` : ""}
                </div>
                <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 2 }}>
                  👤 ขึ้นรถแล้ว {boardedCount} / {seatBooked || selected.seats_booked || 0} คน
                </div>
              </div>
              <span className={st.cls}>{st.text}</span>
            </div>
          </div>

          <div style={{ fontWeight: 700, margin: "14px 0 8px" }}>รายชื่อผู้โดยสาร</div>

          {paxLoading ? (
            <div className="m-empty">กำลังโหลด...</div>
          ) : groups.length === 0 ? (
            <div className="m-empty">
              <div className="big">👤</div>
              ยังไม่มีผู้จอง
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.name} className="pax-group">
                <div className="pax-group-header">
                  <span>
                    {g.name}{" "}
                    <span style={{ fontWeight: 600, color: "#64748b", fontSize: "0.8rem" }}>{g.seats} ที่</span>
                  </span>
                  <span className={`m-badge ${g.items.every((x) => x.boarded || x.status === "checked_in") ? "m-badge-checked" : "m-badge-booked"}`}>
                    {g.items.every((x) => x.boarded || x.status === "checked_in") ? "ขึ้นแล้ว" : "ยังไม่มา"}
                  </span>
                </div>
                {g.items.map((p) => {
                  const boarded = p.boarded || p.status === "checked_in";
                  return (
                    <div className="pax-item" key={p.booking_id}>
                      <div className="pax-info">
                        <div style={{ fontWeight: 700 }}>#{p.booking_id}</div>
                        <div className="pax-sub">
                          {p.pickup?.stop_name} → {p.dropoff?.stop_name} · {p.num_seats} ที่
                        </div>
                      </div>
                      <span className={`m-badge ${boarded ? "m-badge-checked" : "m-badge-booked"}`}>
                        {boarded ? "ขึ้นแล้ว" : "ยังไม่มา"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            {canScan && (selected.status === "in_progress" || selected.status === "planned") && (
              <button
                type="button"
                className="m-btn m-btn-primary"
                onClick={async () => {
                  if (selected.status === "planned") {
                    if (!confirm("เริ่มเดินทางรอบนี้แล้วไปสแกน?")) return;
                    setBusy(true);
                    try {
                      await api.updateScheduleStatus(selected.schedule_id, "in_progress");
                      setSelected({ ...selected, status: "in_progress" });
                      setTrips((prev) =>
                        prev.map((x) =>
                          x.schedule_id === selected.schedule_id ? { ...x, status: "in_progress" } : x
                        )
                      );
                      navigate("/driver/scan");
                    } catch (e) {
                      alert(e.message);
                    } finally {
                      setBusy(false);
                    }
                  } else {
                    navigate("/driver/scan");
                  }
                }}
                disabled={busy}
              >
                📷 สแกนต่อ
              </button>
            )}
            {selected.status === "planned" && (
              <button type="button" className="m-btn m-btn-primary" disabled={busy} onClick={() => setTripStatus("in_progress")}>
                ▶️ เริ่มเดินทาง
              </button>
            )}
            {selected.status === "in_progress" && (
              <button type="button" className="m-btn m-btn-outline" disabled={busy} onClick={() => setTripStatus("completed")}>
                ปิดรอบ
              </button>
            )}
            {selected.status !== "completed" && selected.status !== "cancelled" && (
              <button
                type="button"
                className="m-btn"
                style={{ background: "#fff", color: "#dc2626", border: "1.5px solid #fecaca" }}
                disabled={busy}
                onClick={() => setTripStatus("cancelled")}
              >
                ยกเลิกรอบ
              </button>
            )}
            <button type="button" className="m-btn m-btn-outline" onClick={() => setSelected(null)}>
              ← กลับหน้ารอบรถ
            </button>
          </div>
        </div>

        <DriverNav />
      </div>
    );
  }

  /* ========== หน้ารายการรอบ ========== */
  return (
    <div className="m-body driver-app">
      <div className="m-status">
        <span>{clk}</span>
        <span>Driver</span>
      </div>

      <header className="m-header rounded">
        <div className="row">
          <div>
            <h1>
              {user.first_name}
              {user.last_name}
            </h1>
            <p>
              {user.username || user.user_id} · {user.position_name || "คนขับรถ"}
            </p>
          </div>
          <button
            type="button"
            className="m-btn m-btn-ghost"
            onClick={() => {
              if (confirm("ออกจากระบบ?")) {
                clearUser();
                navigate("/");
              }
            }}
          >
            ออก
          </button>
        </div>
      </header>

      <div className="m-content">
        <div className="m-stat-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="m-stat">
            <div className="n">{trips.length}</div>
            <div className="l">รอบของฉัน</div>
          </div>
          <div className="m-stat">
            <div className="n">{nextTripPax}</div>
            <div className="l">ผู้โดยสารรอบถัดไป</div>
          </div>
        </div>

        {loading ? (
          <div className="m-empty">กำลังโหลด...</div>
        ) : trips.length === 0 ? (
          <div className="m-empty">
            <div className="big">🚌</div>
            ยังไม่มีรอบรถที่มอบหมาย
          </div>
        ) : (
          trips.map((t) => {
            const st = statusLabel(t.status);
            return (
              <div key={t.schedule_id} className="m-card trip-card-click" onClick={() => openTrip(t)}>
                <div className="drv-card-top">
                  <div className="drv-info">
                    <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                      {t.schedule_id} · {timeOnly(t.departure_time)} น.
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 4 }}>
                      {t.route?.route_name} · {t.vehicle?.plate_number}
                      {t.vehicle?.capacity ? ` (ตู้ ${t.vehicle.capacity} ที่)` : ""}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 4 }}>
                      👤 ผู้โดยสาร {t.seats_booked || 0}/{t.vehicle?.capacity || 0} คน
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#0d9488", marginTop: 8, fontWeight: 600 }}>แตะเพื่อดู →</div>
                  </div>
                  <span className={st.cls}>{st.text}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <DriverNav />
    </div>
  );
}

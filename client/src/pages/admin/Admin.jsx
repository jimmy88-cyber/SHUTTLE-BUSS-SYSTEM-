import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { getUser } from "../../api/auth";
import { getPermissionBits } from "../../permissions";
import AdminLayout from "../../components/AdminLayout";

export default function Admin() {
  const user = getUser();
  const permission = getPermissionBits(user?.permission, user?.position_id);
  const canViewBookings = permission[4] === "1";
  const canViewTrips = permission[3] === "1";
  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [trips, setTrips] = useState([]);

  useEffect(() => {
    api.getStats().then(setStats).catch(console.error);
    if (canViewBookings) {
      api.getBookings().then((b) => setBookings(b.slice(-5))).catch(console.error);
    }
    if (canViewTrips) {
      api.getSchedules()
        .then((s) =>
          setTrips(
            [...s]
              .sort((a, b) => new Date(a.departure_time) - new Date(b.departure_time))
              .slice(0, 5)
          )
        )
        .catch(console.error);
    }
  }, [canViewBookings, canViewTrips]);

  const cards = [
    { icon: "🎫", label: "การจองทั้งหมด", value: stats?.bookings ?? "—", color: "teal" },
    { icon: "📅", label: "รอบรถ (planned)", value: stats?.schedules ?? "—", color: "blue" },
    { icon: "🚌", label: "รถทั้งหมด", value: stats?.vehicles ?? "—", color: "amber" },
    { icon: "🧑‍🎓", label: "ผู้ใช้บริการ", value: stats?.passengers ?? "—", color: "rose" },
  ];

  return (
    <AdminLayout title="แดชบอร์ด" subtitle="ภาพรวมระบบจองรถรับส่ง MUT">
      {cards.length > 0 && (
        <div className="stats-grid">
          {cards.map((c) => (
            <div className="stat-card" key={c.label}>
              <div className={`stat-icon ${c.color}`}>{c.icon}</div>
              <div>
                <div className="stat-value">{c.value}</div>
                <div className="stat-label">{c.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(canViewBookings || canViewTrips) && (
        <div className="grid-2" style={{ marginTop: 20 }}>
          {canViewBookings && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">การจองล่าสุด</h2>
                <Link to="/admin/bookings" className="btn btn-outline btn-sm">
                  ดูทั้งหมด
                </Link>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>รหัส</th>
                      <th>ผู้จอง</th>
                      <th>เส้นทาง</th>
                      <th>สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", color: "#94a3b8" }}>
                          ยังไม่มีการจอง
                        </td>
                      </tr>
                    ) : (
                      bookings.map((b) => (
                        <tr key={b.booking_id}>
                          <td>{b.booking_id}</td>
                          <td>{b.user?.passenger_name || b.user?.user_id}</td>
                          <td>{b.route?.route_name}</td>
                          <td>
                            <span className={`badge badge-${b.status === "booked" ? "booked" : "cancelled"}`}>
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {canViewTrips && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">รอบรถใกล้เคียง</h2>
                <Link to="/admin/trips" className="btn btn-outline btn-sm">
                  จัดการ
                </Link>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>รหัส</th>
                      <th>เวลา</th>
                      <th>คนขับ</th>
                      <th>สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trips.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", color: "#94a3b8" }}>
                          ยังไม่มีรอบรถ
                        </td>
                      </tr>
                    ) : (
                      trips.map((t) => (
                        <tr key={t.schedule_id}>
                          <td>{t.schedule_id}</td>
                          <td>
                            {t.departure_time
                              ? new Date(t.departure_time).toLocaleString("th-TH", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "-"}
                          </td>
                          <td>{t.driver?.driver_name}</td>
                          <td>
                            <span className="badge badge-planned">{t.status}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}

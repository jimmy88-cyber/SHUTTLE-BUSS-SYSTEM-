import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import AdminLayout from "../../components/AdminLayout";

const TABS = [
  { id: 2, title: "รายงานที่ 2", desc: "สถิติการจองรายปี" },
  { id: 3, title: "รายงานที่ 3", desc: "พฤติกรรมผู้ใช้ตามช่วงวันที่" },
  { id: 7, title: "รายงานที่ 7", desc: "มอบหมายงานรถแต่ละประเภท" },
];
const MONTHS_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function inRange(iso, from, to) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  const a = from ? new Date(from + "T00:00:00").getTime() : -Infinity;
  const b = to ? new Date(to + "T23:59:59").getTime() : Infinity;
  return t >= a && t <= b;
}

function toBuddhistYear(iso) {
  if (!iso) return null;
  return new Date(iso).getFullYear() + 543;
}

/** กราฟแท่งแบบ Clustered (หลาย series) */
function ClusteredBarChart({ title, categories, series, height = 280 }) {
  // series: [{ name, color, values: number[] }]
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const pad = { top: 40, right: 20, bottom: 50, left: 48 };
  const w = Math.max(520, categories.length * 56);
  const h = height;
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const groupW = chartW / categories.length;
  const barGap = 2;
  const barW = Math.max(4, (groupW - 12) / series.length - barGap);

  const yTicks = 5;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((max * i) / yTicks));

  return (
    <div className="chart-box">
      <div className="chart-title">{title}</div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: w, display: "block", margin: "0 auto" }}>
        {/* grid */}
        {ticks.map((t) => {
          const y = pad.top + chartH - (t / max) * chartH;
          return (
            <g key={t}>
              <line x1={pad.left} x2={w - pad.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={pad.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">
                {t}
              </text>
            </g>
          );
        })}
        {/* bars */}
        {categories.map((cat, i) => {
          const gx = pad.left + i * groupW + 6;
          return (
            <g key={cat}>
              {series.map((s, si) => {
                const val = s.values[i] || 0;
                const bh = (val / max) * chartH;
                const x = gx + si * (barW + barGap);
                const y = pad.top + chartH - bh;
                return <rect key={s.name} x={x} y={y} width={barW} height={bh} fill={s.color} rx="2" />;
              })}
              <text
                x={gx + (series.length * (barW + barGap)) / 2}
                y={h - 28}
                textAnchor="middle"
                fontSize="11"
                fill="#475569"
              >
                {cat}
              </text>
            </g>
          );
        })}
        <text x={pad.left - 36} y={pad.top + chartH / 2} fontSize="11" fill="#64748b" transform={`rotate(-90 ${pad.left - 36} ${pad.top + chartH / 2})`}>
          จำนวนคน
        </text>
        <text x={w / 2} y={h - 8} textAnchor="middle" fontSize="11" fill="#64748b">
          {categories.length > 6 ? "เดือน / หมวด" : ""}
        </text>
      </svg>
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.name} className="legend-item">
            <span className="legend-swatch" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/** กราฟวงกลม Pie */
function PieChart({ title, slices }) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const size = 220;
  const r = 80;
  const cx = size / 2;
  const cy = size / 2;
  let angle = -Math.PI / 2;
  const paths = slices.map((s) => {
    const frac = s.value / total;
    const start = angle;
    const end = angle + frac * Math.PI * 2;
    angle = end;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const large = frac > 0.5 ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    return { ...s, d };
  });

  return (
    <div className="chart-box">
      <div className="chart-title">{title}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {paths.map((p) => (
            <path key={p.name} d={p.d} fill={p.color} stroke="#fff" strokeWidth="2" />
          ))}
        </svg>
        <div className="chart-legend" style={{ flexDirection: "column", alignItems: "flex-start" }}>
          {slices.map((s) => (
            <span key={s.name} className="legend-item">
              <span className="legend-swatch" style={{ background: s.color }} />
              {s.name} ({s.value})
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminReports() {
  const [tab, setTab] = useState(2);
  const [year, setYear] = useState("");
  const [dataType, setDataType] = useState("all");
  const [dateFrom3, setDateFrom3] = useState("");
  const [dateTo3, setDateTo3] = useState("");
  const [dateFrom7, setDateFrom7] = useState("");
  const [dateTo7, setDateTo7] = useState("");
  const [type7, setType7] = useState("all");
  const [shown, setShown] = useState(false);

  const [bookings, setBookings] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [boarding, setBoarding] = useState([]);
  const [vehicleTypes, setVehicleTypes] = useState([]);

  useEffect(() => {
    Promise.all([
      api.getBookings().catch(() => []),
      api.getSchedules().catch(() => []),
      api.getVehicles().catch(() => []),
      api.getBoarding().catch(() => []),
      api.getVehicleTypes().catch(() => []),
    ]).then(([b, s, v, br, vt]) => {
      setBookings(b);
      setSchedules(s);
      setVehicles(v);
      setBoarding(br);
      setVehicleTypes(vt);
    });
  }, []);

  const boardedIds = useMemo(() => new Set(boarding.map((x) => x.booking_id)), [boarding]);

  const report2 = useMemo(() => {
    const y = Number(year);
    const months = MONTHS_TH.map((name) => ({
      month: name, bookings: 0, seats: 0, cancel: 0, checkin: 0, noshow: 0,
    }));
    if (!year) return { months, totals: { bookings: 0, seats: 0, cancel: 0, checkin: 0, noshow: 0 } };

    for (const b of bookings) {
      const by = toBuddhistYear(b.booked_at || b.schedule?.departure_time);
      if (by !== y) continue;
      const m = new Date(b.booked_at || b.schedule?.departure_time).getMonth();
      const row = months[m];
      if (!row) continue;
      if (b.status === "cancelled") {
        row.cancel += 1;
        row.bookings += 1;
        row.seats += Number(b.num_seats) || 0;
      } else {
        row.bookings += 1;
        row.seats += Number(b.num_seats) || 0;
        if (boardedIds.has(b.booking_id)) row.checkin += 1;
        else row.noshow += 1;
      }
    }
    const totals = months.reduce(
      (a, r) => ({
        bookings: a.bookings + r.bookings,
        seats: a.seats + r.seats,
        cancel: a.cancel + r.cancel,
        checkin: a.checkin + r.checkin,
        noshow: a.noshow + r.noshow,
      }),
      { bookings: 0, seats: 0, cancel: 0, checkin: 0, noshow: 0 }
    );
    return { months, totals };
  }, [bookings, boardedIds, year]);

  const report3 = useMemo(() => {
    const filtered = bookings.filter((b) =>
      inRange(b.booked_at || b.schedule?.departure_time, dateFrom3, dateTo3)
    );
    const byUser = {};
    for (const b of filtered) {
      const name = b.user?.passenger_name || `User ${b.user?.user_id || "-"}`;
      if (!byUser[name]) byUser[name] = { name, total: 0, checkin: 0, cancel: 0, noshow: 0 };
      byUser[name].total += 1;
      if (b.status === "cancelled") byUser[name].cancel += 1;
      else if (boardedIds.has(b.booking_id)) byUser[name].checkin += 1;
      else byUser[name].noshow += 1;
    }
    const list = Object.values(byUser).sort((a, b) => b.total - a.total);
    const totals = list.reduce(
      (a, r) => ({
        total: a.total + r.total,
        checkin: a.checkin + r.checkin,
        cancel: a.cancel + r.cancel,
        noshow: a.noshow + r.noshow,
      }),
      { total: 0, checkin: 0, cancel: 0, noshow: 0 }
    );
    return { list, totals };
  }, [bookings, boardedIds, dateFrom3, dateTo3]);

  const report7 = useMemo(() => {
    const filtered = schedules.filter((s) => inRange(s.departure_time, dateFrom7, dateTo7));
    // รายละเอียด: ประเภท + ทะเบียน + จำนวนรอบ
    const detailMap = {};
    for (const s of filtered) {
      const v = vehicles.find(
        (x) => x.vehicle_id === s.vehicle?.vehicle_id || x.plate_number === s.vehicle?.plate_number
      );
      const typeName = v?.vehicle_type?.type_name || "ไม่ระบุ";
      if (type7 !== "all" && typeName !== type7) continue;
      const plate = v?.plate_number || s.vehicle?.plate_number || "-";
      const key = `${typeName}||${plate}`;
      if (!detailMap[key]) detailMap[key] = { type: typeName, plate, trips: 0 };
      detailMap[key].trips += 1;
    }
    const details = Object.values(detailMap).sort((a, b) => a.type.localeCompare(b.type) || b.trips - a.trips);

    // สรุปต่อประเภท
    const sumMap = {};
    for (const d of details) {
      if (!sumMap[d.type]) sumMap[d.type] = { type: d.type, trips: 0 };
      sumMap[d.type].trips += d.trips;
    }
    const summary = Object.values(sumMap);
    const grandTotal = summary.reduce((a, r) => a + r.trips, 0);
    return { details, summary, grandTotal };
  }, [schedules, vehicles, dateFrom7, dateTo7, type7]);

  function switchTab(id) {
    setTab(id);
    setShown(false);
  }

  const dateLabel3 =
    dateFrom3 && dateTo3
      ? `${dateFrom3} ถึง ${dateTo3}`
      : "";

  return (
    <AdminLayout title="ระบบรายงาน" subtitle="เลือกรายงานและปีที่ต้องการดูสถิติ">
      <div className="report-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`report-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => switchTab(t.id)}
          >
            <div style={{ fontWeight: 700 }}>{t.title}</div>
            <div style={{ fontSize: "0.75rem", opacity: 0.85, marginTop: 2 }}>{t.desc}</div>
          </button>
        ))}
      </div>

      {/* ===== รายงานที่ 2 ===== */}
      {tab === 2 && (
        <>
          <div className="filter-bar">
            <div className="form-group">
              <label className="form-label">เลือกปี</label>
              <select className="form-control" value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="">-- เลือกปี --</option>
                <option value="2567">2567</option>
                <option value="2568">2568</option>
                <option value="2569">2569</option>
              </select>
            </div>
            <div className="form-group" style={{ minWidth: 260 }}>
              <label className="form-label">ประเภทข้อมูล</label>
              <select className="form-control" value={dataType} onChange={(e) => setDataType(e.target.value)}>
                <option value="all">ทั้งหมด (จอง / ยกเลิก / Check-in / No Show)</option>
                <option value="checkin">เฉพาะ Check-in สำเร็จ</option>
                <option value="cancel">เฉพาะการยกเลิก</option>
                <option value="noshow">เฉพาะ No Show</option>
              </select>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (!year) {
                  alert("กรุณาเลือกปี");
                  return;
                }
                setShown(true);
              }}
            >
              แสดงรายงาน
            </button>
          </div>
          {!shown ? (
            <div className="empty-report">
              <div className="icon">📊</div>
              <p>
                เลือกปี แล้วกด <strong>แสดงรายงาน</strong>
              </p>
            </div>
          ) : (
            <>
              <div className="card" style={{ marginBottom: 16 }}>
                <h2 className="card-title" style={{ marginBottom: 16 }}>
                  สถิติการจอง ปี {year}
                </h2>
                <div className="report-summary-grid">
                  {[
                    ["🎫", report2.totals.bookings, "จำนวนการจอง", "#e0f2fe"],
                    ["💺", report2.totals.seats, "ที่นั่งที่ถูกจอง", "#dbeafe"],
                    ["✕", report2.totals.cancel, "การยกเลิก", "#fef3c7"],
                    ["✓", report2.totals.checkin, "Check-in สำเร็จ", "#dcfce7"],
                    ["👻", report2.totals.noshow, "No Show", "#fce7f3"],
                  ].map(([ico, val, label, bg]) => (
                    <div className="report-summary-card" key={label}>
                      <div className="rsc-icon" style={{ background: bg }}>
                        {ico}
                      </div>
                      <div>
                        <div className="rsc-value">{Number(val).toLocaleString()}</div>
                        <div className="rsc-label">{label}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="table-wrapper" style={{ marginTop: 20 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>เดือน</th>
                        <th>จำนวนการจอง</th>
                        <th>จำนวนที่นั่งที่ถูกจอง</th>
                        <th>การยกเลิก</th>
                        <th>Check-in สำเร็จ</th>
                        <th>No Show</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report2.months.map((r) => (
                        <tr key={r.month}>
                          <td>{r.month}</td>
                          <td>{r.bookings}</td>
                          <td>{r.seats}</td>
                          <td>{r.cancel}</td>
                          <td>{r.checkin}</td>
                          <td>{r.noshow}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <ClusteredBarChart
                title={`ปี ${year}\nCheck-in / ยกเลิก / No Show (Clustered)`}
                categories={MONTHS_TH}
                series={[
                  { name: "Check-in สำเร็จ", color: "#3b82f6", values: report2.months.map((m) => m.checkin) },
                  { name: "การยกเลิก", color: "#ef4444", values: report2.months.map((m) => m.cancel) },
                  { name: "No Show", color: "#22c55e", values: report2.months.map((m) => m.noshow) },
                ]}
              />
            </>
          )}
        </>
      )}

      {/* ===== รายงานที่ 3 ===== */}
      {tab === 3 && (
        <>
          <div className="filter-bar">
            <div className="form-group">
              <label className="form-label">วันเริ่มต้น</label>
              <input type="date" className="form-control" value={dateFrom3} onChange={(e) => setDateFrom3(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">วันสิ้นสุด</label>
              <input type="date" className="form-control" value={dateTo3} onChange={(e) => setDateTo3(e.target.value)} />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (!dateFrom3 || !dateTo3) {
                  alert("กรุณาเลือกวันเริ่มต้นและวันสิ้นสุด");
                  return;
                }
                setShown(true);
              }}
            >
              แสดงรายงาน
            </button>
          </div>
          {!shown ? (
            <div className="empty-report">
              <div className="icon">📅</div>
              <p>
                เลือกช่วงวันที่ แล้วกด <strong>แสดงรายงาน</strong>
                <br />
                ตัวอย่าง: 12 เมษายน 2568 – 15 เมษายน 2568
              </p>
            </div>
          ) : (
            <>
              <div className="card" style={{ marginBottom: 16 }}>
                <h2 className="card-title" style={{ marginBottom: 12 }}>
                  รายงานพฤติกรรมของผู้ใช้ในช่วงวันที่ {dateLabel3}
                </h2>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>ผู้ใช้</th>
                        <th>การจองทั้งหมด</th>
                        <th>ขึ้นรถจริง</th>
                        <th>ยกเลิก</th>
                        <th>No Show</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report3.list.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: "center", color: "#94a3b8" }}>
                            ไม่มีข้อมูลในช่วงวันที่นี้
                          </td>
                        </tr>
                      ) : (
                        report3.list.map((r) => (
                          <tr key={r.name}>
                            <td>{r.name}</td>
                            <td>{r.total}</td>
                            <td>{r.checkin}</td>
                            <td>{r.cancel}</td>
                            <td>{r.noshow}</td>
                          </tr>
                        ))
                      )}
                      {report3.list.length > 0 && (
                        <tr style={{ fontWeight: 700, background: "#f8fafc" }}>
                          <td>รวมทั้งหมด</td>
                          <td>{report3.totals.total}</td>
                          <td>{report3.totals.checkin}</td>
                          <td>{report3.totals.cancel}</td>
                          <td>{report3.totals.noshow}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {report3.list.length > 0 && (
                <>
                  <ClusteredBarChart
                    title={`พฤติกรรมผู้ใช้\n(${dateLabel3})`}
                    categories={report3.list.slice(0, 10).map((u) => u.name.split(" ")[0])}
                    series={[
                      { name: "การจองทั้งหมด", color: "#3b82f6", values: report3.list.slice(0, 10).map((u) => u.total) },
                      { name: "ขึ้นรถจริง", color: "#f59e0b", values: report3.list.slice(0, 10).map((u) => u.checkin) },
                      { name: "ยกเลิก", color: "#94a3b8", values: report3.list.slice(0, 10).map((u) => u.cancel) },
                      { name: "No Show", color: "#eab308", values: report3.list.slice(0, 10).map((u) => u.noshow) },
                    ]}
                    height={300}
                  />
                  <PieChart
                    title={`สัดส่วนรวม ลูกค้าทุกราย\n(${dateLabel3})`}
                    slices={[
                      { name: "ขึ้นรถจริง", value: report3.totals.checkin, color: "#3b82f6" },
                      { name: "ยกเลิก", value: report3.totals.cancel, color: "#f59e0b" },
                      { name: "No Show", value: report3.totals.noshow, color: "#94a3b8" },
                    ]}
                  />
                </>
              )}
            </>
          )}
        </>
      )}

      {/* ===== รายงานที่ 7 ===== */}
      {tab === 7 && (
        <>
          <div className="filter-bar">
            <div className="form-group">
              <label className="form-label">วันเริ่มต้น</label>
              <input type="date" className="form-control" value={dateFrom7} onChange={(e) => setDateFrom7(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">วันสิ้นสุด</label>
              <input type="date" className="form-control" value={dateTo7} onChange={(e) => setDateTo7(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">ประเภทรถ</label>
              <select className="form-control" value={type7} onChange={(e) => setType7(e.target.value)}>
                <option value="all">ทุกประเภท</option>
                {vehicleTypes.map((t) => (
                  <option key={t.vehicle_type_id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (!dateFrom7 || !dateTo7) {
                  alert("กรุณาเลือกวันเริ่มต้นและวันสิ้นสุด");
                  return;
                }
                setShown(true);
              }}
            >
              แสดงรายงาน
            </button>
          </div>
          {!shown ? (
            <div className="empty-report">
              <div className="icon">🚌</div>
              <p>
                เลือกช่วงวันที่ แล้วกด <strong>แสดงรายงาน</strong>
                <br />
                ตัวอย่าง: 1 – 30 เมษายน 2568
              </p>
            </div>
          ) : (
            <div className="card">
              <h2 className="card-title" style={{ marginBottom: 12 }}>
                รายงานจำนวนการมอบหมายงานให้รถแต่ละประเภทในช่วง {dateFrom7} – {dateTo7}
              </h2>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>ประเภท</th>
                      <th>รถ (ทะเบียน)</th>
                      <th>จำนวนรอบ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report7.details.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ textAlign: "center", color: "#94a3b8" }}>
                          ไม่มีรอบรถในช่วงวันที่นี้
                        </td>
                      </tr>
                    ) : (
                      report7.details.map((r) => (
                        <tr key={r.type + r.plate}>
                          <td>{r.type}</td>
                          <td>{r.plate}</td>
                          <td>{r.trips}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {report7.summary.length > 0 && (
                <>
                  <h3 style={{ margin: "24px 0 12px", fontSize: "1rem", color: "#334155" }}>
                    สรุปแต่ละประเภทมีรอบรวมดังนี้
                  </h3>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>ประเภท</th>
                          <th>สรุป</th>
                          <th>จำนวนรอบรวม</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report7.summary.map((r) => (
                          <tr key={r.type}>
                            <td>{r.type}</td>
                            <td>รวม{r.type}</td>
                            <td>{r.trips}</td>
                          </tr>
                        ))}
                        <tr style={{ fontWeight: 700, background: "#f8fafc" }}>
                          <td colSpan={2}>รวมทั้งหมด</td>
                          <td>{report7.grandTotal}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}

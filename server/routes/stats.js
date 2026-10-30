/* STATS, HEALTH & REPORTS (Oracle SQL แบบง่าย SELECT / FROM / WHERE) */

const express = require("express");
const router = express.Router();
const { withDb, one, all } = require("../config/db");
const { err } = require("../utils/helpers");

router.get("/api/stats", async (_req, res) => {
  try {
    await withDb(async (conn) => {
      const [b, s, v, u, br] = await Promise.all([
        one(conn, `SELECT COUNT(*) c FROM Booking`),
        one(conn, `SELECT COUNT(*) c FROM Schedule WHERE status='planned'`),
        one(conn, `SELECT COUNT(*) c FROM Vehicle`),
        one(conn, `SELECT COUNT(*) c FROM AppUser WHERE user_type='passenger'`),
        one(conn, `SELECT COUNT(*) c FROM BoardingRecord`),
      ]);
      res.json({
        bookings: b.C,
        schedules: s.C,
        vehicles: v.C,
        passengers: u.C,
        boarding: br.C,
      });
    });
  } catch (e) {
    err(res, e);
  }
});

router.get("/api/health", async (_req, res) => {
  try {
    await withDb(async (conn) => {
      await one(conn, `SELECT 1 ok FROM dual`);
      res.json({ status: "ok", db: "connected", time: new Date().toISOString() });
    });
  } catch (e) {
    res.status(500).json({ status: "error", db: "disconnected", error: e.message });
  }
});


router.get("/api/reports/yearly", async (req, res) => {
  try {
    const year = Number(req.query.year);
    if (!year) return res.status(400).json({ message: "กรุณาระบุ year" });

    await withDb(async (conn) => {
      const sql = `
        SELECT EXTRACT(MONTH FROM Booking.booked_at) AS month_no,
               COUNT(*) AS bookings,
               NVL(SUM(Booking.num_seats), 0) AS seats,
               SUM(CASE WHEN Booking.status = 'cancelled' THEN 1 ELSE 0 END) AS cancel,
               SUM(CASE
                     WHEN Booking.status <> 'cancelled'
                      AND EXISTS (
                        SELECT 1 FROM BoardingRecord br
                        WHERE br.booking_id = Booking.booking_id
                      )
                     THEN 1 ELSE 0
                   END) AS checkin,
               SUM(CASE
                     WHEN Booking.status <> 'cancelled'
                      AND NOT EXISTS (
                        SELECT 1 FROM BoardingRecord br
                        WHERE br.booking_id = Booking.booking_id
                      )
                     THEN 1 ELSE 0
                   END) AS noshow
        FROM Booking
        WHERE EXTRACT(YEAR FROM Booking.booked_at) = :year
        GROUP BY EXTRACT(MONTH FROM Booking.booked_at)
        ORDER BY month_no
      `;
      const rows = await all(conn, sql, { year });

      const months = Array.from({ length: 12 }, (_, i) => ({
        month_no: i + 1,
        bookings: 0,
        seats: 0,
        cancel: 0,
        checkin: 0,
        noshow: 0,
      }));

      for (const r of rows) {
        const i = Number(r.MONTH_NO) - 1;
        if (i < 0 || i > 11) continue;
        months[i] = {
          month_no: Number(r.MONTH_NO),
          bookings: Number(r.BOOKINGS) || 0,
          seats: Number(r.SEATS) || 0,
          cancel: Number(r.CANCEL) || 0,
          checkin: Number(r.CHECKIN) || 0,
          noshow: Number(r.NOSHOW) || 0,
        };
      }

      const totals = months.reduce(
        (a, m) => ({
          bookings: a.bookings + m.bookings,
          seats: a.seats + m.seats,
          cancel: a.cancel + m.cancel,
          checkin: a.checkin + m.checkin,
          noshow: a.noshow + m.noshow,
        }),
        { bookings: 0, seats: 0, cancel: 0, checkin: 0, noshow: 0 }
      );

      res.json({ year, months, totals });
    });
  } catch (e) {
    err(res, e);
  }
});

router.get("/api/reports/behavior", async (req, res) => {
  try {
    const from = req.query.from;
    const to = req.query.to;
    if (!from || !to) return res.status(400).json({ message: "กรุณาระบุ from และ to (YYYY-MM-DD)" });

    await withDb(async (conn) => {
      const sql = `
        SELECT AppUser.first_name || ' ' || AppUser.last_name AS passenger_name,
               COUNT(*) AS total,
               SUM(CASE WHEN Booking.status = 'cancelled' THEN 1 ELSE 0 END) AS cancel,
               SUM(CASE
                     WHEN Booking.status <> 'cancelled'
                      AND EXISTS (
                        SELECT 1 FROM BoardingRecord br
                        WHERE br.booking_id = Booking.booking_id
                      )
                     THEN 1 ELSE 0
                   END) AS checkin,
               SUM(CASE
                     WHEN Booking.status <> 'cancelled'
                      AND NOT EXISTS (
                        SELECT 1 FROM BoardingRecord br
                        WHERE br.booking_id = Booking.booking_id
                      )
                     THEN 1 ELSE 0
                   END) AS noshow
        FROM Booking, AppUser
        WHERE Booking.user_id = AppUser.user_id
          AND Booking.booked_at >= TO_TIMESTAMP(:from_dt, 'YYYY-MM-DD HH24:MI:SS')
          AND Booking.booked_at <= TO_TIMESTAMP(:to_dt,   'YYYY-MM-DD HH24:MI:SS')
        GROUP BY AppUser.first_name, AppUser.last_name
        ORDER BY total DESC
      `;
      const rows = await all(conn, sql, {
        from_dt: `${from} 00:00:00`,
        to_dt: `${to} 23:59:59`,
      });

      const list = rows.map((r) => ({
        name: r.PASSENGER_NAME || "-",
        total: Number(r.TOTAL) || 0,
        checkin: Number(r.CHECKIN) || 0,
        cancel: Number(r.CANCEL) || 0,
        noshow: Number(r.NOSHOW) || 0,
      }));

      const totals = list.reduce(
        (a, r) => ({
          total: a.total + r.total,
          checkin: a.checkin + r.checkin,
          cancel: a.cancel + r.cancel,
          noshow: a.noshow + r.noshow,
        }),
        { total: 0, checkin: 0, cancel: 0, noshow: 0 }
      );

      res.json({ from, to, list, totals });
    });
  } catch (e) {
    err(res, e);
  }
});

router.get("/api/reports/vehicles", async (req, res) => {
  try {
    const from = req.query.from;
    const to = req.query.to;
    const type = req.query.type || "all";
    if (!from || !to) return res.status(400).json({ message: "กรุณาระบุ from และ to (YYYY-MM-DD)" });

    await withDb(async (conn) => {
      let sql = `
        SELECT VehicleType.name AS type_name,
               Vehicle.plate_number,
               COUNT(*) AS trips
        FROM Schedule, Vehicle, VehicleType
        WHERE Schedule.vehicle_id = Vehicle.vehicle_id
          AND Vehicle.vehicle_type_id = VehicleType.vehicle_type_id
          AND Schedule.departure_time >= TO_TIMESTAMP(:from_dt, 'YYYY-MM-DD HH24:MI:SS')
          AND Schedule.departure_time <= TO_TIMESTAMP(:to_dt,   'YYYY-MM-DD HH24:MI:SS')
      `;
      const binds = {
        from_dt: `${from} 00:00:00`,
        to_dt: `${to} 23:59:59`,
      };
      if (type && type !== "all") {
        sql += ` AND VehicleType.name = :type_name`;
        binds.type_name = type;
      }
      sql += `
        GROUP BY VehicleType.name, Vehicle.plate_number
        ORDER BY VehicleType.name, trips DESC
      `;

      const rows = await all(conn, sql, binds);

      const details = rows.map((r) => ({
        type: r.TYPE_NAME || "ไม่ระบุ",
        plate: r.PLATE_NUMBER || "-",
        trips: Number(r.TRIPS) || 0,
      }));

      const sumMap = {};
      for (const d of details) {
        if (!sumMap[d.type])  sumMap[d.type] = { type: d.type, trips: 0 };
        sumMap[d.type].trips += d.trips;
      }
      const summary = Object.values(sumMap);
      const grandTotal = summary.reduce((a, r) => a + r.trips, 0);

      res.json({ from, to, type, details, summary, grandTotal });
    });
  } catch (e) {
    err(res, e);
  }
});

module.exports = router;

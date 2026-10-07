/* BOOKINGS – การจองที่นั่ง */

const express = require("express");
const router = express.Router();
const { withDb, q, one, all } = require("../config/db");
const { err, BOOKING_SQL, SCHEDULE_SQL, mapBooking, seatsBooked, capacityOf, iso } = require("../utils/helpers");
router.get("/api/bookings", async (req, res) => {
  try {
    await withDb(async (conn) => {
      let sql = BOOKING_SQL;
      const binds = {};
      const w = [];
      if (req.query.user_id) {
        w.push("Booking.user_id = :user_id");
        binds.user_id = Number(req.query.user_id);
      }
      if (req.query.schedule_id) {
        w.push("Booking.schedule_id = :schedule_id");
        binds.schedule_id = req.query.schedule_id;
      }
      if (w.length) sql += " AND " + w.join(" AND ");
      sql += " ORDER BY Booking.booked_at DESC";
      res.json((await all(conn, sql, binds)).map(mapBooking));
    });
  } catch (e) {
    err(res, e);
  }
});

router.get("/api/bookings/by-qr/:qr", async (req, res) => {
  try {
    await withDb(async (conn) => {
      const seed = await one(
        conn,
        BOOKING_SQL + ` AND (Booking.qr_code = :qr OR Booking.booking_id = :qr)
                        AND Booking.status IN ('booked', 'checked_in')`,
        { qr: req.params.qr }
      );
      if (!seed) return res.status(404).json({ message: "ไม่พบ QR นี้" });
      const rows = await all(
        conn,
        BOOKING_SQL + ` AND Booking.user_id = :user_id
                        AND Booking.schedule_id = :schedule_id
                        AND Booking.status IN ('booked', 'checked_in')
                        ORDER BY Booking.booking_id`,
        { user_id: seed.USER_ID, schedule_id: seed.SCHEDULE_ID }
      );
      res.json({ bookings: rows.map(mapBooking) });
    });
  } catch (e) {
    err(res, e);
  }
});

// รับได้ทั้ง dropoff_stop_id (ทุกคนลงจุดเดียว) หรือ dropoff_stop_ids (จุดลงของผู้โดยสารแต่ละคน)
// ผู้โดยสารที่ลงจุดเดียวกันจะรวมเป็น booking เดียว ทุก booking บันทึกใน transaction เดียวกัน
router.post("/api/bookings", async (req, res) => {
  try {
    const { user_id, schedule_id, pickup_stop_id, dropoff_stop_id, dropoff_stop_ids, num_seats } = req.body;
    const seats = Number(num_seats);
    const drops = (Array.isArray(dropoff_stop_ids) ? dropoff_stop_ids : Array(seats).fill(dropoff_stop_id)).map(Number);
    if (!user_id || !schedule_id || !pickup_stop_id || !seats || drops.some((d) => !d)) {
      return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
    }
    if (seats < 1 || seats > 4) return res.status(400).json({ message: "จองได้ 1-4 ที่นั่งต่อครั้ง" });
    if (drops.length !== seats) return res.status(400).json({ message: "จำนวนจุดลงไม่ตรงกับจำนวนผู้โดยสาร" });
    const pickup = Number(pickup_stop_id);
    if (drops.includes(pickup)) return res.status(400).json({ message: "จุดขึ้น–ลงต้องต่างกัน" });

    await withDb(async (conn) => {
      await q(conn, `SELECT schedule_id FROM Schedule WHERE schedule_id=:id FOR UPDATE`, { id: schedule_id });
      const sch = await one(conn, SCHEDULE_SQL + ` AND Schedule.schedule_id = :id`, { id: schedule_id });
      if (!sch) return res.status(404).json({ message: "ไม่พบรอบรถ" });
      if (sch.STATUS === "completed") return res.status(400).json({ message: "รอบนี้ปิดรอบการจองแล้ว" });
      if (!["planned", "in_progress"].includes(sch.STATUS)) {
        return res.status(400).json({ message: "รอบนี้ไม่เปิดจอง" });
      }

      // ผู้ใช้ 1 คนจองได้รวมไม่เกิน 4 ที่นั่งต่อรอบ (นับทุกการจองที่ยังไม่ยกเลิก)
      const mine = (
        await one(
          conn,
          `SELECT NVL(SUM(num_seats),0) n FROM Booking
           WHERE user_id=:u AND schedule_id=:s AND status='booked'`,
          { u: Number(user_id), s: schedule_id }
        )
      ).N;
      if (mine >= 4) return res.status(400).json({ message: "ไม่สามารถจองได้อีก ครบ4ที่นั่งแล้ว" });
      if (mine + seats > 4) {
        return res.status(400).json({ message: `จองได้อีกเพียง ${4 - mine} ที่นั่ง (รอบนี้จองไว้แล้ว ${mine} ที่)` });
      }

      const capacity = await capacityOf(conn, sch.VEHICLE_ID);
      const available = capacity - (await seatsBooked(conn, schedule_id));
      if (seats > available) return res.status(400).json({ message: `ที่นั่งไม่พอ (ว่าง ${available})` });

      const routeStops = (
        await all(conn, `SELECT DISTINCT stop_id FROM RouteStop WHERE route_id=:r`, { r: sch.ROUTE_ID })
      ).map((r) => r.STOP_ID);
      if (![pickup, ...drops].every((s) => routeStops.includes(s))) {
        return res.status(400).json({ message: "จุดจอดไม่อยู่ในเส้นทางนี้" });
      }

      const groups = new Map();
      for (const d of drops) groups.set(d, (groups.get(d) || 0) + 1);

      const next = await one(conn, `SELECT NVL(MAX(TO_NUMBER(booking_id)),0)+1 id FROM Booking`);
      const bookings = [];
      const existingQr = await one(
        conn,
        `SELECT MAX(qr_code) qr_code FROM Booking
         WHERE user_id=:user_id AND schedule_id=:schedule_id
           AND status IN ('booked', 'checked_in')`,
        { user_id: Number(user_id), schedule_id }
      );
      const qr_code = existingQr.QR_CODE || `MUT-${Number(user_id)}-${schedule_id}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      let n = next.ID;
      try {
        await q(
          conn,
          `UPDATE Booking SET qr_code=:qr_code
           WHERE user_id=:user_id AND schedule_id=:schedule_id
             AND status IN ('booked', 'checked_in')`,
          { qr_code, user_id: Number(user_id), schedule_id }
        );
        for (const [dropoff, count] of groups) {
          const booking_id = String(n++).padStart(4, "0");
          await conn.execute(
            `INSERT INTO Booking (booking_id,user_id,schedule_id,pickup_stop_id,dropoff_stop_id,num_seats,status,qr_code,booked_at)
             VALUES (:booking_id,:user_id,:schedule_id,:pickup,:dropoff,:num_seats,'booked',:qr_code,SYSTIMESTAMP)`,
            { booking_id, user_id: Number(user_id), schedule_id, pickup, dropoff, num_seats: count, qr_code },
            { autoCommit: false }
          );
          bookings.push({ booking_id, dropoff, num_seats: count, qr_code });
        }
        await conn.commit();
      } catch (e) {
        await conn.rollback().catch(() => {});
        throw e;
      }

      const names = Object.fromEntries(
        (await all(conn, `SELECT stop_id, name FROM Stop`)).map((s) => [s.STOP_ID, s.NAME])
      );
      const result = bookings.map((b) => ({
        booking_id: b.booking_id,
        num_seats: b.num_seats,
        status: "booked",
        qr_code: b.qr_code,
        booked_at: new Date().toISOString(),
        user: { user_id: Number(user_id) },
        schedule: { schedule_id, departure_time: iso(sch.DEPARTURE_TIME) },
        route: { route_name: sch.ROUTE_NAME },
        vehicle: { plate_number: sch.PLATE_NUMBER, capacity },
        driver: { driver_name: sch.DRIVER_NAME },
        pickup: { stop_id: pickup, stop_name: names[pickup] },
        dropoff: { stop_id: b.dropoff, stop_name: names[b.dropoff] },
      }));

      res.status(201).json({
        message: "จองสำเร็จ",
        booking: result[0],
        bookings: result,
        seats_available: available - seats,
      });
    });
  } catch (e) {
    err(res, e);
  }
});

router.patch("/api/bookings/:id/cancel", async (req, res) => {
  try {
    await withDb(async (conn) => {
      const b = await one(
        conn,
        `SELECT status, (SELECT COUNT(*) FROM BoardingRecord WHERE booking_id=:id) boarded
         FROM Booking WHERE booking_id=:id`,
        { id: req.params.id }
      );
      if (!b) return res.status(404).json({ message: "ไม่พบการจอง" });
      if (b.STATUS !== "booked") return res.status(400).json({ message: "ยกเลิกได้เฉพาะสถานะจองแล้ว" });
      if (b.BOARDED > 0) return res.status(400).json({ message: "ขึ้นรถแล้ว ไม่สามารถยกเลิกได้" });
      await q(conn, `UPDATE Booking SET status='cancelled' WHERE booking_id=:id`, { id: req.params.id });
      res.json({ message: "ยกเลิกการจองแล้ว", booking_id: req.params.id });
    });
  } catch (e) {
    err(res, e);
  }
});


module.exports = router;

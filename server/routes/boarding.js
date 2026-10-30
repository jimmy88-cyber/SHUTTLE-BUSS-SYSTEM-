/* BOARDING – บันทึกขึ้นรถ */

const express = require("express");
const router = express.Router();
const { withDb, q, one, all } = require("../config/db");
const { err, iso } = require("../utils/helpers");

router.post("/api/boarding", async (req, res) => {
  try {
    const { booking_id, schedule_id, stop_id, scanned_by } = req.body;
    await withDb(async (conn) => {
      const b = await one(conn, `SELECT status FROM Booking WHERE booking_id=:id`, { id: booking_id });
      if (!b || b.STATUS !== "booked") return res.status(400).json({ message: "ไม่พบการจองที่ใช้งานได้" });
      const next = await one(conn, `SELECT NVL(MAX(TO_NUMBER(boarding_id)),0)+1 id FROM BoardingRecord`);
      const boarding_id = String(next.ID).padStart(4, "0");
      await q(
        conn,
        `INSERT INTO BoardingRecord VALUES (:boarding_id,:booking_id,:schedule_id,:stop_id,:scanned_by,SYSTIMESTAMP)`,
        {
          boarding_id,
          booking_id,
          schedule_id,
          stop_id: Number(stop_id),
          scanned_by: Number(scanned_by),
        }
      );
      res.status(201).json({ message: "บันทึกขึ้นรถสำเร็จ", record: { boarding_id, booking_id, schedule_id, stop_id, scanned_by } });
    });
  } catch (e) {
    err(res, e);
  }
});

router.get("/api/boarding", async (_req, res) => {
  try {
    await withDb(async (conn) => {
      const rows = await all(
        conn,
        `SELECT BoardingRecord.boarding_id, BoardingRecord.booking_id, BoardingRecord.schedule_id,
                BoardingRecord.stop_id, BoardingRecord.scanned_by, BoardingRecord.scanned_at,
                Stop.name stop_name,
                AppUser.first_name||' '||AppUser.last_name scanned_by_name,
                Booking.num_seats, Booking.qr_code,
                (SELECT first_name||' '||last_name FROM AppUser WHERE user_id = Booking.user_id) passenger_name
         FROM BoardingRecord, Stop, AppUser, Booking
         WHERE BoardingRecord.stop_id = Stop.stop_id
           AND BoardingRecord.scanned_by = AppUser.user_id
           AND BoardingRecord.booking_id = Booking.booking_id
         ORDER BY BoardingRecord.scanned_at DESC`
      );
      res.json(
        rows.map((r) => ({
          boarding_id: r.BOARDING_ID,
          booking_id: r.BOOKING_ID,
          schedule_id: r.SCHEDULE_ID,
          qr_code: r.QR_CODE,
          num_seats: r.NUM_SEATS,
          scanned_at: iso(r.SCANNED_AT),
          stop: {
            stop_id: r.STOP_ID,
            stop_name: r.STOP_NAME,
          },
          passenger: {
            passenger_name: r.PASSENGER_NAME,
          },
          scanned_by_user: {
            user_id: r.SCANNED_BY,
            driver_name: r.SCANNED_BY_NAME,
          },
        }))
      );
    });
  } catch (e) {
    err(res, e);
  }
});


module.exports = router;

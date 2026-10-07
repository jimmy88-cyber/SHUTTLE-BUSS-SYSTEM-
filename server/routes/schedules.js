/* SCHEDULES – รอบรถ */

const express = require("express");
const router = express.Router();
const { withDb, q, one, all } = require("../config/db");
const { err, SCHEDULE_SQL, mapSchedule } = require("../utils/helpers");

router.get("/api/schedules", async (req, res) => {
  try {
    await withDb(async (conn) => {
      let sql = SCHEDULE_SQL;
      const binds = {};
      const w = [];
      if (req.query.route_id) {
        w.push("Schedule.route_id = :route_id");
        binds.route_id = req.query.route_id;
      }
      if (req.query.driver_id) {
        w.push("Schedule.driver_id = :driver_id");
        binds.driver_id = Number(req.query.driver_id);
      }
      if (w.length) sql += " AND " + w.join(" AND ");
      sql += " ORDER BY Schedule.departure_time";
      const rows = await all(conn, sql, binds);
      res.json(await Promise.all(rows.map((r) => mapSchedule(conn, r))));
    });
  } catch (e) {
    err(res, e);
  }
});

router.get("/api/schedules/:id", async (req, res) => {
  try {
    await withDb(async (conn) => {
      const row = await one(conn, SCHEDULE_SQL + ` AND Schedule.schedule_id = :id`, { id: req.params.id });
      if (!row) return res.status(404).json({ message: "ไม่พบรอบรถ" });
      res.json(await mapSchedule(conn, row));
    });
  } catch (e) {
    err(res, e);
  }
});

router.post("/api/schedules", async (req, res) => {
  try {
    const { schedule_id, departure_time, driver_id, vehicle_id, route_id, status } = req.body;
    if (!schedule_id || !departure_time || !driver_id || !vehicle_id || !route_id) {
      return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
    }
    const dt = String(departure_time).replace("T", " ").replace(/\.\d+Z?$/, "").slice(0, 19);
    await withDb(async (conn) => {
      await q(
        conn,
        `INSERT INTO Schedule (schedule_id,departure_time,driver_id,vehicle_id,route_id,status)
         VALUES (:schedule_id, TO_TIMESTAMP(:dt,'YYYY-MM-DD HH24:MI:SS'), :driver_id,:vehicle_id,:route_id,:status)`,
        {
          schedule_id,
          dt,
          driver_id: Number(driver_id),
          vehicle_id,
          route_id,
          status: status || "planned",
        }
      );
      res.status(201).json({ message: "เพิ่มรอบรถสำเร็จ", schedule_id });
    });
  } catch (e) {
    err(res, e);
  }
});

router.patch("/api/schedules/:id/status", async (req, res) => {
  try {
    await withDb(async (conn) => {
      await q(conn, `UPDATE Schedule SET status=:status WHERE schedule_id=:id`, {
        status: req.body.status,
        id: req.params.id,
      });
      res.json({ message: "อัปเดตสถานะแล้ว" });
    });
  } catch (e) {
    err(res, e);
  }
});

router.put("/api/schedules/:id", async (req, res) => {
  try {
    const { departure_time, driver_id, vehicle_id, route_id, status } = req.body;
    if (!departure_time || !driver_id || !vehicle_id || !route_id) {
      return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
    }
    const dt = String(departure_time).replace("T", " ").replace(/\.\d+Z?$/, "").slice(0, 19);
    await withDb(async (conn) => {
      await q(
        conn,
        `UPDATE Schedule
            SET departure_time = TO_TIMESTAMP(:dt,'YYYY-MM-DD HH24:MI:SS'),
                driver_id = :driver_id,
                vehicle_id = :vehicle_id,
                route_id = :route_id,
                status = :status
          WHERE schedule_id = :id`,
        {
          dt,
          driver_id: Number(driver_id),
          vehicle_id,
          route_id,
          status: status || "planned",
          id: req.params.id,
        }
      );
      res.json({ message: "แก้ไขรอบรถสำเร็จ" });
    });
  } catch (e) {
    err(res, e);
  }
});

router.delete("/api/schedules/:id", async (req, res) => {
  try {
    await withDb(async (conn) => {
      const id = req.params.id;
      try { await q(conn, `DELETE FROM BoardingRecord WHERE schedule_id = :id`, { id }); } catch (_) {}
      try { await q(conn, `DELETE FROM Booking WHERE schedule_id = :id`, { id }); } catch (_) {}
      await q(conn, `DELETE FROM Schedule WHERE schedule_id = :id`, { id });
      res.json({ message: "ลบรอบรถสำเร็จ" });
    });
  } catch (e) {
    err(res, e);
  }
});


module.exports = router;

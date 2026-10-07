/* STATS & HEALTH */

const express = require("express");
const router = express.Router();
const { withDb, one } = require("../config/db");
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


module.exports = router;

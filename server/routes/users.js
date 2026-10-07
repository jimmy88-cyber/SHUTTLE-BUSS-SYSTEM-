/* USERS – ผู้ใช้บริการ (passenger) */

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { withDb, q, one, all } = require("../config/db");
const { err, normalizePermission } = require("../utils/helpers");

router.get("/api/users", async (req, res) => {
  try {
    await withDb(async (conn) => {
      let sql = `
        SELECT AppUser.user_id, AppUser.username, AppUser.first_name, AppUser.last_name, AppUser.email, AppUser.user_type,
               AppUser.department_id, AppUser.position_id,
               Department.name department_name, Position.name position_name, Position.permission
        FROM AppUser, Department, Position
        WHERE AppUser.department_id = Department.department_id(+)
          AND AppUser.position_id = Position.position_id(+)`;
      const binds = {};
      if (req.query.user_type) {
        sql += ` AND AppUser.user_type = :user_type`;
        binds.user_type = req.query.user_type;
      }
      sql += ` ORDER BY AppUser.user_id`;
      const rows = await all(conn, sql, binds);
      res.json(
        rows.map((r) => ({
          user_id: r.USER_ID,
          username: r.USERNAME,
          first_name: r.FIRST_NAME,
          last_name: r.LAST_NAME,
          email: r.EMAIL,
          user_type: r.USER_TYPE,
          department: {
            department_id: r.DEPARTMENT_ID,
            department_name: r.DEPARTMENT_NAME,
          },
          position: {
            position_id: r.POSITION_ID,
            position_name: r.POSITION_NAME,
            permission: normalizePermission(r.PERMISSION, r.POSITION_ID),
          },
        }))
      );
    });
  } catch (e) {
    err(res, e);
  }
});


router.post("/api/users", async (req, res) => {
  try {
    const { username, password, first_name, last_name, email } = req.body;
    if (!username || !first_name || !last_name) {
      return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
    }
    await withDb(async (conn) => {
      if (await one(conn, `SELECT user_id FROM AppUser WHERE username = :username`, { username })) {
        return res.status(400).json({ message: "ชื่อผู้ใช้นี้มีแล้ว" });
      }
      const next = await one(conn, `SELECT NVL(MAX(user_id), 0) + 1 id FROM AppUser`);
      const hash = await bcrypt.hash(String(password || "1234"), 10);
      await q(
        conn,
        `INSERT INTO AppUser (user_id, username, password, first_name, last_name, email, user_type)
         VALUES (:id, :username, :password, :first_name, :last_name, :email, 'passenger')`,
        {
          id: next.ID,
          username,
          password: hash,
          first_name,
          last_name,
          email: email || null,
        }
      );
      res.status(201).json({ message: "เพิ่มผู้ใช้บริการสำเร็จ", user_id: next.ID });
    });
  } catch (e) {
    err(res, e);
  }
});

router.put("/api/users/:id", async (req, res) => {
  try {
    const { first_name, last_name, email, password } = req.body;
    if (!first_name || !last_name) return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
    await withDb(async (conn) => {
      if (password) {
        const hash = await bcrypt.hash(String(password), 10);
        await q(
          conn,
          `UPDATE AppUser
              SET first_name = :first_name, last_name = :last_name, email = :email, password = :password
            WHERE user_id = :id`,
          {
            first_name, last_name,
            email: email || null,
            password: hash,
            id: Number(req.params.id),
          }
        );
      } else {
        await q(
          conn,
          `UPDATE AppUser
              SET first_name = :first_name, last_name = :last_name, email = :email
            WHERE user_id = :id`,
          {
            first_name, last_name,
            email: email || null,
            id: Number(req.params.id),
          }
        );
      }
      res.json({ message: "แก้ไขผู้ใช้บริการสำเร็จ" });
    });
  } catch (e) {
    err(res, e);
  }
});

router.delete("/api/users/:id", async (req, res) => {
  try {
    await withDb(async (conn) => {
      const id = Number(req.params.id);
      try { await q(conn, `DELETE FROM BoardingRecord WHERE booking_id IN (SELECT booking_id FROM Booking WHERE user_id = :id)`, { id }); } catch (_) {}
      try { await q(conn, `DELETE FROM Booking WHERE user_id = :id`, { id }); } catch (_) {}
      await q(conn, `DELETE FROM AppUser WHERE user_id = :id AND user_type = 'passenger'`, { id });
      res.json({ message: "ลบผู้ใช้บริการสำเร็จ" });
    });
  } catch (e) {
    err(res, e);
  }
});


module.exports = router;

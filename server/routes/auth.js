/* AUTH – login / register */

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { withDb, q, one } = require("../config/db");
const { checkPassword, normalizePermission, err } = require("../utils/helpers");

const USER_SQL = `SELECT AppUser.user_id, AppUser.username, AppUser.password, AppUser.first_name, AppUser.last_name, AppUser.email,
                AppUser.user_type, AppUser.department_id, AppUser.position_id,
                Position.name position_name, Position.permission
         FROM AppUser, Position
         WHERE AppUser.position_id = Position.position_id(+)`;

function mapUser(row) {
  return {
    user_id: row.USER_ID,
    username: row.USERNAME,
    first_name: row.FIRST_NAME,
    last_name: row.LAST_NAME,
    email: row.EMAIL,
    user_type: row.USER_TYPE,
    department_id: row.DEPARTMENT_ID,
    position_id: row.POSITION_ID,
    position_name: row.POSITION_NAME || (row.USER_TYPE === "passenger" ? "ผู้ใช้บริการ" : ""),
    permission: normalizePermission(row.PERMISSION, row.POSITION_ID),
  };
}

router.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" });

    await withDb(async (conn) => {
      const row = await one(
        conn,
        USER_SQL + ` AND (AppUser.username = :username OR AppUser.email = :username)`,
        { username }
      );
      if (!row || !(await checkPassword(password, row.PASSWORD))) {
        return res.status(401).json({ message: "รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
      }
      res.json({ message: "Login successful", user: mapUser(row) });
    });
  } catch (e) {
    err(res, e, "Login failed");
  }
});

/* ดึงตำแหน่งและสิทธิ์ล่าสุดของผู้ใช้ เพื่อให้สิทธิ์ที่แก้ไขมีผลทันทีโดยไม่ต้อง login ใหม่ */
router.get("/api/me/:id", async (req, res) => {
  try {
    await withDb(async (conn) => {
      const row = await one(conn, USER_SQL + ` AND AppUser.user_id = :id`, { id: req.params.id });
      if (!row) return res.status(404).json({ message: "ไม่พบผู้ใช้" });
      res.json({ user: mapUser(row) });
    });
  } catch (e) {
    err(res, e);
  }
});

router.post("/api/register", async (req, res) => {
  try {
    const { username, password, first_name, last_name, email } = req.body;
    if (!username || !password || !first_name || !last_name) {
      return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบ" });
    }
    await withDb(async (conn) => {
      if (await one(conn, `SELECT user_id FROM AppUser WHERE username=:username`, { username })) {
        return res.status(400).json({ message: "ชื่อผู้ใช้นี้ถูกใช้แล้ว" });
      }
      const next = await one(conn, `SELECT NVL(MAX(user_id),1000)+1 id FROM AppUser`);
      const hash = await bcrypt.hash(password, 10);
      await q(
        conn,
        `INSERT INTO AppUser (user_id,username,password,first_name,last_name,email,user_type)
         VALUES (:id,:username,:password,:first_name,:last_name,:email,'passenger')`,
        { id: next.ID, username, password: hash, first_name, last_name, email: email || null }
      );
      res.status(201).json({ message: "สมัครสมาชิกสำเร็จ", user_id: next.ID });
    });
  } catch (e) {
    err(res, e, "Register failed");
  }
});


module.exports = router;

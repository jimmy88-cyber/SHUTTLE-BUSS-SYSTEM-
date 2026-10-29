/* AUTH – ตรวจบัญชี Login, สมัครสมาชิก และดึงข้อมูลผู้ใช้/permission ล่าสุด
 * ระบบนี้ไม่มี endpoint สำหรับ Logout แยก เพราะ client ล้างสถานะใน browser */

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
  // แปลงคอลัมน์ฐานข้อมูลเป็น object ที่ client ใช้ รวม permission ของตำแหน่ง
  // รหัสผ่านไม่ถูกส่งกลับไปยัง client
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
    // ปฏิเสธคำขอที่ไม่มี username หรือ password ก่อนค้นฐานข้อมูล
    if (!username || !password) return res.status(400).json({ message: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" });

    await withDb(async (conn) => {
      // ค้นหาได้ทั้งจาก username หรือ email ด้วย bind variable
      const row = await one(
        conn,
        USER_SQL + ` AND (AppUser.username = :username OR AppUser.email = :username)`,
        { username }
      );
      // ไม่พบผู้ใช้หรือ password hash ไม่ตรง ให้ตอบ Unauthorized
      if (!row || !(await checkPassword(password, row.PASSWORD))) {
        return res.status(401).json({ message: "รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
      }
      // เมื่อผ่านการตรวจสอบ ส่งข้อมูลผู้ใช้และ permission กลับให้ client เลือกหน้า
      res.json({ message: "Login successful", user: mapUser(row) });
    });
  } catch (e) {
    err(res, e, "Login failed");
  }
});

/* ดึงข้อมูลบัญชี ตำแหน่ง และ permission ล่าสุดให้ client ซิงก์ระหว่างใช้งาน */
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
    // บังคับข้อมูลหลักที่จำเป็นต่อการสร้างบัญชีผู้ใช้บริการ
    if (!username || !password || !first_name || !last_name) {
      return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบ" });
    }
    await withDb(async (conn) => {
      // ป้องกันการสมัครซ้ำด้วย username ที่มีอยู่แล้ว
      if (await one(conn, `SELECT user_id FROM AppUser WHERE username=:username`, { username })) {
        return res.status(400).json({ message: "ชื่อผู้ใช้นี้ถูกใช้แล้ว" });
      }
      const next = await one(conn, `SELECT NVL(MAX(user_id),1000)+1 id FROM AppUser`);
      // เก็บ password เป็น hash ก่อนบันทึก และกำหนดบัญชีใหม่เป็น passenger
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

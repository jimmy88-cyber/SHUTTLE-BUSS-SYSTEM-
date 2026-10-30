/**
 * Shuttle Bus System – API Server
 * --------------------------------
 * Entry point: ตั้งค่า Express แล้ว mount route modules
 *
 * โครงสร้างโฟลเดอร์:
 *   config/db.js       – การเชื่อมต่อ Oracle DB
 *   utils/helpers.js   – ฟังก์ชันช่วยเหลือที่ใช้ร่วมกัน
 *   routes/            – แยก endpoint ตามกลุ่มงาน
 *     auth.js          – login / register
 *     master.js        – stops, routes, vehicles, positions, departments, employees
 *     schedules.js     – รอบรถ
 *     bookings.js      – การจอง
 *     boarding.js      – ขึ้นรถ
 *     users.js         – ผู้ใช้บริการ (passenger)
 *     stats.js         – สถิติ + health check
 */

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Route modules ----------
app.use(require("./routes/auth"));
app.use(require("./routes/master"));
app.use(require("./routes/schedules"));
app.use(require("./routes/bookings"));
app.use(require("./routes/boarding"));
app.use(require("./routes/users"));
app.use(require("./routes/stats"));

// ---------- Start ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Shuttle API → http://localhost:${PORT}`);
});

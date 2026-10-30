# Shuttle Bus System – Backend API

## โครงสร้างโฟลเดอร์ (จัดระเบียบแล้ว)

```
server/
├── server.js              # Entry point – ตั้งค่า Express + mount routes
├── package.json
├── .env                   # DB credentials (สร้างเอง)
├── config/
│   └── db.js              # Oracle connection, withDb, q/one/all
├── utils/
│   └── helpers.js         # normalizePermission, mapSchedule, mapBooking, err ฯลฯ
└── routes/
    ├── auth.js            # POST /api/login, /api/register
    ├── master.js          # stops, routes, vehicles, vehicle-types,
    │                      # positions, departments, employees
    ├── schedules.js       # รอบรถ (CRUD + status)
    ├── bookings.js        # การจอง + QR
    ├── boarding.js        # ขึ้นรถ
    ├── users.js           # ผู้ใช้บริการ (passenger)
    └── stats.js           # /api/stats, /api/health
```

## วิธีรัน

```bash
cd server
npm install
# สร้างไฟล์ .env ตามตัวอย่าง
npm start
```

### ตัวอย่าง `.env`

```
DB_USER=...
DB_PASSWORD=...
DB_HOST=...
DB_PORT=1521
DB_SERVICE=...
PORT=5000
```

## แนวทางแก้ไขโค้ด

| ต้องการแก้เรื่อง | เปิดไฟล์ |
|------------------|----------|
| Login / สมัครสมาชิก | `routes/auth.js` |
| รถ / เส้นทาง / พนักงาน | `routes/master.js` |
| รอบรถ | `routes/schedules.js` |
| การจองที่นั่ง | `routes/bookings.js` |
| สแกน QR ขึ้นรถ | `routes/boarding.js` |
| ผู้โดยสาร | `routes/users.js` |
| ฟังก์ชันช่วย / SQL ร่วม | `utils/helpers.js` |
| การเชื่อม DB | `config/db.js` |

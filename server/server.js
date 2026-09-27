const express = require("express");
const cors = require("cors");
const oracledb = require("oracledb");
const bcrypt = require("bcryptjs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = true;

const app = express();
app.use(cors());
app.use(express.json());

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString:
    process.env.DB_CONNECT_STRING ||
    `${process.env.DB_HOST}:${process.env.DB_PORT || 1521}/${process.env.DB_SERVICE}`,
};

// ---------- helpers ----------
async function withDb(fn) {
  const conn = await oracledb.getConnection(dbConfig);
  try {
    return await fn(conn);
  } finally {
    await conn.close().catch(() => {});
  }
}

const q = (conn, sql, binds = {}) => conn.execute(sql, binds);
const one = async (conn, sql, binds) => (await q(conn, sql, binds)).rows[0] || null;
const all = async (conn, sql, binds) => (await q(conn, sql, binds)).rows;

function iso(d) {
  return d ? new Date(d).toISOString() : null;
}

async function checkPassword(plain, stored) {
  stored = String(stored || "").trim();
  if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
    if (stored.length < 59) return false;
    return bcrypt.compare(plain, stored);
  }
  return stored === String(plain);
}

async function seatsBooked(conn, scheduleId) {
  const r = await one(
    conn,
    `SELECT NVL(SUM(num_seats),0) n FROM Booking WHERE schedule_id=:id AND status='booked'`,
    { id: scheduleId }
  );
  return r.N || 0;
}

async function capacityOf(conn, vehicleId) {
  const r = await one(
    conn,
    `SELECT VehicleType.capacity
     FROM Vehicle, VehicleType
     WHERE Vehicle.vehicle_type_id = VehicleType.vehicle_type_id
       AND Vehicle.vehicle_id = :id`,
    { id: vehicleId }
  );
  return r?.CAPACITY || 0;
}

const SCHEDULE_SQL = `
  SELECT Schedule.schedule_id, Schedule.departure_time, Schedule.driver_id,
         Schedule.vehicle_id, Schedule.route_id, Schedule.status,
         Route.name route_name, Route.total_minutes, Vehicle.plate_number,
         AppUser.first_name||' '||AppUser.last_name driver_name
  FROM Schedule, Route, Vehicle, AppUser
  WHERE Schedule.route_id = Route.route_id
    AND Schedule.vehicle_id = Vehicle.vehicle_id
    AND Schedule.driver_id = AppUser.user_id`;

async function mapSchedule(conn, s) {
  const capacity = await capacityOf(conn, s.VEHICLE_ID);
  const booked = await seatsBooked(conn, s.SCHEDULE_ID);
  return {
    schedule_id: s.SCHEDULE_ID,
    departure_time: iso(s.DEPARTURE_TIME),
    status: s.STATUS,
    seats_booked: booked,
    seats_available: Math.max(0, capacity - booked),
    route: {
      route_id: s.ROUTE_ID,
      route_name: s.ROUTE_NAME,
      total_minutes: s.TOTAL_MINUTES,
    },
    vehicle: {
      vehicle_id: s.VEHICLE_ID,
      plate_number: s.PLATE_NUMBER,
      capacity,
    },
    driver: {
      driver_id: s.DRIVER_ID,
      driver_name: s.DRIVER_NAME,
    },
  };
}

function mapBooking(r) {
  return {
    booking_id: r.BOOKING_ID,
    num_seats: r.NUM_SEATS,
    status: r.STATUS,
    qr_code: r.QR_CODE,
    booked_at: iso(r.BOOKED_AT),
    user: {
      user_id: r.USER_ID,
      passenger_name: r.PASSENGER_NAME,
    },
    schedule: {
      schedule_id: r.SCHEDULE_ID,
      departure_time: iso(r.DEPARTURE_TIME),
    },
    route: {
      route_name: r.ROUTE_NAME,
    },
    vehicle: {
      plate_number: r.PLATE_NUMBER,
    },
    driver: {
      driver_name: r.DRIVER_NAME,
    },
    pickup: {
      stop_id: r.PICKUP_STOP_ID,
      stop_name: r.PICKUP_NAME,
    },
    dropoff: {
      stop_id: r.DROPOFF_STOP_ID,
      stop_name: r.DROPOFF_NAME,
    },
  };
}

const BOOKING_SQL = `
  SELECT Booking.booking_id, Booking.user_id, Booking.schedule_id,
         Booking.pickup_stop_id, Booking.dropoff_stop_id,
         Booking.num_seats, Booking.status, Booking.qr_code, Booking.booked_at,
         Route.name route_name, Schedule.departure_time, Vehicle.plate_number,
         AppUser.first_name||' '||AppUser.last_name driver_name,
         (SELECT name FROM Stop WHERE stop_id = Booking.pickup_stop_id) pickup_name,
         (SELECT name FROM Stop WHERE stop_id = Booking.dropoff_stop_id) dropoff_name,
         (SELECT first_name||' '||last_name FROM AppUser WHERE user_id = Booking.user_id) passenger_name
  FROM Booking, Schedule, Route, Vehicle, AppUser
  WHERE Booking.schedule_id = Schedule.schedule_id
    AND Schedule.route_id = Route.route_id
    AND Schedule.vehicle_id = Vehicle.vehicle_id
    AND Schedule.driver_id = AppUser.user_id`;

function err(res, e, msg) {
  console.error(e);
  res.status(500).json({ message: msg || "เกิดข้อผิดพลาด", error: e.message });
}

// ---------- AUTH ----------
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" });

    await withDb(async (conn) => {
      const row = await one(
        conn,
        `SELECT AppUser.user_id, AppUser.username, AppUser.password, AppUser.first_name, AppUser.last_name, AppUser.email,
                AppUser.user_type, AppUser.department_id, AppUser.position_id,
                Position.name position_name, Position.permission
         FROM AppUser, Position
         WHERE AppUser.position_id = Position.position_id(+)
           AND (AppUser.username = :username OR AppUser.email = :username)`,
        { username }
      );
      if (!row || !(await checkPassword(password, row.PASSWORD))) {
        return res.status(401).json({ message: "รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
      }
      res.json({
        message: "Login successful",
        user: {
          user_id: row.USER_ID,
          username: row.USERNAME,
          first_name: row.FIRST_NAME,
          last_name: row.LAST_NAME,
          email: row.EMAIL,
          user_type: row.USER_TYPE,
          department_id: row.DEPARTMENT_ID,
          position_id: row.POSITION_ID,
          position_name: row.POSITION_NAME || (row.USER_TYPE === "passenger" ? "ผู้ใช้บริการ" : ""),
          permission: row.PERMISSION || "000000",
        },
      });
    });
  } catch (e) {
    err(res, e, "Login failed");
  }
});

app.post("/api/register", async (req, res) => {
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

// ---------- MASTER ----------
app.get("/api/stops", async (_req, res) => {
  try {
    await withDb(async (conn) => {
      const rows = await all(conn, `SELECT stop_id, name FROM Stop ORDER BY stop_id`);
      res.json(rows.map((r) => ({ stop_id: r.STOP_ID, name: r.NAME })));
    });
  } catch (e) {
    err(res, e);
  }
});

app.get("/api/routes", async (_req, res) => {
  try {
    await withDb(async (conn) => {
      const routes = await all(conn, `SELECT route_id, name, total_minutes FROM Route ORDER BY route_id`);
      const stops = await all(
        conn,
        `SELECT RouteStop.route_id, RouteStop.sequence_no, RouteStop.stop_id, RouteStop.minutes_from_prev,
                Stop.name stop_name
         FROM RouteStop, Stop
         WHERE RouteStop.stop_id = Stop.stop_id
         ORDER BY RouteStop.route_id, RouteStop.sequence_no`
      );
      const by = {};
      for (const s of stops) {
        (by[s.ROUTE_ID] ||= []).push({
          sequence_no: s.SEQUENCE_NO,
          stop_id: s.STOP_ID,
          stop_name: s.STOP_NAME,
          minutes_from_prev: s.MINUTES_FROM_PREV,
        });
      }
      res.json(
        routes.map((r) => ({
          route_id: r.ROUTE_ID,
          route_name: r.NAME,
          total_minutes: r.TOTAL_MINUTES,
          stops: by[r.ROUTE_ID] || [],
        }))
      );
    });
  } catch (e) {
    err(res, e);
  }
});

app.get("/api/vehicles", async (_req, res) => {
  try {
    await withDb(async (conn) => {
      const rows = await all(
        conn,
        `SELECT Vehicle.vehicle_id, Vehicle.plate_number, Vehicle.vehicle_type_id,
                VehicleType.name type_name, VehicleType.capacity
         FROM Vehicle, VehicleType
         WHERE Vehicle.vehicle_type_id = VehicleType.vehicle_type_id
         ORDER BY Vehicle.vehicle_id`
      );
      res.json(
        rows.map((r) => ({
          vehicle_id: r.VEHICLE_ID,
          plate_number: r.PLATE_NUMBER,
          vehicle_type: {
            vehicle_type_id: r.VEHICLE_TYPE_ID,
            type_name: r.TYPE_NAME,
            capacity: r.CAPACITY,
          },
        }))
      );
    });
  } catch (e) {
    err(res, e);
  }
});

app.post("/api/vehicles", async (req, res) => {
  try {
    const { vehicle_id, plate_number, vehicle_type_id } = req.body;
    if (!vehicle_id || !plate_number || !vehicle_type_id) {
      return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
    }
    await withDb(async (conn) => {
      await q(conn, `INSERT INTO Vehicle VALUES (:vehicle_id,:plate_number,:vehicle_type_id)`, {
        vehicle_id,
        plate_number,
        vehicle_type_id,
      });
      res.status(201).json({ message: "เพิ่มรถสำเร็จ", vehicle_id });
    });
  } catch (e) {
    err(res, e);
  }
});

app.delete("/api/vehicles/:id", async (req, res) => {
  try {
    await withDb(async (conn) => {
      await q(conn, `DELETE FROM Vehicle WHERE vehicle_id=:id`, { id: req.params.id });
      res.json({ message: "ลบรถสำเร็จ" });
    });
  } catch (e) {
    err(res, e);
  }
});

app.get("/api/vehicle-types", async (_req, res) => {
  try {
    await withDb(async (conn) => {
      const rows = await all(conn, `SELECT vehicle_type_id, name, capacity FROM VehicleType ORDER BY vehicle_type_id`);
      res.json(rows.map((r) => ({ vehicle_type_id: r.VEHICLE_TYPE_ID, name: r.NAME, capacity: r.CAPACITY })));
    });
  } catch (e) {
    err(res, e);
  }
});

app.get("/api/positions", async (_req, res) => {
  try {
    await withDb(async (conn) => {
      const rows = await all(conn, `SELECT position_id, name, permission FROM Position ORDER BY position_id`);
      res.json(rows.map((r) => ({ position_id: r.POSITION_ID, name: r.NAME, permission: r.PERMISSION })));
    });
  } catch (e) {
    err(res, e);
  }
});

app.get("/api/departments", async (_req, res) => {
  try {
    await withDb(async (conn) => {
      const rows = await all(conn, `SELECT department_id, name FROM Department ORDER BY department_id`);
      res.json(rows.map((r) => ({ department_id: r.DEPARTMENT_ID, name: r.NAME })));
    });
  } catch (e) {
    err(res, e);
  }
});

// ---------- SCHEDULES ----------
app.get("/api/schedules", async (req, res) => {
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

app.get("/api/schedules/:id", async (req, res) => {
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

app.post("/api/schedules", async (req, res) => {
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

app.patch("/api/schedules/:id/status", async (req, res) => {
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

// ---------- BOOKINGS ----------
app.get("/api/bookings", async (req, res) => {
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

app.get("/api/bookings/by-qr/:qr", async (req, res) => {
  try {
    await withDb(async (conn) => {
      const row = await one(conn, BOOKING_SQL + ` AND Booking.qr_code = :qr`, { qr: req.params.qr });
      if (!row) return res.status(404).json({ message: "ไม่พบ QR นี้" });
      res.json(mapBooking(row));
    });
  } catch (e) {
    err(res, e);
  }
});

app.post("/api/bookings", async (req, res) => {
  try {
    const { user_id, schedule_id, pickup_stop_id, dropoff_stop_id, num_seats } = req.body;
    if (!user_id || !schedule_id || !pickup_stop_id || !dropoff_stop_id || !num_seats) {
      return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
    }
    const seats = Number(num_seats);
    if (seats < 1 || seats > 4) return res.status(400).json({ message: "จองได้ 1-4 ที่นั่งต่อครั้ง" });

    await withDb(async (conn) => {
      const sch = await one(conn, SCHEDULE_SQL + ` AND Schedule.schedule_id = :id`, { id: schedule_id });
      if (!sch) return res.status(404).json({ message: "ไม่พบรอบรถ" });

      const capacity = await capacityOf(conn, sch.VEHICLE_ID);
      const available = capacity - (await seatsBooked(conn, schedule_id));
      if (seats > available) return res.status(400).json({ message: `ที่นั่งเหลือเพียง ${available} ที่` });

      const pOk = await one(conn, `SELECT 1 ok FROM RouteStop WHERE route_id=:r AND stop_id=:s AND ROWNUM=1`, {
        r: sch.ROUTE_ID,
        s: Number(pickup_stop_id),
      });
      const dOk = await one(conn, `SELECT 1 ok FROM RouteStop WHERE route_id=:r AND stop_id=:s AND ROWNUM=1`, {
        r: sch.ROUTE_ID,
        s: Number(dropoff_stop_id),
      });
      if (!pOk || !dOk) return res.status(400).json({ message: "จุดจอดไม่อยู่ในเส้นทางนี้" });

      const next = await one(conn, `SELECT NVL(MAX(TO_NUMBER(booking_id)),0)+1 id FROM Booking`);
      const booking_id = String(next.ID).padStart(4, "0");
      const qr_code = `MUT-${booking_id}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

      await q(
        conn,
        `INSERT INTO Booking (booking_id,user_id,schedule_id,pickup_stop_id,dropoff_stop_id,num_seats,status,qr_code,booked_at)
         VALUES (:booking_id,:user_id,:schedule_id,:pickup,:dropoff,:num_seats,'booked',:qr_code,SYSTIMESTAMP)`,
        {
          booking_id,
          user_id: Number(user_id),
          schedule_id,
          pickup: Number(pickup_stop_id),
          dropoff: Number(dropoff_stop_id),
          num_seats: seats,
          qr_code,
        }
      );

      const names = await one(
        conn,
        `SELECT (SELECT name FROM Stop WHERE stop_id=:p) pickup_name,
                (SELECT name FROM Stop WHERE stop_id=:d) dropoff_name FROM dual`,
        { p: Number(pickup_stop_id), d: Number(dropoff_stop_id) }
      );

      res.status(201).json({
        message: "จองสำเร็จ",
        booking: {
          booking_id,
          num_seats: seats,
          status: "booked",
          qr_code,
          booked_at: new Date().toISOString(),
          user: { user_id: Number(user_id) },
          schedule: {
            schedule_id,
            departure_time: iso(sch.DEPARTURE_TIME),
          },
          route: { route_name: sch.ROUTE_NAME },
          vehicle: {
            plate_number: sch.PLATE_NUMBER,
            capacity,
          },
          driver: { driver_name: sch.DRIVER_NAME },
          pickup: {
            stop_id: Number(pickup_stop_id),
            stop_name: names.PICKUP_NAME,
          },
          dropoff: {
            stop_id: Number(dropoff_stop_id),
            stop_name: names.DROPOFF_NAME,
          },
          seats_available: available - seats,
        },
      });
    });
  } catch (e) {
    err(res, e);
  }
});

app.patch("/api/bookings/:id/cancel", async (req, res) => {
  try {
    await withDb(async (conn) => {
      const b = await one(conn, `SELECT status FROM Booking WHERE booking_id=:id`, { id: req.params.id });
      if (!b) return res.status(404).json({ message: "ไม่พบการจอง" });
      if (b.STATUS !== "booked") return res.status(400).json({ message: "ยกเลิกได้เฉพาะสถานะจองแล้ว" });
      await q(conn, `UPDATE Booking SET status='cancelled' WHERE booking_id=:id`, { id: req.params.id });
      res.json({ message: "ยกเลิกการจองแล้ว", booking_id: req.params.id });
    });
  } catch (e) {
    err(res, e);
  }
});

// ---------- BOARDING ----------
app.post("/api/boarding", async (req, res) => {
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

app.get("/api/boarding", async (_req, res) => {
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

// ---------- USERS / STATS ----------
app.get("/api/users", async (req, res) => {
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
            permission: r.PERMISSION,
          },
        }))
      );
    });
  } catch (e) {
    err(res, e);
  }
});

app.get("/api/stats", async (_req, res) => {
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

app.get("/api/health", async (_req, res) => {
  try {
    await withDb(async (conn) => {
      await one(conn, `SELECT 1 ok FROM dual`);
      res.json({ status: "ok", db: "connected", time: new Date().toISOString() });
    });
  } catch (e) {
    res.status(500).json({ status: "error", db: "disconnected", error: e.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Shuttle API → http://localhost:${PORT}`);
});

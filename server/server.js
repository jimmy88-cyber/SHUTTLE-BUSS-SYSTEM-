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
         Route.name route_name, Route.total_minutes, Vehicle.plate_number, VehicleType.name vehicle_type_name, VehicleType.capacity vehicle_capacity,
         AppUser.first_name||' '||AppUser.last_name driver_name
  FROM Schedule, Route, Vehicle, VehicleType, AppUser
  WHERE Schedule.route_id = Route.route_id
    AND Schedule.vehicle_id = Vehicle.vehicle_id
    AND Vehicle.vehicle_type_id = VehicleType.vehicle_type_id
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
      capacity: s.VEHICLE_CAPACITY || capacity,
      type_name: s.VEHICLE_TYPE_NAME,
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
    boarded: r.BOARDED > 0,
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
         (SELECT first_name||' '||last_name FROM AppUser WHERE user_id = Booking.user_id) passenger_name,
         (SELECT COUNT(*) FROM BoardingRecord WHERE booking_id = Booking.booking_id) boarded
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
        `SELECT Vehicle.vehicle_id, Vehicle.plate_number, Vehicle.vehicle_type_id, Vehicle.status,
                VehicleType.name type_name, VehicleType.capacity
         FROM Vehicle, VehicleType
         WHERE Vehicle.vehicle_type_id = VehicleType.vehicle_type_id
         ORDER BY Vehicle.vehicle_id`
      );
      res.json(
        rows.map((r) => ({
          vehicle_id: r.VEHICLE_ID,
          plate_number: r.PLATE_NUMBER,
          status: r.STATUS || "available",
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
    const { vehicle_id, plate_number, vehicle_type_id, status } = req.body;
    if (!vehicle_id || !plate_number || !vehicle_type_id) {
      return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
    }
    await withDb(async (conn) => {
      await q(
        conn,
        `INSERT INTO Vehicle (vehicle_id, plate_number, vehicle_type_id, status)
         VALUES (:vehicle_id, :plate_number, :vehicle_type_id, :status)`,
        {
          vehicle_id,
          plate_number,
          vehicle_type_id,
          status: status || "available",
        }
      );
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


app.put("/api/vehicles/:id", async (req, res) => {
  try {
    const { plate_number, vehicle_type_id, status } = req.body;
    if (!plate_number || !vehicle_type_id) return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
    await withDb(async (conn) => {
      await q(
        conn,
        `UPDATE Vehicle
            SET plate_number = :plate_number,
                vehicle_type_id = :vehicle_type_id,
                status = :status
          WHERE vehicle_id = :id`,
        {
          plate_number,
          vehicle_type_id,
          status: status || "available",
          id: req.params.id,
        }
      );
      res.json({ message: "แก้ไขรถสำเร็จ" });
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

app.post("/api/vehicle-types", async (req, res) => {
  try {
    const { vehicle_type_id, name, capacity } = req.body;
    if (!vehicle_type_id || !name || capacity == null) return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
    await withDb(async (conn) => {
      await q(
        conn,
        `INSERT INTO VehicleType (vehicle_type_id, name, capacity) VALUES (:vehicle_type_id, :name, :capacity)`,
        { vehicle_type_id, name, capacity: Number(capacity) }
      );
      res.status(201).json({ message: "เพิ่มประเภทรถสำเร็จ", vehicle_type_id });
    });
  } catch (e) {
    err(res, e);
  }
});

app.put("/api/vehicle-types/:id", async (req, res) => {
  try {
    const { name, capacity } = req.body;
    if (!name || capacity == null) return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
    await withDb(async (conn) => {
      await q(
        conn,
        `UPDATE VehicleType SET name = :name, capacity = :capacity WHERE vehicle_type_id = :id`,
        { name, capacity: Number(capacity), id: req.params.id }
      );
      res.json({ message: "แก้ไขประเภทรถสำเร็จ" });
    });
  } catch (e) {
    err(res, e);
  }
});

app.delete("/api/vehicle-types/:id", async (req, res) => {
  try {
    await withDb(async (conn) => {
      await q(conn, `DELETE FROM VehicleType WHERE vehicle_type_id = :id`, { id: req.params.id });
      res.json({ message: "ลบประเภทรถสำเร็จ" });
    });
  } catch (e) {
    err(res, e);
  }
});

// เส้นทาง CRUD + จุดจอด
app.post("/api/routes", async (req, res) => {
  try {
    const { route_id, route_name, total_minutes } = req.body;
    if (!route_id || !route_name) return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
    await withDb(async (conn) => {
      await q(
        conn,
        `INSERT INTO Route (route_id, name, total_minutes) VALUES (:route_id, :route_name, :total_minutes)`,
        { route_id, route_name, total_minutes: Number(total_minutes) || 0 }
      );
      res.status(201).json({ message: "เพิ่มเส้นทางสำเร็จ", route_id });
    });
  } catch (e) {
    err(res, e);
  }
});

app.put("/api/routes/:id", async (req, res) => {
  try {
    const { route_name, total_minutes } = req.body;
    if (!route_name) return res.status(400).json({ message: "กรุณาระบุชื่อเส้นทาง" });
    await withDb(async (conn) => {
      await q(
        conn,
        `UPDATE Route SET name = :route_name, total_minutes = :total_minutes WHERE route_id = :id`,
        { route_name, total_minutes: Number(total_minutes) || 0, id: req.params.id }
      );
      res.json({ message: "แก้ไขเส้นทางสำเร็จ" });
    });
  } catch (e) {
    err(res, e);
  }
});

app.delete("/api/routes/:id", async (req, res) => {
  try {
    await withDb(async (conn) => {
      await q(conn, `DELETE FROM RouteStop WHERE route_id = :id`, { id: req.params.id });
      await q(conn, `DELETE FROM Route WHERE route_id = :id`, { id: req.params.id });
      res.json({ message: "ลบเส้นทางสำเร็จ" });
    });
  } catch (e) {
    err(res, e);
  }
});

app.put("/api/routes/:id/stops", async (req, res) => {
  try {
    const stops = req.body.stops;
    if (!Array.isArray(stops)) return res.status(400).json({ message: "รูปแบบ stops ไม่ถูกต้อง" });
    await withDb(async (conn) => {
      const routeId = req.params.id;
      const route = await one(conn, `SELECT route_id FROM Route WHERE route_id = :id`, { id: routeId });
      if (!route) return res.status(404).json({ message: "ไม่พบเส้นทาง" });
      await q(conn, `DELETE FROM RouteStop WHERE route_id = :id`, { id: routeId });
      let total = 0;
      for (let i = 0; i < stops.length; i++) {
        const s = stops[i];
        const minutes = Number(s.minutes_from_prev) || 0;
        total += minutes;
        await q(
          conn,
          `INSERT INTO RouteStop (route_id, sequence_no, stop_id, minutes_from_prev)
           VALUES (:route_id, :sequence_no, :stop_id, :minutes_from_prev)`,
          {
            route_id: routeId,
            sequence_no: i + 1,
            stop_id: Number(s.stop_id),
            minutes_from_prev: minutes,
          }
        );
      }
      await q(conn, `UPDATE Route SET total_minutes = :total WHERE route_id = :id`, { total, id: routeId });
      res.json({ message: "บันทึกจุดจอดสำเร็จ", total_minutes: total });
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

app.post("/api/departments", async (req, res) => {
  try {
    const { department_id, name } = req.body;
    if (!department_id || !name) return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
    await withDb(async (conn) => {
      await q(conn, `INSERT INTO Department (department_id, name) VALUES (:department_id, :name)`, { department_id, name });
      res.status(201).json({ message: "เพิ่มแผนกสำเร็จ" });
    });
  } catch (e) {
    err(res, e);
  }
});

app.put("/api/departments/:id", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "กรุณาระบุชื่อแผนก" });
    await withDb(async (conn) => {
      await q(conn, `UPDATE Department SET name = :name WHERE department_id = :id`, { name, id: req.params.id });
      res.json({ message: "แก้ไขแผนกสำเร็จ" });
    });
  } catch (e) {
    err(res, e);
  }
});

app.delete("/api/departments/:id", async (req, res) => {
  try {
    await withDb(async (conn) => {
      await q(conn, `DELETE FROM Department WHERE department_id = :id`, { id: req.params.id });
      res.json({ message: "ลบแผนกสำเร็จ" });
    });
  } catch (e) {
    err(res, e);
  }
});

app.post("/api/positions", async (req, res) => {
  try {
    const { position_id, name, permission } = req.body;
    if (!position_id || !name) return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
    await withDb(async (conn) => {
      await q(
        conn,
        `INSERT INTO Position (position_id, name, permission) VALUES (:position_id, :name, :permission)`,
        { position_id, name, permission: permission || "000000" }
      );
      res.status(201).json({ message: "เพิ่มตำแหน่งสำเร็จ" });
    });
  } catch (e) {
    err(res, e);
  }
});

app.put("/api/positions/:id", async (req, res) => {
  try {
    const { name, permission } = req.body;
    if (!name) return res.status(400).json({ message: "กรุณาระบุชื่อตำแหน่ง" });
    await withDb(async (conn) => {
      await q(
        conn,
        `UPDATE Position SET name = :name, permission = :permission WHERE position_id = :id`,
        { name, permission: permission || "000000", id: req.params.id }
      );
      res.json({ message: "แก้ไขตำแหน่งสำเร็จ" });
    });
  } catch (e) {
    err(res, e);
  }
});

app.delete("/api/positions/:id", async (req, res) => {
  try {
    await withDb(async (conn) => {
      await q(conn, `DELETE FROM Position WHERE position_id = :id`, { id: req.params.id });
      res.json({ message: "ลบตำแหน่งสำเร็จ" });
    });
  } catch (e) {
    err(res, e);
  }
});

app.post("/api/employees", async (req, res) => {
  try {
    const { username, password, first_name, last_name, department_id, position_id, email } = req.body;
    if (!username || !first_name || !last_name || !position_id) {
      return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
    }
    await withDb(async (conn) => {
      if (await one(conn, `SELECT user_id FROM AppUser WHERE username = :username`, { username })) {
        return res.status(400).json({ message: "รหัสพนักงานนี้มีแล้ว" });
      }
      const next = await one(conn, `SELECT NVL(MAX(user_id), 0) + 1 id FROM AppUser`);
      const hash = await bcrypt.hash(String(password || "1234"), 10);
      await q(
        conn,
        `INSERT INTO AppUser (user_id, username, password, first_name, last_name, email, user_type, department_id, position_id)
         VALUES (:id, :username, :password, :first_name, :last_name, :email, 'employee', :department_id, :position_id)`,
        {
          id: next.ID,
          username,
          password: hash,
          first_name,
          last_name,
          email: email || null,
          department_id: department_id || null,
          position_id,
        }
      );
      res.status(201).json({ message: "เพิ่มพนักงานสำเร็จ", user_id: next.ID });
    });
  } catch (e) {
    err(res, e);
  }
});

app.put("/api/employees/:id", async (req, res) => {
  try {
    const { first_name, last_name, department_id, position_id, password } = req.body;
    if (!first_name || !last_name || !position_id) {
      return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
    }
    await withDb(async (conn) => {
      if (password) {
        const hash = await bcrypt.hash(String(password), 10);
        await q(
          conn,
          `UPDATE AppUser
              SET first_name = :first_name, last_name = :last_name,
                  department_id = :department_id, position_id = :position_id,
                  password = :password
            WHERE user_id = :id`,
          {
            first_name, last_name,
            department_id: department_id || null,
            position_id,
            password: hash,
            id: Number(req.params.id),
          }
        );
      } else {
        await q(
          conn,
          `UPDATE AppUser
              SET first_name = :first_name, last_name = :last_name,
                  department_id = :department_id, position_id = :position_id
            WHERE user_id = :id`,
          {
            first_name, last_name,
            department_id: department_id || null,
            position_id,
            id: Number(req.params.id),
          }
        );
      }
      res.json({ message: "แก้ไขพนักงานสำเร็จ" });
    });
  } catch (e) {
    err(res, e);
  }
});

app.delete("/api/employees/:id", async (req, res) => {
  try {
    await withDb(async (conn) => {
      await q(conn, `DELETE FROM AppUser WHERE user_id = :id`, { id: Number(req.params.id) });
      res.json({ message: "ลบพนักงานสำเร็จ" });
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

app.put("/api/schedules/:id", async (req, res) => {
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

app.delete("/api/schedules/:id", async (req, res) => {
  try {
    await withDb(async (conn) => {
      const id = req.params.id;
      // ลบ boarding / booking ที่ผูกกับรอบก่อนถ้ามี (ถ้า FK บังคับ)
      try { await q(conn, `DELETE FROM BoardingRecord WHERE schedule_id = :id`, { id }); } catch (_) {}
      try { await q(conn, `DELETE FROM Booking WHERE schedule_id = :id`, { id }); } catch (_) {}
      await q(conn, `DELETE FROM Schedule WHERE schedule_id = :id`, { id });
      res.json({ message: "ลบรอบรถสำเร็จ" });
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

// รับได้ทั้ง dropoff_stop_id (ทุกคนลงจุดเดียว) หรือ dropoff_stop_ids (จุดลงของผู้โดยสารแต่ละคน)
// ผู้โดยสารที่ลงจุดเดียวกันจะรวมเป็น booking เดียว ทุก booking บันทึกใน transaction เดียวกัน
app.post("/api/bookings", async (req, res) => {
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
      const sch = await one(conn, SCHEDULE_SQL + ` AND Schedule.schedule_id = :id`, { id: schedule_id });
      if (!sch) return res.status(404).json({ message: "ไม่พบรอบรถ" });
      if (sch.STATUS === "completed") return res.status(400).json({ message: "รอบนี้ปิดรอบการจองแล้ว" });
      if (!["planned", "in_progress"].includes(sch.STATUS)) {
        return res.status(400).json({ message: "รอบนี้ไม่เปิดจอง" });
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
      let n = next.ID;
      try {
        for (const [dropoff, count] of groups) {
          const booking_id = String(n++).padStart(4, "0");
          const qr_code = `MUT-${booking_id}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
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

app.patch("/api/bookings/:id/cancel", async (req, res) => {
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

app.post("/api/users", async (req, res) => {
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

app.put("/api/users/:id", async (req, res) => {
  try {
    const { first_name, last_name, email, password, username } = req.body;
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

app.delete("/api/users/:id", async (req, res) => {
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

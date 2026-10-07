/* MASTER DATA – stops, routes, vehicles, vehicle-types, positions, departments, employees */

const express = require("express");
const router = express.Router();
const { withDb, q, one, all } = require("../config/db");
const { err, normalizePermission, isValidPermission } = require("../utils/helpers");
const bcrypt = require("bcryptjs");

router.get("/api/stops", async (_req, res) => {
  try {
    await withDb(async (conn) => {
      const rows = await all(conn, `SELECT stop_id, name FROM Stop ORDER BY stop_id`);
      res.json(rows.map((r) => ({ stop_id: r.STOP_ID, name: r.NAME })));
    });
  } catch (e) {
    err(res, e);
  }
});

router.get("/api/routes", async (_req, res) => {
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

router.get("/api/vehicles", async (_req, res) => {
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

router.post("/api/vehicles", async (req, res) => {
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

router.delete("/api/vehicles/:id", async (req, res) => {
  try {
    await withDb(async (conn) => {
      await q(conn, `DELETE FROM Vehicle WHERE vehicle_id=:id`, { id: req.params.id });
      res.json({ message: "ลบรถสำเร็จ" });
    });
  } catch (e) {
    err(res, e);
  }
});


router.put("/api/vehicles/:id", async (req, res) => {
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

router.get("/api/vehicle-types", async (_req, res) => {
  try {
    await withDb(async (conn) => {
      const rows = await all(conn, `SELECT vehicle_type_id, name, capacity FROM VehicleType ORDER BY vehicle_type_id`);
      res.json(rows.map((r) => ({ vehicle_type_id: r.VEHICLE_TYPE_ID, name: r.NAME, capacity: r.CAPACITY })));
    });
  } catch (e) {
    err(res, e);
  }
});

router.post("/api/vehicle-types", async (req, res) => {
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

router.put("/api/vehicle-types/:id", async (req, res) => {
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

router.delete("/api/vehicle-types/:id", async (req, res) => {
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
router.post("/api/routes", async (req, res) => {
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

router.put("/api/routes/:id", async (req, res) => {
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

router.delete("/api/routes/:id", async (req, res) => {
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

router.put("/api/routes/:id/stops", async (req, res) => {
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


router.get("/api/positions", async (_req, res) => {
  try {
    await withDb(async (conn) => {
      const rows = await all(conn, `SELECT position_id, name, permission FROM Position ORDER BY position_id`);
      res.json(rows.map((r) => ({
        position_id: r.POSITION_ID,
        name: r.NAME,
        permission: normalizePermission(r.PERMISSION, r.POSITION_ID),
      })));
    });
  } catch (e) {
    err(res, e);
  }
});

router.get("/api/departments", async (_req, res) => {
  try {
    await withDb(async (conn) => {
      const rows = await all(conn, `SELECT department_id, name FROM Department ORDER BY department_id`);
      res.json(rows.map((r) => ({ department_id: r.DEPARTMENT_ID, name: r.NAME })));
    });
  } catch (e) {
    err(res, e);
  }
});

router.post("/api/departments", async (req, res) => {
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

router.put("/api/departments/:id", async (req, res) => {
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

router.delete("/api/departments/:id", async (req, res) => {
  try {
    await withDb(async (conn) => {
      await q(conn, `DELETE FROM Department WHERE department_id = :id`, { id: req.params.id });
      res.json({ message: "ลบแผนกสำเร็จ" });
    });
  } catch (e) {
    err(res, e);
  }
});

router.post("/api/positions", async (req, res) => {
  try {
    const { position_id, name, permission } = req.body;
    if (!position_id || !name) return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
    if (!isValidPermission(permission)) {
      return res.status(400).json({ message: "รหัสสิทธิ์ต้องมี 10 หลัก และใช้เฉพาะ 0 หรือ 1" });
    }
    const normalizedPermission = normalizePermission(permission, position_id);
    await withDb(async (conn) => {
      await q(
        conn,
        `INSERT INTO Position (position_id, name, permission) VALUES (:position_id, :name, :permission)`,
        { position_id, name, permission: normalizedPermission }
      );
      res.status(201).json({ message: "เพิ่มตำแหน่งสำเร็จ" });
    });
  } catch (e) {
    err(res, e);
  }
});

router.put("/api/positions/:id", async (req, res) => {
  try {
    const { name, permission } = req.body;
    if (!name) return res.status(400).json({ message: "กรุณาระบุชื่อตำแหน่ง" });
    if (!isValidPermission(permission)) {
      return res.status(400).json({ message: "รหัสสิทธิ์ต้องมี 10 หลัก และใช้เฉพาะ 0 หรือ 1" });
    }
    const normalizedPermission = normalizePermission(permission, req.params.id);
    await withDb(async (conn) => {
      await q(
        conn,
        `UPDATE Position SET name = :name, permission = :permission WHERE position_id = :id`,
        { name, permission: normalizedPermission, id: req.params.id }
      );
      res.json({ message: "แก้ไขตำแหน่งสำเร็จ" });
    });
  } catch (e) {
    err(res, e);
  }
});

router.delete("/api/positions/:id", async (req, res) => {
  try {
    await withDb(async (conn) => {
      await q(conn, `DELETE FROM Position WHERE position_id = :id`, { id: req.params.id });
      res.json({ message: "ลบตำแหน่งสำเร็จ" });
    });
  } catch (e) {
    err(res, e);
  }
});

router.post("/api/employees", async (req, res) => {
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

router.put("/api/employees/:id", async (req, res) => {
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

router.delete("/api/employees/:id", async (req, res) => {
  try {
    await withDb(async (conn) => {
      await q(conn, `DELETE FROM AppUser WHERE user_id = :id`, { id: Number(req.params.id) });
      res.json({ message: "ลบพนักงานสำเร็จ" });
    });
  } catch (e) {
    err(res, e);
  }
});



module.exports = router;

const bcrypt = require("bcryptjs");
const { one } = require("../config/db");

const PERMISSION_COUNT = 10;

/** แปลงรหัสสิทธิ์รูปแบบเก่าให้เป็น 10 หลัก */
function normalizePermission(permission, positionId) {
  const value = String(permission || "").trim();
  if (new RegExp(`^[01]{${PERMISSION_COUNT}}$`).test(value)) return value;

  if (/^[01]{14}$/.test(value)) {
    return [
      value[0] === "1" || value[8] === "1" ? "1" : "0",
      value.slice(1, 8),
      value[9] === "1" || value[10] === "1" || value[11] === "1" ? "1" : "0",
      value[12] === "1" || value[13] === "1" ? "1" : "0",
    ].join("");
  }

  if (/^[01]{11}$/.test(value)) {
    return [
      value[0] === "1" || value[8] === "1" ? "1" : "0",
      value.slice(1, 8),
      value[9],
      value[10],
    ].join("");
  }

  if (/^[01]{8}$/.test(value)) {
    return `${value}${value[2] === "1" || value[4] === "1" ? "1" : "0"}${value[3]}`;
  }

  if (!/^[01]{0,6}$/.test(value)) {
    throw new Error("รหัสสิทธิ์ต้องเป็นเลข 0 หรือ 1 จำนวน 10 หลัก");
  }

  const old = value.padEnd(6, "0");
  const isDriver = String(positionId || "").padStart(2, "0") === "03";
  return [
    old[0],
    old[1],
    old[2],
    old[3],
    old[4],
    old[4],
    old[5],
    old[5],
    "0",
    isDriver ? "1" : "0",
  ].join("");
}

function isValidPermission(permission) {
  const value = String(permission || "").trim();
  return /^(?:[01]{0,6}|[01]{8}|[01]{10}|[01]{11}|[01]{14})$/.test(value);
}

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
         Route.name route_name, Route.total_minutes,
         Vehicle.plate_number, VehicleType.name vehicle_type_name,
         VehicleType.capacity vehicle_capacity,
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

module.exports = {
  PERMISSION_COUNT,
  normalizePermission,
  isValidPermission,
  iso,
  checkPassword,
  seatsBooked,
  capacityOf,
  SCHEDULE_SQL,
  mapSchedule,
  mapBooking,
  BOOKING_SQL,
  err,
};

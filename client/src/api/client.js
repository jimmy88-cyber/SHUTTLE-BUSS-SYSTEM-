const API = "/api";

async function req(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "เกิดข้อผิดพลาด");
  return data;
}

const qs = (p) => {
  const s = new URLSearchParams(p).toString();
  return s ? "?" + s : "";
};

export function sortByNumericId(items, idKey) {
  if (!Array.isArray(items)) return items;

  return [...items].sort((a, b) => {
    const left = a?.[idKey];
    const right = b?.[idKey];
    if (left == null || right == null) {
      if (left == null && right == null) return 0;
      return left == null ? 1 : -1;
    }

    const leftText = String(left);
    const rightText = String(right);
    if (/^\d+$/.test(leftText) && /^\d+$/.test(rightText)) {
      const leftNumber = BigInt(leftText);
      const rightNumber = BigInt(rightText);
      return leftNumber < rightNumber ? -1 : leftNumber > rightNumber ? 1 : 0;
    }

    return leftText.localeCompare(rightText, undefined, { numeric: true, sensitivity: "base" });
  });
}

export const api = {
  login: (username, password) => req("/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  register: (body) => req("/register", { method: "POST", body: JSON.stringify(body) }),

  getRoutes: () => req("/routes").then((items) => sortByNumericId(items, "route_id")),
  createRoute: (body) => req("/routes", { method: "POST", body: JSON.stringify(body) }),
  updateRoute: (id, body) => req("/routes/" + id, { method: "PUT", body: JSON.stringify(body) }),
  deleteRoute: (id) => req("/routes/" + id, { method: "DELETE" }),
  updateRouteStops: (id, stops) =>
    req("/routes/" + id + "/stops", { method: "PUT", body: JSON.stringify({ stops }) }),

  getStops: () => req("/stops").then((items) => sortByNumericId(items, "stop_id")),
  getSchedules: (p = {}) => req("/schedules" + qs(p)).then((items) => sortByNumericId(items, "schedule_id")),
  getSchedule: (id) => req("/schedules/" + id),
  createSchedule: (body) => req("/schedules", { method: "POST", body: JSON.stringify(body) }),
  updateSchedule: (id, body) => req("/schedules/" + id, { method: "PUT", body: JSON.stringify(body) }),
  deleteSchedule: (id) => req("/schedules/" + id, { method: "DELETE" }),
  updateScheduleStatus: (id, status) => req(`/schedules/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

  getBookings: (p = {}) => req("/bookings" + qs(p)).then((items) => sortByNumericId(items, "booking_id")),
  getBookingByQr: (qr) => req("/bookings/by-qr/" + encodeURIComponent(qr)),
  createBooking: (body) => req("/bookings", { method: "POST", body: JSON.stringify(body) }),
  cancelBooking: (id) => req(`/bookings/${id}/cancel`, { method: "PATCH" }),

  getVehicles: () => req("/vehicles").then((items) => sortByNumericId(items, "vehicle_id")),
  createVehicle: (body) => req("/vehicles", { method: "POST", body: JSON.stringify(body) }),
  updateVehicle: (id, body) => req("/vehicles/" + id, { method: "PUT", body: JSON.stringify(body) }),
  deleteVehicle: (id) => req("/vehicles/" + id, { method: "DELETE" }),

  getVehicleTypes: () => req("/vehicle-types").then((items) => sortByNumericId(items, "vehicle_type_id")),
  createVehicleType: (body) => req("/vehicle-types", { method: "POST", body: JSON.stringify(body) }),
  updateVehicleType: (id, body) => req("/vehicle-types/" + id, { method: "PUT", body: JSON.stringify(body) }),
  deleteVehicleType: (id) => req("/vehicle-types/" + id, { method: "DELETE" }),

  getUsers: (p = {}) => req("/users" + qs(p)).then((items) => sortByNumericId(items, "user_id")),
  createUser: (body) => req("/users", { method: "POST", body: JSON.stringify(body) }),
  updateUser: (id, body) => req("/users/" + id, { method: "PUT", body: JSON.stringify(body) }),
  deleteUser: (id) => req("/users/" + id, { method: "DELETE" }),
  getPositions: () => req("/positions").then((items) => sortByNumericId(items, "position_id")),
  createPosition: (body) => req("/positions", { method: "POST", body: JSON.stringify(body) }),
  updatePosition: (id, body) => req("/positions/" + id, { method: "PUT", body: JSON.stringify(body) }),
  deletePosition: (id) => req("/positions/" + id, { method: "DELETE" }),
  getDepartments: () => req("/departments").then((items) => sortByNumericId(items, "department_id")),
  createDepartment: (body) => req("/departments", { method: "POST", body: JSON.stringify(body) }),
  updateDepartment: (id, body) => req("/departments/" + id, { method: "PUT", body: JSON.stringify(body) }),
  deleteDepartment: (id) => req("/departments/" + id, { method: "DELETE" }),
  createEmployee: (body) => req("/employees", { method: "POST", body: JSON.stringify(body) }),
  updateEmployee: (id, body) => req("/employees/" + id, { method: "PUT", body: JSON.stringify(body) }),
  deleteEmployee: (id) => req("/employees/" + id, { method: "DELETE" }),

  getStats: () => req("/stats"),
  getReports: () => req("/reports"),
  getBoarding: () => req("/boarding").then((items) => sortByNumericId(items, "boarding_id")),
  createBoarding: (body) => req("/boarding", { method: "POST", body: JSON.stringify(body) }),
};

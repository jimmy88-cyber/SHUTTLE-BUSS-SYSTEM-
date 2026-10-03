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

export const api = {
  login: (username, password) => req("/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  register: (body) => req("/register", { method: "POST", body: JSON.stringify(body) }),

  getRoutes: () => req("/routes"),
  createRoute: (body) => req("/routes", { method: "POST", body: JSON.stringify(body) }),
  updateRoute: (id, body) => req("/routes/" + id, { method: "PUT", body: JSON.stringify(body) }),
  deleteRoute: (id) => req("/routes/" + id, { method: "DELETE" }),
  updateRouteStops: (id, stops) =>
    req("/routes/" + id + "/stops", { method: "PUT", body: JSON.stringify({ stops }) }),

  getStops: () => req("/stops"),
  getSchedules: (p = {}) => req("/schedules" + qs(p)),
  getSchedule: (id) => req("/schedules/" + id),
  createSchedule: (body) => req("/schedules", { method: "POST", body: JSON.stringify(body) }),
  updateScheduleStatus: (id, status) => req(`/schedules/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

  getBookings: (p = {}) => req("/bookings" + qs(p)),
  getBookingByQr: (qr) => req("/bookings/by-qr/" + encodeURIComponent(qr)),
  createBooking: (body) => req("/bookings", { method: "POST", body: JSON.stringify(body) }),
  cancelBooking: (id) => req(`/bookings/${id}/cancel`, { method: "PATCH" }),

  getVehicles: () => req("/vehicles"),
  createVehicle: (body) => req("/vehicles", { method: "POST", body: JSON.stringify(body) }),
  updateVehicle: (id, body) => req("/vehicles/" + id, { method: "PUT", body: JSON.stringify(body) }),
  deleteVehicle: (id) => req("/vehicles/" + id, { method: "DELETE" }),

  getVehicleTypes: () => req("/vehicle-types"),
  createVehicleType: (body) => req("/vehicle-types", { method: "POST", body: JSON.stringify(body) }),
  updateVehicleType: (id, body) => req("/vehicle-types/" + id, { method: "PUT", body: JSON.stringify(body) }),
  deleteVehicleType: (id) => req("/vehicle-types/" + id, { method: "DELETE" }),

  getUsers: (p = {}) => req("/users" + qs(p)),
  getPositions: () => req("/positions"),
  createPosition: (body) => req("/positions", { method: "POST", body: JSON.stringify(body) }),
  updatePosition: (id, body) => req("/positions/" + id, { method: "PUT", body: JSON.stringify(body) }),
  deletePosition: (id) => req("/positions/" + id, { method: "DELETE" }),
  getDepartments: () => req("/departments"),
  createDepartment: (body) => req("/departments", { method: "POST", body: JSON.stringify(body) }),
  updateDepartment: (id, body) => req("/departments/" + id, { method: "PUT", body: JSON.stringify(body) }),
  deleteDepartment: (id) => req("/departments/" + id, { method: "DELETE" }),
  createEmployee: (body) => req("/employees", { method: "POST", body: JSON.stringify(body) }),
  updateEmployee: (id, body) => req("/employees/" + id, { method: "PUT", body: JSON.stringify(body) }),
  deleteEmployee: (id) => req("/employees/" + id, { method: "DELETE" }),

  getStats: () => req("/stats"),
  getReports: () => req("/reports"),
  getBoarding: () => req("/boarding"),
  createBoarding: (body) => req("/boarding", { method: "POST", body: JSON.stringify(body) }),
};

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
  getVehicleTypes: () => req("/vehicle-types"),
  createVehicle: (body) => req("/vehicles", { method: "POST", body: JSON.stringify(body) }),
  deleteVehicle: (id) => req("/vehicles/" + id, { method: "DELETE" }),

  getUsers: (p = {}) => req("/users" + qs(p)),
  getPositions: () => req("/positions"),
  getDepartments: () => req("/departments"),
  getStats: () => req("/stats"),
  getBoarding: () => req("/boarding"),
  createBoarding: (body) => req("/boarding", { method: "POST", body: JSON.stringify(body) }),
};

export const PERMISSION_OPTIONS = [
  { key: "dashboardReports", label: "แดชบอร์ด / รายงาน", path: "/admin", icon: "📊" },
  { key: "vehicles", label: "จัดการรถและประเภท", path: "/admin/vehicles", icon: "🚌" },
  { key: "routes", label: "เส้นทาง", path: "/admin/routes", icon: "🗺️" },
  { key: "trips", label: "รอบรถ", path: "/admin/trips", icon: "📅" },
  { key: "bookings", label: "การจอง", path: "/admin/bookings", icon: "🎫" },
  { key: "users", label: "ผู้ใช้บริการ", path: "/admin/users", icon: "🧑‍🎓" },
  { key: "employees", label: "พนักงาน", path: "/admin/employees", icon: "👥" },
  { key: "boarding", label: "ขึ้นรถ", path: "/admin/boarding", icon: "✅" },
  { key: "passengerPortal", label: "หน้าผู้ใช้บริการ", path: "/home", icon: "👤" },
  { key: "driverPortal", label: "หน้าคนขับ", path: "/driver", icon: "🚌" },
];

export const PERMISSION_COUNT = PERMISSION_OPTIONS.length;

function toTenBits(bits14) {
  return [
    bits14[0] === "1" || bits14[8] === "1" ? "1" : "0",
    bits14.slice(1, 8),
    bits14[9] === "1" || bits14[10] === "1" || bits14[11] === "1" ? "1" : "0",
    bits14[12] === "1" || bits14[13] === "1" ? "1" : "0",
  ].join("");
}

export function getPermissionBits(permission, positionId) {
  const value = String(permission || "").trim();
  if (/^[01]{10}$/.test(value)) return value;
  if (/^[01]{14}$/.test(value)) return toTenBits(value);
  if (/^[01]{8}$/.test(value)) {
    return `${value}${value[2] === "1" || value[4] === "1" ? "1" : "0"}${value[3]}`;
  }

  let legacy;
  if (/^[01]{11}$/.test(value)) {
    legacy = [
      value[0] === "1" || value[8] === "1" ? "1" : "0",
      value.slice(1, 8),
      value[9],
      value[10],
    ].join("");
  } else if (/^[01]{0,6}$/.test(value)) {
    const old = value.padEnd(6, "0").slice(0, 6);
    const isDriver = String(positionId || "").padStart(2, "0") === "03";
    legacy = [
      old[0], old[1], old[2], old[3], old[4], old[4], old[5], old[5], old[0],
      "0", "0", "0", isDriver ? "1" : "0", isDriver ? "1" : "0",
    ].join("");
  } else {
    throw new Error("รหัสสิทธิ์ต้องเป็นรูปแบบเดิม 6/8/11/14 หลัก หรือรูปแบบใหม่ 10 หลัก");
  }

  return toTenBits(legacy);
}

export function getFirstPermittedPath(user) {
  if (user?.user_type === "passenger") return "/home";
  const bits = getPermissionBits(user?.permission, user?.position_id);
  if (bits[9] === "1" && bits[3] === "1") return "/driver";
  if (bits[9] === "1" && bits[7] === "1") return "/driver/scan";
  return PERMISSION_OPTIONS.find((_, index) => bits[index] === "1")?.path || "/";
}

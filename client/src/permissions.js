// ตารางจับคู่ index ของ permission bit กับเมนูและ URL:
// bit ที่ตำแหน่ง index เป็น "1" หมายถึงอนุญาตหน้าตาม path ในรายการนั้น
export const PERMISSION_OPTIONS = [
  { key: "dashboard", label: "แดชบอร์ด", path: "/admin", icon: "📊" },
  { key: "vehicles", label: "จัดการรถและประเภท", path: "/admin/vehicles", icon: "🚌" },
  { key: "routes", label: "เส้นทาง", path: "/admin/routes", icon: "🗺️" },
  { key: "trips", label: "รอบรถ", path: "/admin/trips", icon: "📅" },
  { key: "bookings", label: "การจอง", path: "/admin/bookings", icon: "🎫" },
  { key: "users", label: "ผู้ใช้บริการ", path: "/admin/users", icon: "🧑‍🎓" },
  { key: "employees", label: "พนักงาน", path: "/admin/employees", icon: "👥" },
  { key: "boarding", label: "ขึ้นรถ", path: "/admin/boarding", icon: "✅" },
  { key: "passengerPortal", label: "หน้าผู้ใช้บริการ", path: "/home", icon: "👤" },
  { key: "driverPortal", label: "หน้าคนขับ", path: "/driver", icon: "🚌" },
  { key: "reports", label: "รายงาน", path: "/admin/reports", icon: "📈" },
];

export const PERMISSION_COUNT = PERMISSION_OPTIONS.length;

// แปลง permission 14 บิตจากโครงสร้างเก่าให้เป็น 10 บิตที่ระบบเดิมของ client ใช้
function toTenBits(bits14) {
  return [
    bits14[0] === "1" || bits14[8] === "1" ? "1" : "0",
    bits14.slice(1, 8),
    bits14[9] === "1" || bits14[10] === "1" || bits14[11] === "1" ? "1" : "0",
    bits14[12] === "1" || bits14[13] === "1" ? "1" : "0",
  ].join("");
}

// ทำ permission ให้เป็นรูปแบบปัจจุบัน 11 ตำแหน่งก่อนใช้ใน route/menu guard
// แต่ละตำแหน่งใช้ "1" เมื่ออนุญาต และ "0" เมื่อไม่อนุญาต
export function getPermissionBits(permission, positionId) {
  const value = String(permission || "").trim();
  // ถ้าเป็นรูปแบบใหม่ 11 บิตอยู่แล้ว ให้ใช้ได้ทันที
  if (/^[01]{11}$/.test(value)) return value;
  // รองรับรูปแบบ 10 บิตและแปลงค่ารูปแบบเก่าก่อนนำไปตรวจสิทธิ์
  const ten = /^[01]{10}$/.test(value) ? value : legacyToTenBits(value, positionId);
  // รหัสก่อนแยกสิทธิ์รายงาน: ให้หน้ารายงานใช้สิทธิ์เดียวกับแดชบอร์ดเหมือนเดิม
  return ten + ten[0];
}

/**
 * แปลงรูปแบบ permission เก่า (6/8/14 บิต) เป็น 10 บิต
 * เพื่อให้ข้อมูลตำแหน่งเดิมยังใช้กับการตรวจสิทธิ์ชุดปัจจุบันได้
 */
function legacyToTenBits(value, positionId) {
  // แปลงสิทธิ์ 14 บิตแบบเก่าให้เป็นรูปแบบ 10 บิต
  if (/^[01]{14}$/.test(value)) return toTenBits(value);
  // เติมความหมายของสิทธิ์รายงานและหน้าคนขับจากรหัส 8 บิต
  if (/^[01]{8}$/.test(value)) {
    return `${value}${value[2] === "1" || value[4] === "1" ? "1" : "0"}${value[3]}`;
  }

  let legacy;
  if (/^[01]{0,6}$/.test(value)) {
    // เติมตำแหน่งที่ขาดในรหัส 6 บิต; positionId 03 ใช้ระบุสิทธิ์คนขับแบบเดิม
    const old = value.padEnd(6, "0").slice(0, 6);
    const isDriver = String(positionId || "").padStart(2, "0") === "03";
    legacy = [
      old[0], old[1], old[2], old[3], old[4], old[4], old[5], old[5], old[0],
      "0", "0", "0", isDriver ? "1" : "0", isDriver ? "1" : "0",
    ].join("");
  } else {
    // ปฏิเสธรูปแบบสิทธิ์ที่ไม่รู้จัก เพื่อไม่ให้ตีความสิทธิ์ผิด
    throw new Error("รหัสสิทธิ์ต้องเป็นรูปแบบเดิม 6/8/10/14 หลัก หรือรูปแบบใหม่ 11 หลัก");
  }

  return toTenBits(legacy);
}

// เลือกหน้าปลายทางแรกที่ผู้ใช้เปิดได้หลัง login
export function getFirstPermittedPath(user) {
  // ผู้ใช้บริการทั่วไปเข้าหน้าผู้โดยสาร โดยไม่ต้องอาศัย permission ของพนักงาน
  if (user?.user_type === "passenger") return "/home";
  // แปลงข้อมูลสิทธิ์ของตำแหน่งให้ตรวจตำแหน่งบิตได้
  const bits = getPermissionBits(user?.permission, user?.position_id);
  // คนขับที่มีสิทธิ์รอบรถจะเริ่มที่หน้ารอบรถคนขับ
  if (bits[9] === "1" && bits[3] === "1") return "/driver";
  // ถ้ามีสิทธิ์คนขับและขึ้นรถ แต่ไม่มีสิทธิ์รอบรถ ให้เริ่มหน้าสแกน
  if (bits[9] === "1" && bits[7] === "1") return "/driver/scan";
  // ผู้ใช้อื่นไปหน้าตามสิทธิ์แรกในตาราง; ถ้าไม่มีสิทธิ์เลยให้กลับหน้า login
  return PERMISSION_OPTIONS.find((_, index) => bits[index] === "1")?.path || "/";
}

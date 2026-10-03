// ===== Shared Mock Data (ตาม requirement MINI PROJECT SHUTTLE BUS) =====

// ตำแหน่ง + สิทธิ์ (6 หลัก: แดชบอร์ด|รถ|เส้นทาง|รอบรถ|จอง+ผู้ใช้|พนักงาน+ขึ้นรถ)
window.POSITIONS = [
  { code: '01', name: 'ผู้ดูแลระบบ (Admin)', rights: '111111' },
  { code: '02', name: 'เจ้าหน้าที่ขนส่ง',     rights: '001101' },
  { code: '03', name: 'คนขับรถ',             rights: '000010' },
  { code: '04', name: 'เจ้าหน้าที่ทั่วไป',   rights: '000100' }
];

window.DEPARTMENTS = [
  { code: '01', name: 'ฝ่ายขนส่ง' },
  { code: '02', name: 'ฝ่ายบุคคล' },
  { code: '03', name: 'ฝ่ายไอที' },
  { code: '04', name: 'ฝ่ายบริหาร' }
];

window.EMPLOYEES = [
  { code: 'EMP001', first: 'สมชาย', last: 'ใจดี',  dept: '01', pos: '03', password: '1234' },
  { code: 'EMP002', first: 'สมหมาย', last: 'ใจรัก', dept: '01', pos: '03', password: '1234' },
  { code: 'EMP003', first: 'สมควร', last: 'ใจงาม', dept: '02', pos: '02', password: '1234' },
  { code: 'EMP004', first: 'นันทนา', last: 'ใจตรง', dept: '03', pos: '01', password: '1234' }
];

window.VEHICLE_TYPES = [
  { code: '01', name: 'ตู้', seats: 9 },
  { code: '02', name: 'รถบัส', seats: 20 }
];

window.VEHICLES = [
  { code: '01', plate: 'สย 2591', type: '01', status: 'active' },
  { code: '02', plate: 'บก 1130', type: '02', status: 'active' },
  { code: '03', plate: 'สย 2599', type: '01', status: 'inactive' }
];

window.STOPS = [
  { code: 1, name: 'มหาวิทยาลัยเทคโนโลยีมหานคร' },
  { code: 2, name: 'โลตัสหนองจอก' },
  { code: 3, name: 'โรงพยาบาลหนองจอก' },
  { code: 4, name: 'Big C หนองจอก' },
  { code: 5, name: 'สวนสาธารณะหนองจอก' },
  { code: 6, name: 'ร้านส้มตำป้านาง' }
];

window.ROUTES = [
  { code: '01', name: 'เส้นทางที่ 1', totalMin: 30 },
  { code: '02', name: 'เส้นทางที่ 2', totalMin: 13 },
  { code: '03', name: 'เส้นทางที่ 3', totalMin: 12 }
];

// จุดจอดในเส้นทาง (ลำดับ, route, stop, นาทีจากจุดก่อน)
window.ROUTE_STOPS = [
  // เส้นทาง 1
  { seq: 1, route: '01', stop: 1, minFromPrev: 0 },
  { seq: 2, route: '01', stop: 2, minFromPrev: 5 },
  { seq: 3, route: '01', stop: 3, minFromPrev: 3 },
  { seq: 4, route: '01', stop: 4, minFromPrev: 6 },
  { seq: 5, route: '01', stop: 3, minFromPrev: 3 },
  { seq: 6, route: '01', stop: 2, minFromPrev: 3 },
  { seq: 7, route: '01', stop: 1, minFromPrev: 10 },
  // เส้นทาง 2
  { seq: 1, route: '02', stop: 1, minFromPrev: 0 },
  { seq: 2, route: '02', stop: 2, minFromPrev: 5 },
  { seq: 3, route: '02', stop: 5, minFromPrev: 3 },
  { seq: 4, route: '02', stop: 6, minFromPrev: 5 },
  // เส้นทาง 3
  { seq: 1, route: '03', stop: 4, minFromPrev: 0 },
  { seq: 2, route: '03', stop: 2, minFromPrev: 5 },
  { seq: 3, route: '03', stop: 5, minFromPrev: 3 },
  { seq: 4, route: '03', stop: 6, minFromPrev: 5 },
  { seq: 5, route: '03', stop: 1, minFromPrev: 2 }
];

window.TRIPS = [
  // เส้นทาง 1
  { code: '0001', datetime: '2025-09-13 09:30:00', emp: 'EMP001', vehicle: '01', route: '01', status: 'planned' },
  { code: '0002', datetime: '2025-09-13 11:00:00', emp: 'EMP002', vehicle: '01', route: '01', status: 'planned' },
  { code: '0003', datetime: '2025-09-13 13:00:00', emp: 'EMP001', vehicle: '02', route: '01', status: 'planned' },
  { code: '0004', datetime: '2025-09-13 15:00:00', emp: 'EMP001', vehicle: '02', route: '01', status: 'planned' },
  // เส้นทาง 2
  { code: '0005', datetime: '2025-09-13 09:30:00', emp: 'EMP003', vehicle: '03', route: '02', status: 'planned' },
  { code: '0006', datetime: '2025-09-13 11:00:00', emp: 'EMP003', vehicle: '03', route: '02', status: 'planned' },
  { code: '0007', datetime: '2025-09-13 13:00:00', emp: 'EMP002', vehicle: '03', route: '02', status: 'planned' },
  { code: '0008', datetime: '2025-09-13 15:00:00', emp: 'EMP002', vehicle: '03', route: '02', status: 'planned' },
  // เพิ่มรอบอื่น
  { code: '0009', datetime: '2025-09-14 09:30:00', emp: 'EMP001', vehicle: '01', route: '01', status: 'planned' },
  { code: '0010', datetime: '2025-09-15 09:30:00', emp: 'EMP002', vehicle: '02', route: '01', status: 'planned' }
];

window.USERS = [
  { code: '001', first: 'ภูวนาท', last: 'เมืองทรัพย์', username: '123456', email: '6711130036@mut.ac.th', phone: '032165489', password: '1234' },
  { code: '002', first: 'นน', last: 'อิอิ', username: '321', email: '6711130023@mut.ac.th', phone: '054354336', password: '1234' },
  { code: '003', first: 'นัท', last: 'อะอะ', username: '456', email: '6711130063@mut.ac.th', phone: '063767454', password: '1234' }
];

window.BOOKINGS = [
  { code: '01', seats: 2, user: '001', pickup: 1, dropoff: 4, trip: '0001', status: 'booked', bookedAt: '2025-09-13 08:10:00', qr: 'QR-01-001' },
  { code: '02', seats: 1, user: '002', pickup: 1, dropoff: 6, trip: '0005', status: 'checked_in', bookedAt: '2025-09-13 08:40:00', qr: 'QR-02-002' },
  { code: '03', seats: 2, user: '003', pickup: 1, dropoff: 3, trip: '0003', status: 'cancelled', bookedAt: '2025-09-13 09:15:00', qr: 'QR-03-003' },
  { code: '04', seats: 1, user: '001', pickup: 4, dropoff: 1, trip: '0010', status: 'booked', bookedAt: '2025-09-15 08:00:00', qr: 'QR-04-001' }
];

window.BOARDING = [
  { code: '01', booking: '02', trip: '0005', stop: 1, emp: 'EMP003', datetime: '2025-09-13 09:28:00' }
];

// Helper
window.getEmpName = (code) => {
  const e = window.EMPLOYEES.find(x => x.code === code);
  return e ? `${e.first} ${e.last}` : code;
};
window.getPos = (code) => window.POSITIONS.find(x => x.code === code);
window.getVehicle = (code) => {
  const v = window.VEHICLES.find(x => x.code === code);
  if (!v) return code;
  const t = window.VEHICLE_TYPES.find(x => x.code === v.type);
  return `${v.plate} (${t ? t.name + ' ' + t.seats + ' ที่' : ''})`;
};
window.getStopName = (code) => {
  const s = window.STOPS.find(x => x.code == code);
  return s ? s.name : code;
};
window.getRouteName = (code) => {
  const r = window.ROUTES.find(x => x.code === code);
  return r ? r.name : code;
};

// หน้าจอที่แต่ละหลักสิทธิ์ควบคุม
window.SCREEN_MAP = [
  { bit: 0, key: 'dashboard', name: 'แดชบอร์ด',      href: 'dashboard.html' },
  { bit: 1, key: 'vehicles',  name: 'จัดการรถ',      href: 'vehicles.html' },
  { bit: 2, key: 'routes',    name: 'เส้นทาง & จุดจอด', href: 'routes.html' },
  { bit: 3, key: 'trips',     name: 'รอบการเดินรถ',  href: 'trips.html' },
  { bit: 4, key: 'bookings',  name: 'การจอง & ผู้ใช้', href: 'bookings.html' },
  { bit: 5, key: 'employees', name: 'พนักงาน & ขึ้นรถ', href: 'employees.html' }
];

window.hasRight = (rights, bit) => rights && rights[bit] === '1';

// Session helpers
window.saveSession = (type, data) => {
  localStorage.setItem('shuttle_session', JSON.stringify({ type, ...data, loginAt: Date.now() }));
};
window.getSession = () => {
  try { return JSON.parse(localStorage.getItem('shuttle_session')); } catch { return null; }
};
window.clearSession = () => localStorage.removeItem('shuttle_session');
window.requireLogin = (type) => {
  const s = window.getSession();
  if (!s || s.type !== type) {
    window.location.href = type === 'passenger' ? '../index.html' : '../index.html';
    return null;
  }
  return s;
};
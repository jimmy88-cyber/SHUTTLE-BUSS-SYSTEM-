const KEY = "shuttle_user";

// จัดการสถานะ Login ฝั่ง browser โดยใช้ localStorage:
// ค่า KEY เป็นชื่อช่องเก็บ และ event แจ้ง React components ให้อ่านข้อมูลใหม่
// หมายเหตุ: ค่านี้เป็นสถานะฝั่ง client ไม่ใช่ token สำหรับยืนยันทุก API request
export const saveUser = (u) => {
  localStorage.setItem(KEY, JSON.stringify(u));
  window.dispatchEvent(new Event("shuttle-user-change"));
};
// อ่านข้อมูลผู้ใช้ที่เคยบันทึกไว้; คืน null หากยังไม่ได้ Login หรือข้อมูลอ่านไม่ได้
export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
};
// Logout ฝั่ง client: ลบข้อมูล Login ใน browser แล้วแจ้ง UI ให้ render สถานะออกจากระบบ
// ระบบปัจจุบันไม่มี endpoint Logout แยกบน server
export const clearUser = () => {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("shuttle-user-change"));
};

/**
 * ดึงตำแหน่ง/สิทธิ์ล่าสุดจาก server แล้วอัปเดตผู้ใช้ที่ login อยู่
 * ทำให้การแก้ไขสิทธิ์ของตำแหน่งมีผลทันที โดยไม่ต้อง login ใหม่
 */
export async function refreshUser() {
  // ไม่มี user_id แสดงว่ายังไม่มีผู้ใช้ที่ต้องซิงก์สิทธิ์
  const user = getUser();
  if (!user?.user_id) return;
  try {
    // ขอข้อมูลผู้ใช้ล่าสุดจาก server โดยระบุ user_id ใน URL
    const res = await fetch("/api/me/" + encodeURIComponent(user.user_id));
    if (res.status === 404) {
      // บัญชีถูกลบหรือไม่พบแล้ว จึงล้างสถานะ Login ใน browser
      clearUser();
      return;
    }
    // กรณี server ตอบ error อื่น ให้อยู่กับข้อมูลเดิม
    if (!res.ok) return;
    const { user: latest } = await res.json();
    // รวมข้อมูลล่าสุดกับข้อมูลเดิม แล้วแจ้ง UI เฉพาะเมื่อมีค่าเปลี่ยน
    const merged = { ...user, ...latest };
    if (JSON.stringify(merged) !== JSON.stringify(user)) saveUser(merged);
  } catch {
    // ต่อ server ไม่ได้ ใช้ข้อมูลเดิมไปก่อน
  }
}

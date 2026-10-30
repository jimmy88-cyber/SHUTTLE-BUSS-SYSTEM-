import { useEffect, useState } from "react";
import { getUser } from "../api/auth";

/**
 * Hook อ่านผู้ใช้ที่ Login อยู่จาก localStorage และติดตาม event ที่ saveUser/clearUser
 * เมื่อ Login, Logout หรือข้อมูลสิทธิ์เปลี่ยน component ที่ใช้ hook นี้จะ render ใหม่
 */
export function useCurrentUser() {
  const [user, setUser] = useState(getUser);

  useEffect(() => {
    function refresh() {
      setUser(getUser());
    }
    window.addEventListener("shuttle-user-change", refresh);
    return () => window.removeEventListener("shuttle-user-change", refresh);
  }, []);

  return user;
}

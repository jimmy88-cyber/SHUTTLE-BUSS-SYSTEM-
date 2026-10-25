import { useEffect, useState } from "react";
import { getUser } from "../api/auth";

/** ผู้ใช้ที่ login อยู่ และ render ใหม่ทุกครั้งที่ข้อมูลผู้ใช้/สิทธิ์เปลี่ยน */
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

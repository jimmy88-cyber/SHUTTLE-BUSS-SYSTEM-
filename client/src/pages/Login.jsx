// Dependencies ของหน้า Login:
// - useState ใช้เก็บค่าฟอร์มและสถานะที่ทำให้ React render หน้าใหม่
// - useNavigate/Link ใช้เปลี่ยนหน้าและเชื่อมไปยังหน้าสมัครสมาชิก
// - api.login ติดต่อ API เพื่อให้ server ตรวจสอบบัญชี
// - saveUser/clearUser จัดเก็บหรือล้างข้อมูลผู้ใช้ใน browser
// - getFirstPermittedPath เลือกหน้าแรกตามประเภทบัญชีและสิทธิ์ที่ได้รับ
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { clearUser, saveUser } from '../api/auth';
import { getFirstPermittedPath } from '../permissions';

export default function Login() {
  // State ของหน้า:
  // username/password เก็บค่าที่ผู้ใช้กรอก, error เก็บข้อความแจ้งปัญหา
  // loading ควบคุมสถานะปุ่มระหว่างรอผลจาก API
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // ได้ฟังก์ชันสำหรับเปลี่ยน URL ภายในแอป โดยไม่ reload ทั้งหน้า
  const navigate = useNavigate();

  // ขั้นตอนประมวลผลเมื่อ submit ฟอร์ม:
  // 1) ส่ง username/password ให้ API ตรวจสอบ 2) เลือกหน้าโดยดูสิทธิ์
  // 3) บันทึกข้อมูลผู้ใช้และเปลี่ยนหน้า หรือแสดงข้อผิดพลาดหากทำไม่สำเร็จ
  async function handleSubmit(e) {
    // ป้องกัน browser ส่งฟอร์มแบบปกติที่ทำให้หน้า reload
    e.preventDefault();
    // ล้างข้อความจากการลองเข้าสู่ระบบครั้งก่อน
    setError('');
    // ระบุว่ากำลังรอ API และป้องกันการกดปุ่มซ้ำ
    setLoading(true);
    try {
      // ส่งชื่อผู้ใช้และรหัสผ่านเป็นคำขอ Login; API ส่งข้อมูลผู้ใช้กลับเมื่อยืนยันสำเร็จ
      const data = await api.login(username, password);
      // ตรวจประเภทผู้ใช้และ permission เพื่อหา URL แรกที่อนุญาต
      const destination = getFirstPermittedPath(data.user);
      // หากผลเป็น "/" หมายถึงไม่มีหน้าใดที่ระบบอนุญาตให้บัญชีนี้เข้าได้
      if (destination === '/') {
        // ลบสถานะผู้ใช้ที่อาจค้างจากการใช้งานครั้งก่อน
        clearUser();
        // แจ้งว่าต้องให้ผู้ดูแลกำหนดสิทธิ์ก่อนจึงจะเข้าใช้งานได้
        setError('บัญชีนี้ยังไม่ได้รับสิทธิ์เข้าใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
        // หยุดก่อนบันทึกข้อมูลผู้ใช้และก่อนเปลี่ยนหน้า
        return;
      }
      // เมื่อมีหน้าอนุญาต ให้เก็บข้อมูลผู้ใช้ไว้ใน browser สำหรับหน้าอื่นใช้ตรวจสถานะ
      saveUser(data.user);
      // นำผู้ใช้ไปยังหน้าแรกที่ตรงกับสิทธิ์ เช่น หน้าผู้โดยสาร คนขับ หรือแอดมิน
      navigate(destination);
    } catch (err) {
      // แสดงข้อความที่ API ส่งกลับ เช่น กรอกข้อมูลไม่ครบหรือบัญชีไม่ถูกต้อง
      setError(err.message);
    } finally {
      // คืนปุ่มสู่สถานะปกติ ทั้งกรณีสำเร็จ ไม่มีสิทธิ์ หรือเกิดข้อผิดพลาด
      setLoading(false);
    }
  }

  // ส่วนแสดงผลของหน้า แบ่งเป็นหัวระบบ กล่องแจ้งเตือน ฟอร์ม Login
  // และลิงก์ไปสมัครสมาชิก
  return (
    <div className="login-page">
      <div className="login-card">
        {/* หัวหน้า Login แสดงสัญลักษณ์ ชื่อระบบ และชื่อมหาวิทยาลัย */}
        <div className="login-logo">
          <div className="icon">🚌</div>
          <h1>Shuttle Bus MUT</h1>
          <p>มหาวิทยาลัยเทคโนโลยีมหานคร</p>
        </div>
        {/* แสดงกล่องนี้เฉพาะเมื่อมีข้อความ error จากการตรวจบัญชีหรือสิทธิ์ */}
        {error && <div className="error-msg">{error}</div>}
        {/* เมื่อกด Enter หรือปุ่ม submit จะเรียก handleSubmit */}
        <form onSubmit={handleSubmit}>
          {/* กลุ่มชื่อผู้ใช้: input เป็น controlled field โดย value มาจาก state
              และ onChange อัปเดต state ตามค่าที่พิมพ์; required บังคับให้กรอก */}
          <div className="form-group">
            <label className="form-label">ชื่อผู้ใช้</label>
            <input
              type="text"
              className="form-control"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          {/* กลุ่มรหัสผ่าน: type=password ซ่อนค่าที่กรอก และ state เก็บค่าปัจจุบัน
              autoComplete ช่วย browser ระบุชนิดข้อมูล ส่วน required บังคับให้กรอก */}
          <div className="form-group">
            <label className="form-label">รหัสผ่าน</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {/* ปุ่ม submit ของฟอร์ม; ระหว่างรอ API จะ disabled และแสดงข้อความกำลังเข้าสู่ระบบ */}
          <button type="submit" className="m-btn m-btn-primary" disabled={loading}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
        {/* ผู้ที่ยังไม่มีบัญชีสามารถไปหน้า /register ผ่าน React Router Link */}
        <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.9rem', color: '#64748b' }}>
          ยังไม่มีบัญชี? <Link to="/register" style={{ color: '#0d9488', fontWeight: 600 }}>สมัครสมาชิก</Link>
        </p>
      </div>
    </div>
  );
}

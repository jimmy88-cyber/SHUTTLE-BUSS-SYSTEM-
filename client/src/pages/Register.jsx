import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';

export default function Register() {
  const [form, setForm] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    email: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await api.register(form);
      setSuccess('สมัครสมาชิกสำเร็จ! กำลังไปหน้าเข้าสู่ระบบ...');
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="icon">📝</div>
          <h1>สมัครสมาชิก</h1>
          <p>สำหรับผู้ใช้บริการรถรับส่ง</p>
        </div>
        {error && <div className="error-msg">{error}</div>}
        {success && <div className="success-msg">{success}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">ชื่อผู้ใช้</label>
            <input className="form-control" value={form.username} onChange={(e) => update('username', e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">รหัสผ่าน</label>
            <input type="password" className="form-control" value={form.password} onChange={(e) => update('password', e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">ชื่อ</label>
            <input className="form-control" value={form.first_name} onChange={(e) => update('first_name', e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">นามสกุล</label>
            <input className="form-control" value={form.last_name} onChange={(e) => update('last_name', e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">อีเมล (ไม่บังคับ)</label>
            <input type="email" className="form-control" value={form.email} onChange={(e) => update('email', e.target.value)} />
          </div>
          <button type="submit" className="m-btn m-btn-primary" disabled={loading}>
            {loading ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.9rem' }}>
          <Link to="/" style={{ color: '#0d9488' }}>← กลับเข้าสู่ระบบ</Link>
        </p>
      </div>
    </div>
  );
}

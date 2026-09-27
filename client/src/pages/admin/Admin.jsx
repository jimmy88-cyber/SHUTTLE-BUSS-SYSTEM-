import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';

export default function Admin() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.getStats().then(setStats).catch(console.error);
  }, []);

  const cards = [
    { icon: '🎫', label: 'การจองทั้งหมด', value: stats?.bookings ?? '—' },
    { icon: '📅', label: 'รอบรถ (planned)', value: stats?.schedules ?? '—' },
    { icon: '🚌', label: 'รถทั้งหมด', value: stats?.vehicles ?? '—' },
    { icon: '🧑‍🎓', label: 'ผู้ใช้บริการ', value: stats?.passengers ?? '—' },
    { icon: '✅', label: 'บันทึกขึ้นรถ', value: stats?.boarding ?? '—' },
  ];

  return (
    <AdminLayout title="แดชบอร์ด" subtitle="ภาพรวมระบบจองรถรับส่ง MUT">
      <div className="stats-grid">
        {cards.map((c) => (
          <div className="stat-card" key={c.label}>
            <div className="stat-icon">{c.icon}</div>
            <div>
              <div className="stat-value">{c.value}</div>
              <div className="stat-label">{c.label}</div>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}

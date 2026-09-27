import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';

export default function AdminRoutes() {
  const [routes, setRoutes] = useState([]);

  useEffect(() => {
    api.getRoutes().then(setRoutes).catch(console.error);
  }, []);

  return (
    <AdminLayout title="เส้นทาง & จุดจอด" subtitle="รายการเส้นทางในระบบ">
      {routes.map((r) => (
        <div className="admin-card" key={r.route_id} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <strong>
              {r.route_id} — {r.route_name}
            </strong>
            <span className="m-badge m-badge-planned">{r.total_minutes} นาที</span>
          </div>
          <ol style={{ paddingLeft: 20, margin: 0, fontSize: '0.9rem' }}>
            {(r.stops || []).map((s) => (
              <li key={s.sequence_no}>
                {s.stop_name}{' '}
                <span style={{ color: '#94a3b8' }}>
                  ({s.minutes_from_prev === 0 ? 'เริ่ม' : `+${s.minutes_from_prev} นาที`})
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </AdminLayout>
  );
}

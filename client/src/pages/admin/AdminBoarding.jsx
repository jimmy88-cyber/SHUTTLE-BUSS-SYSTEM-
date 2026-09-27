import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';

export default function AdminBoarding() {
  const [list, setList] = useState([]);

  useEffect(() => {
    api.getBoarding().then(setList).catch(console.error);
  }, []);

  return (
    <AdminLayout title="บันทึกขึ้นรถ" subtitle="ประวัติการสแกน QR">
      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>รหัส</th>
              <th>ผู้โดยสาร</th>
              <th>การจอง</th>
              <th>รอบ</th>
              <th>จุดจอด</th>
              <th>สแกนโดย</th>
              <th>เวลา</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.boarding_id}>
                <td>{r.boarding_id}</td>
                <td>{r.passenger?.passenger_name}</td>
                <td>{r.booking_id}</td>
                <td>{r.schedule_id}</td>
                <td>{r.stop?.stop_name}</td>
                <td>{r.scanned_by_user?.driver_name}</td>
                <td>
                  {r.scanned_at ? new Date(r.scanned_at).toLocaleString('th-TH') : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <div className="m-empty">ยังไม่มีบันทึก</div>}
      </div>
    </AdminLayout>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';

export default function AdminUsers() {
  const [list, setList] = useState([]);

  useEffect(() => {
    api.getUsers({ user_type: 'passenger' }).then(setList).catch(console.error);
  }, []);

  return (
    <AdminLayout title="ผู้ใช้บริการ" subtitle="บัญชีผู้โดยสาร">
      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>ชื่อ-สกุล</th>
              <th>อีเมล</th>
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.user_id}>
                <td>{u.user_id}</td>
                <td>{u.username}</td>
                <td>
                  {u.first_name} {u.last_name}
                </td>
                <td>{u.email || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <div className="m-empty">ยังไม่มีผู้ใช้บริการ</div>}
      </div>
    </AdminLayout>
  );
}

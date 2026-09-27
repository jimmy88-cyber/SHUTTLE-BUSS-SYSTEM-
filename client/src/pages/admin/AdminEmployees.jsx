import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';

export default function AdminEmployees() {
  const [list, setList] = useState([]);

  useEffect(() => {
    api
      .getUsers()
      .then((u) => setList(u.filter((x) => x.user_type === 'employee')))
      .catch(console.error);
  }, []);

  return (
    <AdminLayout title="พนักงาน" subtitle="Admin / เจ้าหน้าที่ / คนขับ">
      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>ชื่อ-สกุล</th>
              <th>ตำแหน่ง</th>
              <th>แผนก</th>
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
                <td>{u.position?.position_name || u.position?.position_id || '-'}</td>
                <td>{u.department?.department_name || u.department?.department_id || '-'}</td>
                <td>{u.email || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

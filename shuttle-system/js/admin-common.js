// ใช้ร่วมกันทุกหน้า admin: ตรวจ login + สร้างเมนูตามสิทธิ์
(function () {
  const session = window.getSession();
  if (!session || session.type !== 'staff') {
    window.location.href = '../index.html';
    return;
  }

  // คนขับไม่ควรอยู่หน้า admin
  if (session.posCode === '03') {
    window.location.href = '../driver/trips.html';
    return;
  }

  window.CURRENT_SESSION = session;

  // สร้าง sidebar ตามสิทธิ์
  function buildSidebar(activeKey) {
    const menu = document.getElementById('sidebar-menu');
    if (!menu) return;

    let html = '';
    window.SCREEN_MAP.forEach(s => {
      if (window.hasRight(session.rights, s.bit)) {
        const active = s.key === activeKey ? ' class="active"' : '';
        // บางหน้ามีหลายลิงก์
        let href = s.href;
        if (s.key === 'bookings') {
          // แสดงทั้ง bookings และ users
          html += `<li><a href="bookings.html"${activeKey==='bookings'?' class="active"':''}>🎫 การจอง</a></li>`;
          html += `<li><a href="users.html"${activeKey==='users'?' class="active"':''}>🧑‍🎓 ผู้ใช้บริการ</a></li>`;
          return;
        }
        if (s.key === 'employees') {
          html += `<li><a href="employees.html"${activeKey==='employees'?' class="active"':''}>👥 พนักงาน</a></li>`;
          html += `<li><a href="boarding.html"${activeKey==='boarding'?' class="active"':''}>✅ บันทึกขึ้นรถ</a></li>`;
          return;
        }
        html += `<li><a href="${href}"${active}>${s.name === 'แดชบอร์ด' ? '📊 ' : s.name === 'จัดการรถ' ? '🚌 ' : s.name === 'เส้นทาง & จุดจอด' ? '🗺️ ' : s.name === 'รอบการเดินรถ' ? '📅 ' : ''}${s.name}</a></li>`;
      }
    });
    // เพิ่มเมนูรายงาน (สำหรับคนที่มีสิทธิ์แดชบอร์ด)
    if (window.hasRight(session.rights, 0)) {
      const activeR = activeKey === 'reports' ? ' class="active"' : '';
      html += `<li><a href="reports.html"${activeR}>📈 รายงาน</a></li>`;
    }
    menu.innerHTML = html;
  }

  // ใส่ชื่อผู้ใช้ใน navbar
  function fillUserInfo() {
    const el = document.getElementById('user-display');
    if (el) {
      el.innerHTML = `
        <div class="avatar">${session.name.charAt(0)}</div>
        <span>${session.name} (${session.posName})</span>
        <a href="../index.html" class="btn btn-sm btn-outline" style="color:white; border-color:rgba(255,255,255,0.3);" onclick="window.clearSession()">ออก</a>
      `;
    }
  }

  window.initAdminPage = function (activeKey) {
    buildSidebar(activeKey);
    fillUserInfo();
  };

  // ตรวจสิทธิ์หน้าปัจจุบัน
  window.checkPageRight = function (bit) {
    if (!window.hasRight(session.rights, bit)) {
      alert('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
      const first = window.SCREEN_MAP.find(s => window.hasRight(session.rights, s.bit));
      if (first) window.location.href = first.href;
      else window.location.href = '../index.html';
    }
  };
})();

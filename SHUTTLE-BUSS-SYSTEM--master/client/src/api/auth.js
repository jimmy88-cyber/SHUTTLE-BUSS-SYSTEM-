const KEY = "shuttle_user";

export const saveUser = (u) => {
  localStorage.setItem(KEY, JSON.stringify(u));
  window.dispatchEvent(new Event("shuttle-user-change"));
};

export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
};

export const clearUser = () => {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("shuttle-user-change"));
};

export async function refreshUser() {
  const user = getUser();
  if (!user?.user_id) return;
  try {
    const res = await fetch("/api/me/" + encodeURIComponent(user.user_id));
    if (res.status === 404) {
      clearUser();
      return;
    }
    if (!res.ok) return;
    const { user: latest } = await res.json();
    const merged = { ...user, ...latest };
    if (JSON.stringify(merged) !== JSON.stringify(user)) saveUser(merged);
  } catch {
  }
}

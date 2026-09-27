const KEY = "shuttle_user";

export const saveUser = (u) => localStorage.setItem(KEY, JSON.stringify(u));
export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
};
export const clearUser = () => localStorage.removeItem(KEY);

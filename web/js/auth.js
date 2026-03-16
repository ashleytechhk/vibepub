// JWT Token Management
function getToken() { return localStorage.getItem('vibepub_token'); }
function setToken(token) { localStorage.setItem('vibepub_token', token); }
function clearToken() { localStorage.removeItem('vibepub_token'); }
function isLoggedIn() { return !!getToken(); }

function requireAuth() {
  if (!isLoggedIn()) { window.location.href = '/'; return false; }
  return true;
}

function updateNavAuth() {
  const loginBtn = document.getElementById('nav-login');
  const dashBtn = document.getElementById('nav-dash');
  const logoutBtn = document.getElementById('nav-logout');
  if (!loginBtn) return;
  if (isLoggedIn()) {
    loginBtn.style.display = 'none';
    if (dashBtn) dashBtn.style.display = '';
    if (logoutBtn) logoutBtn.style.display = '';
  } else {
    loginBtn.style.display = '';
    if (dashBtn) dashBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
  }
}

function logout() {
  clearToken();
  window.location.href = '/';
}

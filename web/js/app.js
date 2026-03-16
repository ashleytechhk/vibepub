// Landing Page Logic

let allApps = [];
let currentCategory = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  updateNavAuth();
  updateHeroAuth();
  setupCategoryPills();
  setupSearch();
  await loadApps();
});

function updateHeroAuth() {
  const heroLogin = document.getElementById('hero-login');
  const heroDash = document.getElementById('hero-dash');
  if (isLoggedIn()) {
    if (heroLogin) heroLogin.style.display = 'none';
    if (heroDash) heroDash.style.display = '';
  } else {
    if (heroLogin) heroLogin.style.display = '';
    if (heroDash) heroDash.style.display = 'none';
  }
}

function setupCategoryPills() {
  document.querySelectorAll('#category-pills .pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#category-pills .pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentCategory = pill.dataset.cat;
      renderApps();
    });
  });
}

function setupSearch() {
  const input = document.getElementById('search-input');
  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => doSearch(), 300);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); doSearch(); }
  });
}

async function doSearch() {
  const q = document.getElementById('search-input').value.trim();
  if (q) {
    try {
      const data = await apiGet(`/search?q=${encodeURIComponent(q)}`);
      allApps = data.apps || [];
      // Reset category to 'all' when searching
      document.querySelectorAll('#category-pills .pill').forEach(p => p.classList.remove('active'));
      document.querySelector('#category-pills .pill[data-cat="all"]').classList.add('active');
      currentCategory = 'all';
      renderApps();
    } catch (e) {
      console.error('Search error:', e);
    }
  } else {
    await loadApps();
  }
}

async function loadApps() {
  const grid = document.getElementById('apps-grid');
  grid.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading apps...</p></div>';
  try {
    const data = await apiGet('/apps');
    allApps = data.apps || [];
    renderApps();
  } catch (e) {
    grid.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><p>Failed to load apps</p></div>';
  }
}

function renderApps() {
  const grid = document.getElementById('apps-grid');
  const empty = document.getElementById('apps-empty');

  let filtered = allApps;
  if (currentCategory !== 'all') {
    filtered = allApps.filter(a => a.category === currentCategory);
  }

  if (filtered.length === 0) {
    grid.innerHTML = '';
    empty.style.display = '';
    return;
  }

  empty.style.display = 'none';
  grid.innerHTML = filtered.map(app => `
    <a class="app-card" href="/app.html?slug=${encodeURIComponent(app.slug)}">
      <div class="app-card-header">
        <h3>${esc(app.name)}</h3>
        <span class="category-badge">${esc(app.category)}</span>
      </div>
      <p class="tagline">${esc(app.tagline)}</p>
      <div class="app-card-footer">
        ${app.developer_avatar ? `<img src="${esc(app.developer_avatar)}" alt="">` : ''}
        <span>${esc(app.developer_name || 'Unknown')}</span>
      </div>
    </a>
  `).join('');
}

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

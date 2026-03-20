// Landing Page Logic

let allApps = [];
let currentTag = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  updateNavAuth();
  updateHeroAuth();
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

function buildTagPills() {
  const container = document.getElementById('tag-pills');
  // Collect all unique tags from loaded apps
  const tagCounts = {};
  for (const app of allApps) {
    const tags = app.tags ? (typeof app.tags === 'string' ? JSON.parse(app.tags) : app.tags) : [];
    for (const t of tags) {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    }
  }
  // Sort by count descending, take top 12
  const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);

  container.innerHTML = '<span class="pill active" data-tag="all">All</span>' +
    sorted.map(([tag]) => `<span class="pill" data-tag="${esc(tag)}">${esc(tag)}</span>`).join('');

  // Attach click handlers
  container.querySelectorAll('.pill').forEach(pill => {
    pill.addEventListener('click', () => {
      container.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentTag = pill.dataset.tag;
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
      currentTag = 'all';
      buildTagPills();
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
    buildTagPills();
    renderApps();
  } catch (e) {
    grid.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><p>Failed to load apps</p></div>';
  }
}

function renderApps() {
  const grid = document.getElementById('apps-grid');
  const empty = document.getElementById('apps-empty');

  let filtered = allApps;
  if (currentTag !== 'all') {
    filtered = allApps.filter(a => {
      const tags = a.tags ? (typeof a.tags === 'string' ? JSON.parse(a.tags) : a.tags) : [];
      return tags.includes(currentTag);
    });
  }

  if (filtered.length === 0) {
    grid.innerHTML = '';
    empty.style.display = '';
    return;
  }

  empty.style.display = 'none';
  grid.innerHTML = filtered.map(app => {
    const tags = app.tags ? (typeof app.tags === 'string' ? JSON.parse(app.tags) : app.tags) : [];
    const tagBadges = tags.slice(0, 3).map(t => `<span class="tag" style="font-size:0.7rem;padding:2px 6px;">${esc(t)}</span>`).join('');
    return `
    <a class="app-card" href="/app.html?slug=${encodeURIComponent(app.slug)}">
      <div class="app-card-header">
        <h3>${esc(app.name)}</h3>
        ${tagBadges}
      </div>
      <p class="tagline">${esc(app.tagline)}</p>
      <div class="app-card-footer">
        ${app.developer_avatar ? `<img src="${esc(app.developer_avatar)}" alt="">` : ''}
        <span>${esc(app.developer_name || 'Unknown')}</span>
      </div>
    </a>
  `;
  }).join('');
}

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

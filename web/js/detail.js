// App Detail Page Logic

document.addEventListener('DOMContentLoaded', async () => {
  updateNavAuth();
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  if (!slug) { show404(); return; }
  await loadApp(slug);
});

async function loadApp(slug) {
  const section = document.getElementById('app-detail');
  try {
    const data = await apiGet(`/apps/${encodeURIComponent(slug)}`);
    if (!data || data.error) { show404(); return; }
    const app = data.app || data;
    renderApp(app);
    injectSchemaOrg(app);
    document.title = `${app.name} — VibePub`;
  } catch (e) {
    show404();
  }
}

function injectSchemaOrg(app) {
  const tags = app.tags ? (typeof app.tags === 'string' ? JSON.parse(app.tags) : app.tags) : [];
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: app.name,
    description: app.description || app.tagline,
    url: app.homepage_url || `https://${app.slug}.vibepub.dev`,
    applicationCategory: app.category,
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
  if (app.tagline) schema.featureList = app.tagline;
  if (tags.length) schema.keywords = tags.join(', ');
  if (app.developer_name) {
    schema.author = { '@type': 'Person', name: app.developer_name };
    if (app.developer_github) schema.author.url = `https://github.com/${app.developer_github}`;
  }
  const el = document.createElement('script');
  el.type = 'application/ld+json';
  el.textContent = JSON.stringify(schema);
  document.head.appendChild(el);
}

function renderApp(app) {
  const section = document.getElementById('app-detail');

  const trustClass = app.trust_level ? `trust-${app.trust_level.replace(/\s+/g, '_')}` : '';
  const trustLabel = app.trust_level || 'pending';

  const tags = app.tags ? (typeof app.tags === 'string' ? JSON.parse(app.tags) : app.tags) : [];

  section.innerHTML = `
    <div class="app-detail-header">
      <h1>${esc(app.name)}</h1>
      <p class="tagline">${esc(app.tagline)}</p>
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
        <span class="category-badge" style="font-size: 0.85rem;">${esc(app.category)}</span>
        <span class="trust-badge ${trustClass}">${trustLabel}</span>
      </div>
      <div class="app-detail-actions">
        ${app.homepage_url ? `<a href="${esc(app.homepage_url)}" target="_blank" class="btn btn-primary">🚀 Open App</a>` : ''}
        ${app.repo_url ? `<a href="${esc(app.repo_url)}" target="_blank" class="btn btn-outline">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          View Source
        </a>` : ''}
      </div>
    </div>

    <div class="app-detail-body">
      <div>
        <div class="app-description">
          <h2>About</h2>
          <p>${esc(app.description)}</p>
        </div>
        ${tags.length > 0 ? `
          <div class="app-tags" style="margin-top: 16px;">
            ${tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
      <div class="app-sidebar">
        <div class="dev-card">
          ${app.developer_avatar ? `<img src="${esc(app.developer_avatar)}" alt="${esc(app.developer_name)}">` : '<div style="width:64px;height:64px;border-radius:50%;background:var(--bg-secondary);margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:2rem;">👤</div>'}
          <h3>${esc(app.developer_name || 'Unknown Developer')}</h3>
          <p>${esc(app.developer_bio || '')}</p>
          ${app.developer_github ? `<a href="https://github.com/${esc(app.developer_github)}" target="_blank" style="font-size: 0.85rem; margin-top: 8px; display: inline-block;">@${esc(app.developer_github)}</a>` : ''}
        </div>
      </div>
    </div>
  `;
}

function show404() {
  document.getElementById('app-detail').style.display = 'none';
  document.getElementById('app-404').style.display = '';
}

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

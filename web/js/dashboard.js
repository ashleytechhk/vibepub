// Dashboard Logic

let myProfile = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;
  setupSlugAutoGen();
  await loadProfile();
  await loadMyApps();
});

function showSection(id, el) {
  document.querySelectorAll('.dash-section').forEach(s => s.style.display = 'none');
  document.getElementById('section-' + id).style.display = '';
  document.querySelectorAll('.dash-nav a').forEach(a => a.classList.remove('active'));
  if (el) el.classList.add('active');
}

// Profile
async function loadProfile() {
  const card = document.getElementById('profile-card');
  try {
    const data = await apiGetAuth('/auth/me', getToken());
    myProfile = data.developer || data;
    card.innerHTML = `
      ${myProfile.avatar_url ? `<img src="${esc(myProfile.avatar_url)}" alt="${esc(myProfile.display_name)}">` : '<div style="width:80px;height:80px;border-radius:50%;background:var(--bg-secondary);margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:2.5rem;">👤</div>'}
      <h3>${esc(myProfile.display_name)}</h3>
      <p>@${esc(myProfile.github_username)}</p>
      <p style="margin-top: 8px; font-size: 0.8rem; color: var(--text-muted);">${myProfile.app_count || 0} app${myProfile.app_count !== 1 ? 's' : ''} published</p>
    `;
  } catch (e) {
    card.innerHTML = '<p style="color: var(--danger);">Failed to load profile</p>';
    if (e.status === 401) { clearToken(); window.location.href = '/'; }
  }
}

// My Apps
async function loadMyApps() {
  const list = document.getElementById('my-apps-list');
  try {
    const data = await apiGetAuth('/apps/mine', getToken());
    const apps = data.apps || [];
    if (apps.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="icon">📱</div>
          <p>You haven't submitted any apps yet</p>
          <a href="#submit-app" class="btn btn-primary" style="margin-top: 12px;" onclick="showSection('submit-app', document.querySelector('.dash-nav a:nth-child(2)'))">Submit Your First App</a>
        </div>
      `;
      return;
    }
    list.innerHTML = apps.map(app => `
      <div class="my-app-item">
        <div class="my-app-info">
          <h4>${esc(app.name)}</h4>
          <p>${esc(app.tagline)}</p>
        </div>
        <div class="my-app-actions">
          <span class="status-badge status-${app.status || 'pending'}">${app.status || 'pending'}</span>
          ${app.status === 'published' ? `<a href="/app.html?slug=${encodeURIComponent(app.slug)}" class="btn btn-outline btn-sm">View</a>` : ''}
        </div>
      </div>
    `).join('');
  } catch (e) {
    list.innerHTML = '<p style="color: var(--danger);">Failed to load apps</p>';
  }
}

// Auto-generate slug from name
function setupSlugAutoGen() {
  const nameInput = document.getElementById('f-name');
  const slugInput = document.getElementById('f-slug');
  let slugEdited = false;

  slugInput.addEventListener('input', () => { slugEdited = true; });

  nameInput.addEventListener('input', () => {
    if (!slugEdited) {
      slugInput.value = nameInput.value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50);
    }
  });
}

// Submit App
async function submitApp(e) {
  e.preventDefault();
  const alertDiv = document.getElementById('submit-alert');
  const btn = document.getElementById('submit-btn');

  alertDiv.innerHTML = '';
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  const tagsRaw = document.getElementById('f-tags').value.trim();
  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  const payload = {
    name: document.getElementById('f-name').value.trim(),
    slug: document.getElementById('f-slug').value.trim(),
    tagline: document.getElementById('f-tagline').value.trim(),
    description: document.getElementById('f-description').value.trim(),
    repo_url: document.getElementById('f-repo-url').value.trim(),
    repo_tag: document.getElementById('f-repo-tag').value.trim(),
    category: document.getElementById('f-category').value,
  };
  if (tags.length > 0) payload.tags = tags;

  try {
    const result = await apiPost('/apps', payload, getToken());
    alertDiv.innerHTML = '<div class="alert alert-success">🎉 App submitted successfully! It will be reviewed shortly.</div>';
    document.getElementById('submit-form').reset();
    // Reload apps list
    await loadMyApps();
    // Switch to my apps after a moment
    setTimeout(() => showSection('my-apps', document.querySelector('.dash-nav a:first-child')), 2000);
  } catch (err) {
    let msg = err.error || 'Submission failed';
    if (err.details && Array.isArray(err.details)) {
      msg = '<strong>Please fix the following:</strong><ul style="margin: 8px 0 0 20px; text-align: left;">' +
        err.details.map(d => `<li>${esc(d)}</li>`).join('') + '</ul>';
    }
    alertDiv.innerHTML = `<div class="alert alert-error">${msg}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = '🚀 Submit for Review';
  }
}

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

-- VibePub Database Schema v1
-- D1 (SQLite)

-- Developers
CREATE TABLE IF NOT EXISTS developers (
    id              TEXT PRIMARY KEY,
    github_id       TEXT NOT NULL UNIQUE,
    github_username TEXT NOT NULL,
    email           TEXT NOT NULL,
    display_name    TEXT,
    avatar_url      TEXT,
    bio             TEXT,
    website         TEXT,
    app_count       INTEGER DEFAULT 0,
    status          TEXT DEFAULT 'active',
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_developers_github_id ON developers(github_id);
CREATE INDEX IF NOT EXISTS idx_developers_github_username ON developers(github_username);

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
    id              TEXT PRIMARY KEY,
    developer_id    TEXT NOT NULL,
    key_hash        TEXT NOT NULL UNIQUE,
    key_prefix      TEXT NOT NULL,
    name            TEXT,
    last_used_at    TEXT,
    rate_limit      INTEGER DEFAULT 100,
    status          TEXT DEFAULT 'active',
    created_at      TEXT NOT NULL,
    expires_at      TEXT,
    FOREIGN KEY (developer_id) REFERENCES developers(id)
);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_developer_id ON api_keys(developer_id);

-- Apps
CREATE TABLE IF NOT EXISTS apps (
    id              TEXT PRIMARY KEY,
    developer_id    TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    tagline         TEXT,
    description     TEXT,
    category        TEXT,
    tags            TEXT,
    repo_url        TEXT NOT NULL,
    repo_tag        TEXT NOT NULL,
    homepage_url    TEXT,
    icon_url        TEXT,
    screenshots     TEXT,
    trust_level     TEXT DEFAULT 'fully_open',
    has_backend     INTEGER DEFAULT 0,
    backend_url     TEXT,
    file_size       INTEGER,
    status          TEXT DEFAULT 'pending',
    version         TEXT,
    total_views     INTEGER DEFAULT 0,
    total_visitors  INTEGER DEFAULT 0,
    published_at    TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    FOREIGN KEY (developer_id) REFERENCES developers(id)
);
CREATE INDEX IF NOT EXISTS idx_apps_slug ON apps(slug);
CREATE INDEX IF NOT EXISTS idx_apps_developer_id ON apps(developer_id);
CREATE INDEX IF NOT EXISTS idx_apps_category ON apps(category);
CREATE INDEX IF NOT EXISTS idx_apps_status ON apps(status);
CREATE INDEX IF NOT EXISTS idx_apps_published_at ON apps(published_at);
CREATE INDEX IF NOT EXISTS idx_apps_total_views ON apps(total_views);

-- Submissions
CREATE TABLE IF NOT EXISTS submissions (
    id              TEXT PRIMARY KEY,
    app_id          TEXT,
    developer_id    TEXT NOT NULL,
    repo_url        TEXT NOT NULL,
    repo_tag        TEXT NOT NULL,
    app_name        TEXT NOT NULL,
    app_slug        TEXT NOT NULL,
    description     TEXT,
    status          TEXT DEFAULT 'pending',
    audit_result    TEXT,
    audit_score     REAL,
    build_log       TEXT,
    reject_reason   TEXT,
    error_details   TEXT,
    file_size       INTEGER,
    is_update       INTEGER DEFAULT 0,
    created_at      TEXT NOT NULL,
    completed_at    TEXT,
    FOREIGN KEY (app_id) REFERENCES apps(id),
    FOREIGN KEY (developer_id) REFERENCES developers(id)
);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_developer_id ON submissions(developer_id);
CREATE INDEX IF NOT EXISTS idx_submissions_app_id ON submissions(app_id);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at);

export const migrations = [
  `
  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    idea TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'creating',
    model_id TEXT NOT NULL,
    target_words INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS book_context (
    book_id TEXT PRIMARY KEY,
    world_setting TEXT,
    outline TEXT,
    style_guide TEXT,
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role_type TEXT NOT NULL,
    personality TEXT NOT NULL,
    speech_style TEXT,
    appearance TEXT,
    abilities TEXT,
    background TEXT,
    relationships TEXT,
    first_appear INTEGER,
    is_active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS character_states (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id TEXT NOT NULL,
    character_id TEXT NOT NULL,
    volume_index INTEGER NOT NULL,
    chapter_index INTEGER NOT NULL,
    location TEXT,
    status TEXT,
    knowledge TEXT,
    emotion TEXT,
    power_level TEXT,
    UNIQUE (book_id, character_id, volume_index, chapter_index)
  );

  CREATE TABLE IF NOT EXISTS plot_threads (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    description TEXT NOT NULL,
    planted_at INTEGER NOT NULL,
    expected_payoff INTEGER,
    resolved_at INTEGER,
    importance TEXT NOT NULL DEFAULT 'normal',
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS world_settings (
    book_id TEXT NOT NULL,
    category TEXT NOT NULL,
    key TEXT NOT NULL,
    content TEXT NOT NULL,
    PRIMARY KEY (book_id, category, key),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS scene_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id TEXT NOT NULL,
    volume_index INTEGER NOT NULL,
    chapter_index INTEGER NOT NULL,
    location TEXT NOT NULL,
    time_in_story TEXT NOT NULL,
    characters_present TEXT NOT NULL,
    events TEXT,
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS chapters (
    book_id TEXT NOT NULL,
    volume_index INTEGER NOT NULL,
    chapter_index INTEGER NOT NULL,
    title TEXT,
    outline TEXT,
    content TEXT,
    summary TEXT,
    word_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT,
    PRIMARY KEY (book_id, volume_index, chapter_index)
  );

  CREATE TABLE IF NOT EXISTS writing_progress (
    book_id TEXT PRIMARY KEY,
    current_volume INTEGER,
    current_chapter INTEGER,
    phase TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_msg TEXT,
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS api_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id TEXT,
    model_id TEXT,
    phase TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    duration_ms INTEGER,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS model_configs (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    model_name TEXT NOT NULL,
    api_key TEXT,
    base_url TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    config_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
];

export const migrations = [
  `
  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    idea TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'creating',
    model_id TEXT NOT NULL,
    target_chapters INTEGER NOT NULL,
    words_per_chapter INTEGER NOT NULL,
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

  CREATE TABLE IF NOT EXISTS story_bibles (
    book_id TEXT PRIMARY KEY,
    premise TEXT NOT NULL,
    genre_contract TEXT NOT NULL,
    target_reader_experience TEXT NOT NULL,
    theme_question TEXT NOT NULL,
    theme_answer_direction TEXT NOT NULL,
    central_dramatic_question TEXT NOT NULL,
    ending_state_json TEXT NOT NULL,
    voice_guide TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS character_arcs (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role_type TEXT NOT NULL,
    desire TEXT NOT NULL,
    fear TEXT NOT NULL,
    flaw TEXT NOT NULL,
    misbelief TEXT NOT NULL,
    wound TEXT,
    external_goal TEXT NOT NULL,
    internal_need TEXT NOT NULL,
    arc_direction TEXT NOT NULL,
    decision_logic TEXT NOT NULL,
    line_will_not_cross TEXT,
    line_may_eventually_cross TEXT,
    current_arc_phase TEXT NOT NULL,
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS character_states (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id TEXT NOT NULL,
    character_id TEXT NOT NULL,
    character_name TEXT NOT NULL,
    volume_index INTEGER NOT NULL,
    chapter_index INTEGER NOT NULL,
    location TEXT,
    status TEXT,
    knowledge TEXT,
    emotion TEXT,
    power_level TEXT,
    arc_phase TEXT,
    UNIQUE (book_id, character_id, volume_index, chapter_index)
  );

  CREATE TABLE IF NOT EXISTS relationship_edges (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    from_character_id TEXT NOT NULL,
    to_character_id TEXT NOT NULL,
    visible_label TEXT NOT NULL,
    hidden_truth TEXT,
    dependency TEXT,
    debt TEXT,
    misunderstanding TEXT,
    affection TEXT,
    harm_pattern TEXT,
    shared_goal TEXT,
    value_conflict TEXT,
    trust_level INTEGER NOT NULL,
    tension_level INTEGER NOT NULL,
    current_state TEXT NOT NULL,
    planned_turns_json TEXT NOT NULL DEFAULT '[]',
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS relationship_states (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id TEXT NOT NULL,
    relationship_id TEXT NOT NULL,
    volume_index INTEGER NOT NULL,
    chapter_index INTEGER NOT NULL,
    trust_level INTEGER NOT NULL,
    tension_level INTEGER NOT NULL,
    current_state TEXT NOT NULL,
    change_summary TEXT,
    UNIQUE (book_id, relationship_id, volume_index, chapter_index)
  );

  CREATE TABLE IF NOT EXISTS world_rules (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    category TEXT NOT NULL,
    rule_text TEXT NOT NULL,
    cost TEXT NOT NULL,
    who_benefits TEXT,
    who_suffers TEXT,
    taboo TEXT,
    violation_consequence TEXT,
    allowed_exception TEXT,
    current_status TEXT NOT NULL,
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS narrative_threads (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    type TEXT NOT NULL,
    promise TEXT NOT NULL,
    planted_at INTEGER NOT NULL,
    expected_payoff INTEGER,
    resolved_at INTEGER,
    current_state TEXT NOT NULL,
    importance TEXT NOT NULL,
    payoff_must_change TEXT NOT NULL,
    owner_character_id TEXT,
    related_relationship_id TEXT,
    notes TEXT,
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS volume_plans (
    book_id TEXT NOT NULL,
    volume_index INTEGER NOT NULL,
    title TEXT NOT NULL,
    chapter_start INTEGER NOT NULL,
    chapter_end INTEGER NOT NULL,
    role_in_story TEXT NOT NULL,
    main_pressure TEXT NOT NULL,
    promised_payoff TEXT NOT NULL,
    character_arc_movement TEXT NOT NULL,
    relationship_movement TEXT NOT NULL,
    world_expansion TEXT NOT NULL,
    ending_turn TEXT NOT NULL,
    PRIMARY KEY (book_id, volume_index),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS chapter_cards (
    book_id TEXT NOT NULL,
    volume_index INTEGER NOT NULL,
    chapter_index INTEGER NOT NULL,
    title TEXT NOT NULL,
    plot_function TEXT NOT NULL,
    pov_character_id TEXT,
    external_conflict TEXT NOT NULL,
    internal_conflict TEXT NOT NULL,
    relationship_change TEXT NOT NULL,
    world_rule_used_or_tested TEXT NOT NULL,
    information_reveal TEXT NOT NULL,
    reader_reward TEXT NOT NULL,
    ending_hook TEXT NOT NULL,
    must_change TEXT NOT NULL,
    forbidden_moves_json TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'planned',
    revision INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (book_id, volume_index, chapter_index),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS chapter_thread_actions (
    book_id TEXT NOT NULL,
    volume_index INTEGER NOT NULL,
    chapter_index INTEGER NOT NULL,
    thread_id TEXT NOT NULL,
    action TEXT NOT NULL,
    required_effect TEXT NOT NULL,
    PRIMARY KEY (book_id, volume_index, chapter_index, thread_id, action),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS chapter_character_pressures (
    book_id TEXT NOT NULL,
    volume_index INTEGER NOT NULL,
    chapter_index INTEGER NOT NULL,
    character_id TEXT NOT NULL,
    desire_pressure TEXT NOT NULL,
    fear_pressure TEXT NOT NULL,
    flaw_trigger TEXT NOT NULL,
    expected_choice TEXT NOT NULL,
    PRIMARY KEY (book_id, volume_index, chapter_index, character_id),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS chapter_relationship_actions (
    book_id TEXT NOT NULL,
    volume_index INTEGER NOT NULL,
    chapter_index INTEGER NOT NULL,
    relationship_id TEXT NOT NULL,
    action TEXT NOT NULL,
    required_change TEXT NOT NULL,
    PRIMARY KEY (book_id, volume_index, chapter_index, relationship_id, action),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS chapters (
    book_id TEXT NOT NULL,
    volume_index INTEGER NOT NULL,
    chapter_index INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    summary TEXT,
    word_count INTEGER NOT NULL DEFAULT 0,
    audit_score INTEGER,
    draft_attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT,
    updated_at TEXT,
    PRIMARY KEY (book_id, volume_index, chapter_index),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS chapter_generation_audits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id TEXT NOT NULL,
    volume_index INTEGER NOT NULL,
    chapter_index INTEGER NOT NULL,
    attempt INTEGER NOT NULL,
    passed INTEGER NOT NULL,
    score INTEGER NOT NULL,
    decision TEXT NOT NULL,
    issues_json TEXT NOT NULL,
    scoring_json TEXT NOT NULL,
    state_updates_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS narrative_checkpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id TEXT NOT NULL,
    chapter_index INTEGER NOT NULL,
    report_json TEXT NOT NULL,
    future_card_revisions_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
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

  CREATE TABLE IF NOT EXISTS writing_progress (
    book_id TEXT PRIMARY KEY,
    current_volume INTEGER,
    current_chapter INTEGER,
    phase TEXT,
    step_label TEXT,
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
  `,
];

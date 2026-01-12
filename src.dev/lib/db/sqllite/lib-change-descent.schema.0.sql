-- Persistence for sessions
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    path_root TEXT,
    status TEXT, -- 'running', 'paused', 'completed', 'aborted'
    node_count INTEGER,
    last_path TEXT, -- The last directory successfully ingested
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- The actual Merkle Tree state (Persisted lib-change-descent)
CREATE TABLE IF NOT EXISTS disk_nodes (
    session_id TEXT,
    node_id INTEGER,
    parent_id INTEGER,
    name_offset INTEGER,
    hash BLOB,
    flags INTEGER,
    mtime INTEGER,
    PRIMARY KEY (session_id, node_id)
);

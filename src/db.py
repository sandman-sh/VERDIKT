import sqlite3
import json
import hashlib
from datetime import datetime, timezone
from src.config import DB_PATH, DEFAULT_WEIGHTS

def get_connection():
    conn = sqlite3.connect(DB_PATH, timeout=10.0, check_same_thread=False)
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    with conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            submissions_close TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tracks (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS judges (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            tracks_json TEXT NOT NULL DEFAULT '[]'
        );

        CREATE TABLE IF NOT EXISTS teams (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            members_json TEXT NOT NULL DEFAULT '[]'
        );

        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            team_id TEXT,
            track_id TEXT,
            title TEXT NOT NULL,
            summary TEXT,
            repo_url TEXT,
            submitted_at TEXT NOT NULL,
            community_votes INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (track_id) REFERENCES tracks(id)
        );

        CREATE TABLE IF NOT EXISTS scores (
            judge_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            criteria_json TEXT NOT NULL,
            comment TEXT,
            submitted_at TEXT NOT NULL,
            PRIMARY KEY (judge_id, project_id),
            FOREIGN KEY (judge_id) REFERENCES judges(id),
            FOREIGN KEY (project_id) REFERENCES projects(id)
        );

        CREATE TABLE IF NOT EXISTS pairwise_comparisons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            judge_id TEXT NOT NULL,
            project_a_id TEXT NOT NULL,
            project_b_id TEXT NOT NULL,
            winner_id TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS community_votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            voter_ip TEXT NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE(project_id, voter_ip)
        );

        CREATE TABLE IF NOT EXISTS rubric_weights (
            criterion TEXT PRIMARY KEY,
            weight REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            actor_role TEXT NOT NULL,
            actor_id TEXT NOT NULL,
            action TEXT NOT NULL,
            details TEXT NOT NULL,
            created_at TEXT NOT NULL,
            prev_hash TEXT NOT NULL,
            hash TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            role TEXT NOT NULL,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            judge_id TEXT,
            team_id TEXT,
            tracks_json TEXT DEFAULT '[]'
        );

        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            author_name TEXT NOT NULL,
            author_role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id)
        );

        CREATE TABLE IF NOT EXISTS team_invites (
            code TEXT PRIMARY KEY,
            team_id TEXT NOT NULL,
            team_name TEXT NOT NULL,
            created_by TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS judge_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            judge_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            assigned_at TEXT NOT NULL,
            UNIQUE(judge_id, project_id)
        );

        CREATE TABLE IF NOT EXISTS quadratic_votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            voter_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            credits_spent INTEGER NOT NULL,
            vote_weight REAL NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE(voter_id, project_id)
        );

        CREATE TABLE IF NOT EXISTS webhooks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT NOT NULL,
            event_types TEXT NOT NULL,
            secret TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS verifiable_records (
            id TEXT PRIMARY KEY,
            record_type TEXT NOT NULL,
            subject_id TEXT NOT NULL,
            subject_name TEXT NOT NULL,
            details_json TEXT NOT NULL,
            issued_at TEXT NOT NULL,
            signature_hash TEXT NOT NULL
        );
        """)

        # Add results_published and prizes_json to events if missing
        cur = conn.cursor()
        try:
            cur.execute("ALTER TABLE events ADD COLUMN results_published INTEGER DEFAULT 0")
        except Exception:
            pass
        try:
            cur.execute("ALTER TABLE events ADD COLUMN prizes_json TEXT DEFAULT '[]'")
        except Exception:
            pass

        # Seed default weights if empty
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM rubric_weights")
        if cur.fetchone()[0] == 0:
            for crit, w in DEFAULT_WEIGHTS.items():
                cur.execute("INSERT INTO rubric_weights (criterion, weight) VALUES (?, ?)", (crit, w))

    conn.close()

def log_audit(actor_role: str, actor_id: str, action: str, details: str):
    conn = get_connection()
    with conn:
        cur = conn.cursor()
        cur.execute("SELECT hash FROM audit_logs ORDER BY id DESC LIMIT 1")
        row = cur.fetchone()
        prev_hash = row[0] if row else "0000000000000000000000000000000000000000000000000000000000000000"
        now = datetime.now(timezone.utc).isoformat()
        raw = f"{prev_hash}|{actor_role}|{actor_id}|{action}|{details}|{now}"
        curr_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()
        cur.execute("""
            INSERT INTO audit_logs (actor_role, actor_id, action, details, created_at, prev_hash, hash)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (actor_role, actor_id, action, details, now, prev_hash, curr_hash))
    conn.close()

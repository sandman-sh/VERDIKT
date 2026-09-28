import os
import json
from datetime import datetime, timezone
from src.config import FIXTURES_PATH, TEST_SESSIONS
from src.db import init_db, get_connection, log_audit

def seed_database(fixtures_file: str = FIXTURES_PATH, force: bool = False):
    init_db()
    conn = get_connection()
    cur = conn.cursor()

    # Check if already seeded
    cur.execute("SELECT COUNT(*) FROM projects")
    count = cur.fetchone()[0]
    if count > 0 and not force:
        print("Database already seeded with fixture projects.")
        _print_logins()
        conn.close()
        return

    if not os.path.exists(fixtures_file):
        raise FileNotFoundError(f"Fixtures file not found at: {fixtures_file}")

    with open(fixtures_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    with conn:
        # 1. Event
        evt = data.get("event", {})
        if evt:
            cur.execute("""
                INSERT OR REPLACE INTO events (id, name, submissions_close)
                VALUES (?, ?, ?)
            """, (evt.get("id", "evt_01"), evt.get("name", "Sample Hack 2026"), evt.get("submissions_close", "2026-03-01T18:00:00Z")))

        # 2. Tracks
        for trk in data.get("tracks", []):
            cur.execute("""
                INSERT OR REPLACE INTO tracks (id, name)
                VALUES (?, ?)
            """, (trk["id"], trk["name"]))

        # 3. Judges
        for jdg in data.get("judges", []):
            cur.execute("""
                INSERT OR REPLACE INTO judges (id, name, email, tracks_json)
                VALUES (?, ?, ?, ?)
            """, (jdg["id"], jdg["name"], jdg["email"], json.dumps(jdg.get("tracks", []))))

        # 4. Teams
        for tm in data.get("teams", []):
            cur.execute("""
                INSERT OR REPLACE INTO teams (id, name, members_json)
                VALUES (?, ?, ?)
            """, (tm["id"], tm["name"], json.dumps(tm.get("members", []))))

        # 5. Projects
        for prj in data.get("projects", []):
            cur.execute("""
                INSERT OR REPLACE INTO projects (id, team_id, track_id, title, summary, repo_url, submitted_at, community_votes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                prj["id"],
                prj.get("team", ""),
                prj.get("track", ""),
                prj.get("title", ""),
                prj.get("summary", ""),
                prj.get("repo_url", ""),
                prj.get("submitted_at", datetime.now(timezone.utc).isoformat()),
                0
            ))

        # 6. Scores
        for sc in data.get("scores", []):
            now_iso = datetime.now(timezone.utc).isoformat()
            cur.execute("""
                INSERT OR REPLACE INTO scores (judge_id, project_id, criteria_json, comment, submitted_at)
                VALUES (?, ?, ?, ?, ?)
            """, (
                sc["judge"],
                sc["project"],
                json.dumps(sc.get("criteria", {})),
                sc.get("comment", ""),
                now_iso
            ))

        # 7. Pre-seed sessions
        for token, s in TEST_SESSIONS.items():
            cur.execute("""
                INSERT OR REPLACE INTO sessions (token, user_id, role, name, email, judge_id, team_id, tracks_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                token,
                s["user_id"],
                s["role"],
                s["name"],
                s["email"],
                s.get("judge_id"),
                s.get("team_id"),
                json.dumps(s.get("tracks", []))
            ))

    conn.close()
    log_audit("system", "seed_runner", "SEED_FIXTURES", f"Seeded from {fixtures_file}")
    print("Database seeding completed.")
    _print_logins()

def _print_logins():
    print("seeded. test logins:")
    print("  organizer    Cookie: session=org_7f2a")
    print("  judge_a      Cookie: session=jdg_a_91bc")
    print("  judge_b      Cookie: session=jdg_b_44de")
    print("  participant  Cookie: session=prt_2e88")

if __name__ == "__main__":
    seed_database()

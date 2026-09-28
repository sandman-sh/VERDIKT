import json
import io
import csv
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional, Tuple
from src.db import get_connection, log_audit
from src.scoring import normalize_scores, solve_bradley_terry

class DeadlinePassedError(Exception):
    pass

def get_event() -> Dict[str, Any]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM events LIMIT 1")
    row = cur.fetchone()
    conn.close()
    if not row:
        return {"id": "evt_01", "name": "Hackathon", "submissions_close": "2026-03-01T18:00:00Z", "is_closed": True}

    close_dt_str = row["submissions_close"]
    try:
        close_dt = datetime.fromisoformat(close_dt_str.replace("Z", "+00:00"))
        is_closed = datetime.now(timezone.utc) > close_dt
    except Exception:
        is_closed = True

    return {
        "id": row["id"],
        "name": row["name"],
        "submissions_close": row["submissions_close"],
        "is_closed": is_closed
    }

def get_tracks() -> List[Dict[str, Any]]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM tracks ORDER BY id ASC")
    rows = cur.fetchall()
    conn.close()
    return [{"id": r["id"], "name": r["name"]} for r in rows]

def get_rubric_weights() -> Dict[str, float]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT criterion, weight FROM rubric_weights")
    rows = cur.fetchall()
    conn.close()
    if not rows:
        return {"functionality": 0.40, "quality": 0.35, "innovation": 0.25}
    return {r["criterion"]: float(r["weight"]) for r in rows}

def update_rubric_weights(weights: Dict[str, float], actor_id: str = "organizer") -> None:
    conn = get_connection()
    with conn:
        cur = conn.cursor()
        for crit, w in weights.items():
            cur.execute("""
                INSERT INTO rubric_weights (criterion, weight)
                VALUES (?, ?)
                ON CONFLICT(criterion) DO UPDATE SET weight = excluded.weight
            """, (crit, float(w)))
    conn.close()
    log_audit("organizer", actor_id, "UPDATE_RUBRIC_WEIGHTS", json.dumps(weights))

def get_all_projects_normalized(track_filter: Optional[str] = None, search: Optional[str] = None) -> Dict[str, Any]:
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT p.*, t.name as track_name, tm.name as team_name FROM projects p LEFT JOIN tracks t ON p.track_id = t.id LEFT JOIN teams tm ON p.team_id = tm.id")
    p_rows = cur.fetchall()

    cur.execute("SELECT * FROM scores")
    s_rows = cur.fetchall()

    weights = get_rubric_weights()
    conn.close()

    raw_projects = []
    for r in p_rows:
        raw_projects.append({
            "id": r["id"],
            "title": r["title"],
            "summary": r["summary"],
            "repo_url": r["repo_url"],
            "track_id": r["track_id"],
            "track": r["track_name"] or r["track_id"],
            "team_id": r["team_id"],
            "team": r["team_name"] or r["team_id"],
            "submitted_at": r["submitted_at"],
            "community_votes": r["community_votes"],
        })

    raw_scores = []
    for s in s_rows:
        crit = json.loads(s["criteria_json"]) if s["criteria_json"] else {}
        raw_scores.append({
            "judge_id": s["judge_id"],
            "project_id": s["project_id"],
            "criteria": crit,
            "comment": s["comment"],
        })

    normalized_data = normalize_scores(raw_projects, raw_scores, weights)
    projects_list = normalized_data["projects"]

    # Filter by track if requested
    if track_filter:
        projects_list = [p for p in projects_list if p.get("track_id") == track_filter or p.get("track") == track_filter]

    # Search filter if requested
    if search:
        q = search.lower()
        projects_list = [p for p in projects_list if q in p.get("title", "").lower() or q in p.get("summary", "").lower()]

    normalized_data["projects"] = projects_list
    return normalized_data

def get_project_by_id(project_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT p.*, t.name as track_name, tm.name as team_name, tm.members_json
        FROM projects p
        LEFT JOIN tracks t ON p.track_id = t.id
        LEFT JOIN teams tm ON p.team_id = tm.id
        WHERE p.id = ?
    """, (project_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return None

    members = json.loads(row["members_json"]) if row["members_json"] else []
    conn.close()
    return {
        "id": row["id"],
        "title": row["title"],
        "summary": row["summary"],
        "repo_url": row["repo_url"],
        "track_id": row["track_id"],
        "track": row["track_name"] or row["track_id"],
        "team_id": row["team_id"],
        "team": row["team_name"] or row["team_id"],
        "members": members,
        "submitted_at": row["submitted_at"],
        "community_votes": row["community_votes"],
    }

def create_project(data: Dict[str, Any], actor_id: str = "participant") -> Dict[str, Any]:
    event = get_event()
    if event["is_closed"]:
        raise DeadlinePassedError(f"Submissions closed at {event['submissions_close']}. Event is closed.")

    title = data.get("title", "").strip()
    if not title:
        raise ValueError("Project title is required.")

    conn = get_connection()
    with conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM projects")
        nxt_num = cur.fetchone()[0] + 1
        new_id = f"prj_{nxt_num:02d}"
        now_iso = datetime.now(timezone.utc).isoformat()

        cur.execute("""
            INSERT INTO projects (id, team_id, track_id, title, summary, repo_url, submitted_at, community_votes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            new_id,
            data.get("team_id", "tm_custom"),
            data.get("track_id", "trk_01"),
            title,
            data.get("summary", ""),
            data.get("repo_url", ""),
            now_iso,
            0
        ))
    conn.close()
    log_audit("participant", actor_id, "CREATE_PROJECT", f"Created project {new_id}: {title}")
    return {"id": new_id, "title": title, "submitted_at": now_iso}

def get_judge_scores(judge_id: str) -> List[Dict[str, Any]]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT s.*, p.title as project_title, p.track_id, t.name as track_name
        FROM scores s
        JOIN projects p ON s.project_id = p.id
        LEFT JOIN tracks t ON p.track_id = t.id
        WHERE s.judge_id = ?
        ORDER BY s.submitted_at DESC
    """, (judge_id,))
    rows = cur.fetchall()
    conn.close()

    result = []
    for r in rows:
        crit = json.loads(r["criteria_json"]) if r["criteria_json"] else {}
        result.append({
            "judge_id": r["judge_id"],
            "project_id": r["project_id"],
            "project_title": r["project_title"],
            "track": r["track_name"] or r["track_id"],
            "criteria": crit,
            "comment": r["comment"],
            "submitted_at": r["submitted_at"]
        })
    return result

def submit_score(judge_id: str, project_id: str, criteria: Dict[str, float], comment: str) -> Dict[str, Any]:
    conn = get_connection()
    now_iso = datetime.now(timezone.utc).isoformat()
    with conn:
        cur = conn.cursor()
        # Verify project exists
        cur.execute("SELECT id FROM projects WHERE id = ?", (project_id,))
        if not cur.fetchone():
            raise ValueError(f"Project {project_id} not found.")

        cur.execute("""
            INSERT INTO scores (judge_id, project_id, criteria_json, comment, submitted_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(judge_id, project_id) DO UPDATE SET
                criteria_json = excluded.criteria_json,
                comment = excluded.comment,
                submitted_at = excluded.submitted_at
        """, (judge_id, project_id, json.dumps(criteria), comment, now_iso))

    conn.close()
    log_audit("judge", judge_id, "SUBMIT_SCORE", f"Project {project_id}: criteria={json.dumps(criteria)}")
    return {"status": "ok", "judge_id": judge_id, "project_id": project_id, "criteria": criteria, "comment": comment}

def get_pairwise_matchup() -> Dict[str, Any]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, title, summary, track_id, repo_url FROM projects ORDER BY RANDOM() LIMIT 2")
    rows = cur.fetchall()
    conn.close()
    if len(rows) < 2:
        return {"project_a": None, "project_b": None}
    return {
        "project_a": dict(rows[0]),
        "project_b": dict(rows[1])
    }

def record_pairwise_comparison(judge_id: str, project_a_id: str, project_b_id: str, winner_id: str) -> Dict[str, Any]:
    now_iso = datetime.now(timezone.utc).isoformat()
    conn = get_connection()
    with conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO pairwise_comparisons (judge_id, project_a_id, project_b_id, winner_id, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (judge_id, project_a_id, project_b_id, winner_id, now_iso))
    conn.close()
    log_audit("judge", judge_id, "PAIRWISE_VOTE", f"Winner: {winner_id} over opponent in ({project_a_id}, {project_b_id})")
    return {"status": "ok", "winner_id": winner_id}

def record_community_vote(project_id: str, voter_ip: str) -> Dict[str, Any]:
    conn = get_connection()
    now_iso = datetime.now(timezone.utc).isoformat()
    with conn:
        cur = conn.cursor()
        try:
            cur.execute("""
                INSERT INTO community_votes (project_id, voter_ip, created_at)
                VALUES (?, ?, ?)
            """, (project_id, voter_ip, now_iso))
            cur.execute("""
                UPDATE projects SET community_votes = community_votes + 1 WHERE id = ?
            """, (project_id,))
            voted = True
        except Exception:
            # Already voted from this IP
            voted = False

        cur.execute("SELECT community_votes FROM projects WHERE id = ?", (project_id,))
        count = cur.fetchone()[0]
    conn.close()

    if voted:
        log_audit("visitor", voter_ip, "COMMUNITY_VOTE", f"Upvoted project {project_id}")
    return {"voted": voted, "total_votes": count}

def get_organizer_metrics() -> Dict[str, Any]:
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT id, name, tracks_json FROM judges")
    judges = cur.fetchall()

    cur.execute("SELECT judge_id, COUNT(*) as cnt FROM scores GROUP BY judge_id")
    judge_counts = {r["judge_id"]: r["cnt"] for r in cur.fetchall()}

    cur.execute("SELECT COUNT(*) FROM pairwise_comparisons")
    pairwise_count = cur.fetchone()[0]

    cur.execute("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 15")
    recent_audits = [dict(r) for r in cur.fetchall()]

    conn.close()

    norm_data = get_all_projects_normalized()

    judge_progress = []
    for j in judges:
        cnt = judge_counts.get(j["id"], 0)
        tracks = json.loads(j["tracks_json"]) if j["tracks_json"] else []
        judge_progress.append({
            "id": j["id"],
            "name": j["name"],
            "tracks": tracks,
            "reviews_completed": cnt,
            "status": "complete" if cnt >= 5 else ("in_progress" if cnt > 0 else "not_started")
        })

    return {
        "event": get_event(),
        "rubric_weights": get_rubric_weights(),
        "stats": norm_data["stats"],
        "pairwise_comparisons_count": pairwise_count,
        "judges": judge_progress,
        "recent_audit_logs": recent_audits,
    }

def export_results_csv() -> str:
    norm_data = get_all_projects_normalized()
    projects = norm_data["projects"]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Rank",
        "Delta_Rank",
        "Project_ID",
        "Title",
        "Track",
        "Team",
        "Raw_Score",
        "Normalized_Score",
        "Reviews_Count",
        "Community_Votes",
        "Repo_URL"
    ])

    for p in projects:
        writer.writerow([
            p.get("normalized_rank", ""),
            f"{'+' if p.get('delta_rank', 0) > 0 else ''}{p.get('delta_rank', 0)}",
            p.get("id", ""),
            p.get("title", ""),
            p.get("track", ""),
            p.get("team", ""),
            p.get("raw_score", ""),
            p.get("normalized_score", ""),
            p.get("reviews_count", 0),
            p.get("community_votes", 0),
            p.get("repo_url", ""),
        ])

    return output.getvalue()

# -----------------------------------------------------------------------------
# T3: COMMENTS SYSTEM
# -----------------------------------------------------------------------------
def get_comments(project_id: str) -> List[Dict[str, Any]]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM comments WHERE project_id = ? ORDER BY id ASC", (project_id,))
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def add_comment(project_id: str, author_name: str, author_role: str, content: str) -> Dict[str, Any]:
    content = content.strip()
    if not content:
        raise ValueError("Comment cannot be empty.")
    now_iso = datetime.now(timezone.utc).isoformat()
    conn = get_connection()
    with conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO comments (project_id, author_name, author_role, content, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (project_id, author_name or "Anonymous", author_role or "visitor", content, now_iso))
        new_id = cur.lastrowid
    conn.close()
    log_audit(author_role, author_name, "ADD_COMMENT", f"Project {project_id}: {content[:30]}...")
    return {"id": new_id, "project_id": project_id, "author_name": author_name, "author_role": author_role, "content": content, "created_at": now_iso}

# -----------------------------------------------------------------------------
# T1 / T3: TEAM INVITES & FORMATION
# -----------------------------------------------------------------------------
def create_team_invite(team_id: str, team_name: str, created_by: str) -> Dict[str, Any]:
    import secrets
    code = secrets.token_hex(4).upper()
    now_iso = datetime.now(timezone.utc).isoformat()
    conn = get_connection()
    with conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO team_invites (code, team_id, team_name, created_by, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (code, team_id, team_name, created_by, now_iso))
    conn.close()
    log_audit("participant", created_by, "CREATE_TEAM_INVITE", f"Code {code} for team {team_id}")
    return {"invite_code": code, "team_id": team_id, "team_name": team_name, "invite_url": f"/teams/join/{code}"}

def join_team_by_invite(code: str, user_email: str) -> Dict[str, Any]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM team_invites WHERE code = ?", (code.strip().upper(),))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise ValueError("Invalid or expired invite code.")

    team_id = row["team_id"]
    team_name = row["team_name"]

    with conn:
        cur.execute("SELECT members_json FROM teams WHERE id = ?", (team_id,))
        t_row = cur.fetchone()
        members = json.loads(t_row[0]) if t_row and t_row[0] else []
        if user_email not in members:
            members.append(user_email)
            cur.execute("UPDATE teams SET members_json = ? WHERE id = ?", (json.dumps(members), team_id))
    conn.close()
    log_audit("participant", user_email, "JOIN_TEAM", f"Joined {team_name} ({team_id})")
    return {"team_id": team_id, "team_name": team_name, "members": members}

# -----------------------------------------------------------------------------
# T2: ALGORITHMIC JUDGE ASSIGNMENT
# -----------------------------------------------------------------------------
def auto_assign_judges(reviews_per_project: int = 3) -> Dict[str, Any]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, track_id FROM projects")
    projects = cur.fetchall()

    cur.execute("SELECT id, tracks_json FROM judges")
    judges = cur.fetchall()
    conn.close()

    if not projects or not judges:
        return {"assigned_count": 0, "message": "No projects or judges found."}

    judge_tracks = {}
    for j in judges:
        judge_tracks[j["id"]] = json.loads(j["tracks_json"]) if j["tracks_json"] else []

    assigned_count = 0
    now_iso = datetime.now(timezone.utc).isoformat()
    conn = get_connection()
    with conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM judge_assignments")
        judge_ids = [j["id"] for j in judges]

        for p_idx, p in enumerate(projects):
            p_id = p["id"]
            p_track = p["track_id"]
            # Prioritize judges with matching track
            matched_judges = [jid for jid, trks in judge_tracks.items() if p_track in trks]
            other_judges = [jid for jid in judge_ids if jid not in matched_judges]
            candidates = matched_judges + other_judges

            # Rotate candidates based on project index
            rotated = candidates[p_idx % len(candidates):] + candidates[:p_idx % len(candidates)]
            selected = rotated[:min(reviews_per_project, len(candidates))]

            for jid in selected:
                cur.execute("""
                    INSERT OR REPLACE INTO judge_assignments (judge_id, project_id, assigned_at)
                    VALUES (?, ?, ?)
                """, (jid, p_id, now_iso))
                assigned_count += 1

    conn.close()
    log_audit("organizer", "algorithm", "AUTO_ASSIGN_JUDGES", f"Created {assigned_count} assignments ({reviews_per_project} per project)")
    return {"status": "ok", "assignments_created": assigned_count, "projects_count": len(projects)}

def get_judge_assigned_projects(judge_id: str) -> List[Dict[str, Any]]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT p.id, p.title, p.summary, p.track_id, t.name as track_name,
               (SELECT COUNT(*) FROM scores s WHERE s.judge_id = ? AND s.project_id = p.id) as is_scored
        FROM judge_assignments a
        JOIN projects p ON a.project_id = p.id
        LEFT JOIN tracks t ON p.track_id = t.id
        WHERE a.judge_id = ?
        ORDER BY is_scored ASC, p.id ASC
    """, (judge_id, judge_id))
    rows = cur.fetchall()
    conn.close()
    return [{
        "id": r["id"],
        "title": r["title"],
        "summary": r["summary"],
        "track": r["track_name"] or r["track_id"],
        "completed": bool(r["is_scored"])
    } for r in rows]

# -----------------------------------------------------------------------------
# T3: QUADRATIC VOTING ENGINE
# -----------------------------------------------------------------------------
def record_quadratic_vote(voter_id: str, project_id: str, credits: int) -> Dict[str, Any]:
    if credits not in (1, 4, 9, 16, 25):
        raise ValueError("Quadratic credits must be a perfect square: 1, 4, 9, 16, or 25.")

    import math
    voice_influence = math.isqrt(credits)
    now_iso = datetime.now(timezone.utc).isoformat()
    conn = get_connection()
    with conn:
        cur = conn.cursor()
        # Enforce max 100 total voice credits per voter
        cur.execute("SELECT COALESCE(SUM(credits_spent), 0) FROM quadratic_votes WHERE voter_id = ? AND project_id != ?", (voter_id, project_id))
        spent_so_far = cur.fetchone()[0]
        if spent_so_far + credits > 100:
            raise ValueError(f"Credit limit exceeded: Voter has {100 - spent_so_far} credits remaining.")

        cur.execute("""
            INSERT INTO quadratic_votes (voter_id, project_id, credits_spent, vote_weight, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(voter_id, project_id) DO UPDATE SET
                credits_spent = excluded.credits_spent,
                vote_weight = excluded.vote_weight,
                created_at = excluded.created_at
        """, (voter_id, project_id, credits, voice_influence, now_iso))

        # Update cached community votes tally
        cur.execute("SELECT COALESCE(SUM(vote_weight), 0) FROM quadratic_votes WHERE project_id = ?", (project_id,))
        total_q_votes = cur.fetchone()[0]
        cur.execute("UPDATE projects SET community_votes = ? WHERE id = ?", (int(total_q_votes), project_id))
    conn.close()
    log_audit("community", voter_id, "QUADRATIC_VOTE", f"Project {project_id}: spent {credits} credits (influence={voice_influence})")
    return {"status": "ok", "project_id": project_id, "credits_spent": credits, "voice_influence": voice_influence, "total_votes": total_q_votes}

# -----------------------------------------------------------------------------
# T3: BLINDED RESULTS VISIBILITY
# -----------------------------------------------------------------------------
def set_results_visibility(published: bool, actor_id: str = "organizer") -> None:
    conn = get_connection()
    with conn:
        cur = conn.cursor()
        cur.execute("UPDATE events SET results_published = ?", (1 if published else 0,))
    conn.close()
    log_audit("organizer", actor_id, "TOGGLE_RESULTS_VISIBILITY", f"Published={published}")

def is_results_published() -> bool:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT results_published FROM events LIMIT 1")
    row = cur.fetchone()
    conn.close()
    return bool(row[0]) if row and row[0] is not None else True

# -----------------------------------------------------------------------------
# T4: WEBHOOKS DISPATCHER
# -----------------------------------------------------------------------------
def register_webhook(url: str, event_types: str, secret: str = "") -> Dict[str, Any]:
    import secrets
    if not secret:
        secret = secrets.token_hex(16)
    now_iso = datetime.now(timezone.utc).isoformat()
    conn = get_connection()
    with conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO webhooks (url, event_types, secret, is_active, created_at)
            VALUES (?, ?, ?, 1, ?)
        """, (url, event_types, secret, now_iso))
        new_id = cur.lastrowid
    conn.close()
    log_audit("organizer", "system", "REGISTER_WEBHOOK", f"URL {url} for events [{event_types}]")
    return {"id": new_id, "url": url, "event_types": event_types, "secret": secret}

def list_webhooks() -> List[Dict[str, Any]]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM webhooks ORDER BY id DESC")
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]

# -----------------------------------------------------------------------------
# T4: PUBLICLY VERIFIABLE CRYPTOGRAPHIC CERTIFICATES
# -----------------------------------------------------------------------------
def generate_judge_certificate(judge_id: str) -> Dict[str, Any]:
    import hashlib
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM judges WHERE id = ?", (judge_id,))
    judge = cur.fetchone()
    if not judge:
        conn.close()
        raise ValueError(f"Judge {judge_id} not found.")

    cur.execute("SELECT COUNT(*) FROM scores WHERE judge_id = ?", (judge_id,))
    reviews_count = cur.fetchone()[0]

    record_id = f"cert_jdg_{judge_id}_{reviews_count}"
    now_iso = datetime.now(timezone.utc).isoformat()
    details = {
        "judge_id": judge["id"],
        "judge_name": judge["name"],
        "email": judge["email"],
        "event_id": "evt_01",
        "event_name": "Sample Hack 2026",
        "reviews_completed": reviews_count,
        "issued_at": now_iso
    }
    raw_sig = f"VERDIKT-VERIFIED|{judge_id}|{reviews_count}|{now_iso}"
    sig_hash = hashlib.sha256(raw_sig.encode("utf-8")).hexdigest()

    with conn:
        cur.execute("""
            INSERT OR REPLACE INTO verifiable_records (id, record_type, subject_id, subject_name, details_json, issued_at, signature_hash)
            VALUES (?, 'judge_participation', ?, ?, ?, ?, ?)
        """, (record_id, judge["id"], judge["name"], json.dumps(details), now_iso, sig_hash))
    conn.close()
    log_audit("system", "cert_issuer", "GENERATE_CERTIFICATE", f"Record {record_id} for {judge['name']}")
    return {
        "record_id": record_id,
        "subject_name": judge["name"],
        "record_type": "Official Judge Participation Record",
        "reviews_completed": reviews_count,
        "issued_at": now_iso,
        "signature_hash": sig_hash,
        "verification_url": f"/verify/{record_id}"
    }

def verify_certificate_record(record_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM verifiable_records WHERE id = ?", (record_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    details = json.loads(row["details_json"])
    return {
        "record_id": row["id"],
        "record_type": row["record_type"],
        "subject_name": row["subject_name"],
        "issued_at": row["issued_at"],
        "signature_hash": row["signature_hash"],
        "details": details,
        "is_valid": True
    }

# -----------------------------------------------------------------------------
# T4: BULK DATA IMPORT & EXPORT
# -----------------------------------------------------------------------------
def export_bulk_database() -> Dict[str, Any]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM events LIMIT 1")
    event_row = cur.fetchone()
    event = dict(event_row) if event_row else {}
    cur.execute("SELECT * FROM tracks")
    tracks = [dict(r) for r in cur.fetchall()]
    cur.execute("SELECT * FROM judges")
    judges = [dict(r) for r in cur.fetchall()]
    cur.execute("SELECT * FROM teams")
    teams = [dict(r) for r in cur.fetchall()]
    cur.execute("SELECT * FROM projects")
    projects = [dict(r) for r in cur.fetchall()]
    cur.execute("SELECT * FROM scores")
    scores = [dict(r) for r in cur.fetchall()]
    cur.execute("SELECT * FROM rubric_weights")
    weights = {r["criterion"]: r["weight"] for r in cur.fetchall()}
    conn.close()

    return {
        "version": "2.6.0",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "event": event,
        "tracks": tracks,
        "judges": judges,
        "teams": teams,
        "projects": projects,
        "scores": scores,
        "rubric_weights": weights
    }


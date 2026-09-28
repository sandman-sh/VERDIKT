import json
from typing import Optional, Dict, Any
from src.db import get_connection
from src.config import TEST_SESSIONS

class User:
    def __init__(self, user_id: str, role: str, name: str, email: str, judge_id: Optional[str] = None, team_id: Optional[str] = None, tracks: Optional[list] = None):
        self.user_id = user_id
        self.role = role # 'organizer', 'judge', 'participant', 'visitor'
        self.name = name
        self.email = email
        self.judge_id = judge_id
        self.team_id = team_id
        self.tracks = tracks or []

    @property
    def is_organizer(self) -> bool:
        return self.role in ("organizer", "admin")

    @property
    def is_judge(self) -> bool:
        return self.role == "judge"

    @property
    def is_participant(self) -> bool:
        return self.role == "participant"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "role": self.role,
            "name": self.name,
            "email": self.email,
            "judge_id": self.judge_id,
            "team_id": self.team_id,
            "tracks": self.tracks,
        }

def get_user_from_headers(headers: Any) -> Optional[User]:
    """
    Extracts session token from Cookie or Authorization header.
    Resolves against DB sessions table or built-in test sessions.
    """
    cookie_str = headers.get("Cookie", "") or headers.get("cookie", "")
    auth_header = headers.get("Authorization", "") or headers.get("authorization", "")

    token = None
    if cookie_str:
        for part in cookie_str.split(";"):
            part = part.strip()
            if part.startswith("session="):
                token = part[len("session="):].strip()
                break

    if not token and auth_header:
        if auth_header.lower().startswith("bearer "):
            token = auth_header[7:].strip()
        elif auth_header.lower().startswith("session="):
            token = auth_header[8:].strip()
        else:
            token = auth_header.strip()

    if not token:
        return None

    # Check pre-seeded test sessions first
    if token in TEST_SESSIONS:
        s = TEST_SESSIONS[token]
        return User(
            user_id=s["user_id"],
            role=s["role"],
            name=s["name"],
            email=s["email"],
            judge_id=s.get("judge_id"),
            team_id=s.get("team_id"),
            tracks=s.get("tracks", []),
        )

    # Check database sessions
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM sessions WHERE token = ?", (token,))
    row = cur.fetchone()
    conn.close()

    if row:
        tracks = json.loads(row["tracks_json"]) if row["tracks_json"] else []
        return User(
            user_id=row["user_id"],
            role=row["role"],
            name=row["name"],
            email=row["email"],
            judge_id=row["judge_id"],
            team_id=row["team_id"],
            tracks=tracks,
        )

    return None

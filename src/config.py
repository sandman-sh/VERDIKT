import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = os.environ.get("DB_PATH", str(BASE_DIR / "dogfood.db"))
FIXTURES_PATH = os.environ.get("FIXTURES_PATH", str(BASE_DIR / "fixtures.json"))

# Server Config
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8080"))

# Default Rubric Weights
DEFAULT_WEIGHTS = {
    "functionality": 0.40,
    "quality": 0.35,
    "innovation": 0.25,
}

# Pre-seeded test sessions matching .dogfood.toml
TEST_SESSIONS = {
    "org_7f2a": {
        "user_id": "usr_org_01",
        "role": "organizer",
        "name": "Event Director",
        "email": "director@verdikt.dev",
        "judge_id": None,
        "team_id": None,
    },
    "jdg_a_91bc": {
        "user_id": "usr_jdg_01",
        "role": "judge",
        "name": "Tomas Varga",
        "email": "tomas.varga@example.org",
        "judge_id": "jdg_01",
        "team_id": None,
        "tracks": ["trk_03"],
    },
    "jdg_b_44de": {
        "user_id": "usr_jdg_02",
        "role": "judge",
        "name": "Wei Lindqvist",
        "email": "wei.lindqvist@example.org",
        "judge_id": "jdg_02",
        "team_id": None,
        "tracks": ["trk_02", "trk_04"],
    },
    "prt_2e88": {
        "user_id": "usr_prt_01",
        "role": "participant",
        "name": "Priya Nair",
        "email": "priya1@example.org",
        "judge_id": None,
        "team_id": "tm_01",
    },
}

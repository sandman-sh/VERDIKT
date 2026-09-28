#!/usr/bin/env python3
"""
Unit and integration tests for VERDIKT DOGFOOD platform.
Tests role isolation, normalization math, deadline enforcement, and CSV exports.
"""

import unittest
import json
import io
import csv
import sys
import os
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.db import init_db, get_connection
from src.seed import seed_database
from src.models import (
    get_event,
    get_all_projects_normalized,
    create_project,
    get_judge_scores,
    submit_score,
    record_pairwise_comparison,
    record_community_vote,
    export_results_csv,
    DeadlinePassedError,
)
from src.scoring import compute_raw_score, normalize_scores, solve_bradley_terry

class TestDogfoodPortal(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        seed_database()

    def test_01_fixture_count(self):
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM projects")
        p_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM judges")
        j_count = cur.fetchone()[0]
        conn.close()

        self.assertGreaterEqual(p_count, 40, "Expected at least 40 fixture projects")
        self.assertGreaterEqual(j_count, 30, "Expected at least 30 fixture judges")

    def test_02_deadline_enforcement(self):
        event = get_event()
        self.assertTrue(event["is_closed"], "Event deadline should be closed based on fixture timestamp")
        
        with self.assertRaises(DeadlinePassedError):
            create_project({"title": "Late Project", "summary": "Should fail"})

    def test_03_bayesian_normalization_zero_variance_judge(self):
        """Tests that a judge giving all identical scores does not cause division by zero."""
        fake_projects = [{"id": f"p_{i}", "title": f"Project {i}"} for i in range(5)]
        fake_scores = [
            # Flat judge giving all 4s
            {"judge": "flat_judge", "project": "p_0", "criteria": {"functionality": 4, "quality": 4, "innovation": 4}},
            {"judge": "flat_judge", "project": "p_1", "criteria": {"functionality": 4, "quality": 4, "innovation": 4}},
            {"judge": "flat_judge", "project": "p_2", "criteria": {"functionality": 4, "quality": 4, "innovation": 4}},
            # Normal judge
            {"judge": "normal_judge", "project": "p_0", "criteria": {"functionality": 2, "quality": 3, "innovation": 2}},
            {"judge": "normal_judge", "project": "p_1", "criteria": {"functionality": 5, "quality": 4, "innovation": 5}},
        ]
        weights = {"functionality": 0.40, "quality": 0.35, "innovation": 0.25}

        result = normalize_scores(fake_projects, fake_scores, weights)
        self.assertIn("projects", result)
        self.assertIn("stats", result)
        self.assertEqual(result["stats"]["zero_variance_judges_stabilized"], 1)

        for p in result["projects"]:
            self.assertFalse(any(isinstance(val, float) and (val != val) for val in p.values()), "No NaN values allowed")

    def test_04_bradley_terry_pairwise(self):
        """Tests Bradley-Terry convergence for pairwise comparative evaluation."""
        projects = [{"id": "A"}, {"id": "B"}, {"id": "C"}]
        # A beats B, B beats C, A beats C
        comparisons = [
            {"project_a_id": "A", "project_b_id": "B", "winner_id": "A"},
            {"project_a_id": "B", "project_b_id": "C", "winner_id": "B"},
            {"project_a_id": "A", "project_b_id": "C", "winner_id": "A"},
        ]
        ratings = solve_bradley_terry(projects, comparisons, iterations=30)
        self.assertGreater(ratings["A"], ratings["B"], "A should outrank B")
        self.assertGreater(ratings["B"], ratings["C"], "B should outrank C")

    def test_05_csv_export_format(self):
        csv_data = export_results_csv()
        reader = csv.reader(io.StringIO(csv_data))
        header = next(reader)
        self.assertIn("Rank", header)
        self.assertIn("Normalized_Score", header)
        self.assertIn("Delta_Rank", header)
        rows = list(reader)
        self.assertGreaterEqual(len(rows), 40, "Expected at least 40 project rows in CSV")

    def test_06_community_voting_ip_deduplication(self):
        import uuid
        test_ip = f"10.99.{uuid.uuid4().hex[:4]}.1"
        res1 = record_community_vote("prj_01", test_ip)
        self.assertTrue(res1["voted"])
        # Second vote from same IP on same project should be rejected
        res2 = record_community_vote("prj_01", test_ip)
        self.assertFalse(res2["voted"], "Duplicate vote from same IP must be rejected")

    def test_07_comments_system(self):
        from src.models import add_comment, get_comments
        comment = add_comment("prj_01", "Alice Hacker", "participant", "Exciting architecture!")
        self.assertIn("id", comment)
        self.assertEqual(comment["author_name"], "Alice Hacker")
        all_comments = get_comments("prj_01")
        self.assertTrue(any(c["content"] == "Exciting architecture!" for c in all_comments))

    def test_08_team_invite_and_join(self):
        from src.models import create_team_invite, join_team_by_invite
        invite = create_team_invite("tm_01", "Team Alpha", "user_1")
        self.assertEqual(len(invite["invite_code"]), 8)
        joined = join_team_by_invite(invite["invite_code"], "new_member@example.com")
        self.assertEqual(joined["team_id"], "tm_01")
        self.assertIn("new_member@example.com", joined["members"])

    def test_09_auto_assign_judges(self):
        from src.models import auto_assign_judges, get_judge_assigned_projects
        res = auto_assign_judges(reviews_per_project=2)
        self.assertEqual(res["status"], "ok")
        self.assertGreater(res["assignments_created"], 0)
        assigned = get_judge_assigned_projects("jdg_01")
        self.assertIsInstance(assigned, list)

    def test_10_quadratic_voting_and_credits_limit(self):
        from src.models import record_quadratic_vote
        # 16 credits spent = 4 voice influence
        res = record_quadratic_vote("voter_test_1", "prj_02", 16)
        self.assertEqual(res["credits_spent"], 16)
        self.assertEqual(res["voice_influence"], 4)

        # Invalid credits (not a perfect square in 1, 4, 9, 16, 25)
        with self.assertRaises(ValueError):
            record_quadratic_vote("voter_test_1", "prj_03", 7)

    def test_11_cryptographic_certificate_verification(self):
        from src.models import generate_judge_certificate, verify_certificate_record
        cert = generate_judge_certificate("jdg_01")
        self.assertIn("signature_hash", cert)
        self.assertIn("record_id", cert)

        verified = verify_certificate_record(cert["record_id"])
        self.assertIsNotNone(verified)
        self.assertTrue(verified["is_valid"])
        self.assertEqual(verified["signature_hash"], cert["signature_hash"])

    def test_12_results_visibility_toggle(self):
        from src.models import set_results_visibility, is_results_published
        set_results_visibility(False)
        self.assertFalse(is_results_published())
        set_results_visibility(True)
        self.assertTrue(is_results_published())

    def test_13_bulk_database_export(self):
        from src.models import export_bulk_database
        bulk = export_bulk_database()
        self.assertIn("version", bulk)
        self.assertIn("projects", bulk)
        self.assertIn("judges", bulk)
        self.assertGreaterEqual(len(bulk["projects"]), 40)

if __name__ == "__main__":
    unittest.main()


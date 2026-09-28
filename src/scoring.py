import math
import json
from collections import defaultdict
from typing import Dict, List, Tuple, Any

def compute_raw_score(criteria_scores: Dict[str, float], weights: Dict[str, float]) -> float:
    """Computes weighted average score for a single evaluation."""
    if not criteria_scores:
        return 0.0
    
    # Normalize weights so they sum to 1.0 across present criteria
    active_weights = {k: weights.get(k, 1.0) for k in criteria_scores.keys()}
    total_w = sum(active_weights.values())
    if total_w <= 0:
        return sum(criteria_scores.values()) / len(criteria_scores)
    
    weighted_sum = sum(criteria_scores[k] * (active_weights[k] / total_w) for k in criteria_scores.keys())
    return weighted_sum

def normalize_scores(
    projects: List[Dict[str, Any]],
    scores: List[Dict[str, Any]],
    weights: Dict[str, float]
) -> Dict[str, Any]:
    """
    Bayesian Mean-Centered Standardized Normalization (Bayesian Z-Score).
    Eliminates cross-judge grading bias, handles zero-variance judges (sigma=0),
    and prevents extreme distortions for judges with few reviews via cohort prior shrinkage.
    """
    if not projects:
        return {"projects": [], "stats": {}}

    # 1. Calculate raw score per evaluation
    # judge_id -> list of raw scores
    judge_evals = defaultdict(list)
    project_evals = defaultdict(list)
    all_raw_evals = []

    for s in scores:
        j_id = s["judge"] if "judge" in s else s["judge_id"]
        p_id = s["project"] if "project" in s else s["project_id"]
        crit = s.get("criteria", {})
        if isinstance(crit, str):
            crit = json.loads(crit)
        
        raw_val = compute_raw_score(crit, weights)
        judge_evals[j_id].append({"project_id": p_id, "score": raw_val})
        project_evals[p_id].append({"judge_id": j_id, "score": raw_val})
        all_raw_evals.append(raw_val)

    # 2. Compute global cohort parameters
    if all_raw_evals:
        cohort_mean = sum(all_raw_evals) / len(all_raw_evals)
        cohort_var = sum((x - cohort_mean) ** 2 for x in all_raw_evals) / max(1, len(all_raw_evals) - 1)
        cohort_std = math.sqrt(cohort_var) if cohort_var > 0 else 0.8
    else:
        cohort_mean = 3.5
        cohort_std = 0.8

    # 3. Compute Bayesian parameters per judge with shrinkage
    # Prior weight M = 2.0 pseudo-observations towards cohort standard deviation
    PRIOR_WEIGHT_M = 2.0
    judge_params = {}

    for j_id, evals in judge_evals.items():
        n = len(evals)
        scores_list = [e["score"] for e in evals]
        j_mean = sum(scores_list) / n
        
        # Uncalibrated sample sum of squared deviations
        ss_dev = sum((x - j_mean) ** 2 for x in scores_list)
        
        # Bayesian regularized variance: shrinks towards cohort_std^2
        # Prevents division by zero for judges with identical scores (e.g. jdg_07 giving all 4s)
        shrunk_var = (ss_dev + PRIOR_WEIGHT_M * (cohort_std ** 2)) / (n + PRIOR_WEIGHT_M)
        shrunk_std = math.sqrt(max(1e-4, shrunk_var))
        
        judge_params[j_id] = {
            "mean": j_mean,
            "std": shrunk_std,
            "raw_std": math.sqrt(ss_dev / max(1, n - 1)) if n > 1 else 0.0,
            "count": n
        }

    # 4. Standardize each evaluation and map back to normalized 1-5 scale
    project_results = []
    for p in projects:
        p_id = p["id"]
        evals = project_evals.get(p_id, [])
        num_reviews = len(evals)
        
        if num_reviews == 0:
            raw_avg = 0.0
            norm_avg = 0.0
        else:
            raw_avg = sum(e["score"] for e in evals) / num_reviews
            norm_scores = []
            for e in evals:
                j_id = e["judge_id"]
                params = judge_params.get(j_id, {"mean": cohort_mean, "std": cohort_std})
                # Z-score standardization
                z = (e["score"] - params["mean"]) / params["std"]
                # Calibrate back to global cohort scale
                calibrated = cohort_mean + z * cohort_std
                # Bound between 1.0 and 5.0
                norm_scores.append(max(1.0, min(5.0, calibrated)))
            norm_avg = sum(norm_scores) / num_reviews

        project_results.append({
            "id": p_id,
            "title": p.get("title", ""),
            "track": p.get("track", p.get("track_id", "")),
            "team": p.get("team", p.get("team_id", "")),
            "summary": p.get("summary", ""),
            "repo_url": p.get("repo_url", ""),
            "submitted_at": p.get("submitted_at", ""),
            "community_votes": p.get("community_votes", 0),
            "reviews_count": num_reviews,
            "raw_score": round(raw_avg, 3),
            "normalized_score": round(norm_avg, 3),
        })

    # 5. Compute Ranks and Delta Ranks
    # Sort by raw score descending
    project_results.sort(key=lambda x: (x["raw_score"], x["reviews_count"]), reverse=True)
    for idx, p in enumerate(project_results):
        p["raw_rank"] = idx + 1 if p["reviews_count"] > 0 else len(project_results)

    # Sort by normalized score descending
    project_results.sort(key=lambda x: (x["normalized_score"], x["reviews_count"]), reverse=True)
    for idx, p in enumerate(project_results):
        p["normalized_rank"] = idx + 1 if p["reviews_count"] > 0 else len(project_results)
        # Delta = raw_rank - normalized_rank
        # If raw_rank was 15 and normalized_rank is 11, Delta is +4 (Moved UP 4 positions!)
        p["delta_rank"] = p["raw_rank"] - p["normalized_rank"]

    # Compute variance reduction proof metrics
    raw_spread = [p["raw_score"] for p in project_results if p["reviews_count"] > 0]
    norm_spread = [p["normalized_score"] for p in project_results if p["reviews_count"] > 0]

    raw_var = sum((x - sum(raw_spread)/len(raw_spread))**2 for x in raw_spread)/max(1, len(raw_spread)-1) if raw_spread else 0
    norm_var = sum((x - sum(norm_spread)/len(norm_spread))**2 for x in norm_spread)/max(1, len(norm_spread)-1) if norm_spread else 0

    return {
        "projects": project_results,
        "stats": {
            "total_projects": len(projects),
            "total_evaluations": len(all_raw_evals),
            "cohort_mean": round(cohort_mean, 3),
            "cohort_std": round(cohort_std, 3),
            "raw_variance": round(raw_var, 4),
            "normalized_variance": round(norm_var, 4),
            "judges_calibrated": len(judge_params),
            "zero_variance_judges_stabilized": sum(1 for p in judge_params.values() if p["raw_std"] == 0),
        }
    }

def solve_bradley_terry(
    projects: List[Dict[str, Any]],
    comparisons: List[Dict[str, Any]],
    iterations: int = 50
) -> Dict[str, float]:
    """
    Solves for latent quality parameters beta in Bradley-Terry model using MM algorithm.
    P(A beats B) = exp(beta_A) / (exp(beta_A) + exp(beta_B)) = pi_A / (pi_A + pi_B)
    """
    p_ids = [p["id"] for p in projects]
    if not p_ids:
        return {}
    
    # Wins matrix W[i][j] = number of times i beat j
    wins = defaultdict(lambda: defaultdict(int))
    total_wins = defaultdict(int)

    for c in comparisons:
        w = c["winner_id"]
        l = c["project_b_id"] if c["project_a_id"] == w else c["project_a_id"]
        wins[w][l] += 1
        total_wins[w] += 1

    # Initialize pi_i = 1.0 (with Laplace smoothing +0.5 to keep connected)
    pi = {pid: 1.0 for pid in p_ids}

    for _ in range(iterations):
        new_pi = {}
        for i in p_ids:
            denom = 0.0
            for j in p_ids:
                if i != j:
                    matches = wins[i][j] + wins[j][i]
                    if matches > 0:
                        denom += matches / (pi[i] + pi[j])
            w_i = total_wins[i] + 0.1 # Prior smoothing
            denom = denom + 0.1
            new_pi[i] = w_i / denom if denom > 0 else 1.0

        # Geometric mean normalization so product(pi) = 1
        log_sum = sum(math.log(max(1e-5, p)) for p in new_pi.values())
        norm_factor = math.exp(log_sum / len(p_ids))
        pi = {k: v / norm_factor for k, v in new_pi.items()}

    # Convert to log scale beta (normalized 1.0 to 5.0)
    raw_betas = {k: math.log(max(1e-5, v)) for k, v in pi.items()}
    min_b = min(raw_betas.values()) if raw_betas else 0
    max_b = max(raw_betas.values()) if raw_betas else 1
    span = max(1e-4, max_b - min_b)

    scaled_ratings = {k: round(1.0 + 4.0 * (v - min_b) / span, 2) for k, v in raw_betas.items()}
    return scaled_ratings

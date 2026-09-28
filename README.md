# VERDIKT // AUTONOMOUS EVALUATION PLATFORM

<div align="center">
  <img src="src/static/img/pixel_camp_hero.jpg" alt="VERDIKT Platform Banner" width="100%" style="border-radius: 6px; border: 2px solid #7c3aed;" />
</div>

> **"Rigorous evaluation, mathematical precision, and uncompromising transparency."**  
> **Verdikt** is an enterprise-ready, air-gapped, open-source project submission and judging platform engineered to replace spreadsheets and black-box normalization with mathematical rigor, operational security, and an intuitive terminal-inspired interface.

[![Acceptance Suite](https://img.shields.io/badge/Acceptance%20Suite-100%25%20Verified-00c758?style=flat-square)](#system-verification)
[![Unit Tests](https://img.shields.io/badge/Unit%20Tests-13%2F13%20Passing-00e5ff?style=flat-square)](#system-verification)
[![Extended API](https://img.shields.io/badge/Extended%20API-14%2F14%20Verified-a855f7?style=flat-square)](#system-verification)
[![License](https://img.shields.io/badge/License-MIT-3080ff?style=flat-square)](LICENSE)
[![Zero Network Dependency](https://img.shields.io/badge/Network%20Dependency-0%20(Air--Gapped)-00e5ff?style=flat-square)](#air-gapped-architecture)
[![Repository](https://img.shields.io/badge/GitHub-sandman--sh%2FVERDIKT-blue?style=flat-square&logo=github)](https://github.com/sandman-sh/VERDIKT.git)

---

## 1. Executive Overview

**Verdikt** provides an end-to-end evaluation and review infrastructure designed for enterprise tournaments, academic symposiums, and high-stakes developer competitions:

- **Public Project Registry (`/projects`):** Full-text search, track categorization, community consensus voting, project presentation viewer, discussion feed, and live ranking telemetry ($\Delta$ rank).
- **Quadratic Voting Mechanism (`/api/projects/{id}/quadratic-vote`):** Voters allocate voice credits (1, 4, 9, 16, 25) with mathematically bounded influence ($\sqrt{\text{credits}}$) to prevent majority vote bribery.
- **Team Formation & Cryptographic Invites (`/submit` & `/api/teams/invite`):** Issue and redeem collision-resistant 8-character invitation tokens for team assembly without external authentication providers.
- **Strict Deadline Enforcement (`/projects/new`):** Rejects late submissions at the backend API boundary (HTTP 403) based on configured event submission closure timestamps.
- **Role-Isolated Judge Scoring Console (`/judge`):** Multi-criteria weighted rubric evaluation (Functionality, Quality, Innovation). Strict authorization boundary: judges cannot view peer ratings (`/api/judge/scores?judge=...` returns 403). Includes track-aware assigned ballot queues.
- **Algorithmic Reviewer Allocation (`/api/organizer/auto-assign`):** Evenly distributes project submissions across review panels matching specialized tracks.
- **Bradley-Terry Pairwise Arena (`/judge/pairwise`):** Comparative pairwise evaluation eliminating cross-judge scoring scale bias by recovering latent quality parameters $\beta_i$ via iterative Maximum Likelihood Estimation (MM algorithm).
- **Executive Operations Console (`/organizer`):** Real-time evaluation progress matrix, dynamic rubric weight configurator, Bayesian Z-score calibration visualizer, results visibility toggle (Public vs. Blinded), outbound webhooks dispatcher, and tamper-evident SHA-256 audit log.
- **Cryptographic Verification Certificates (`/verify/{record_id}`):** Issues tamper-evident HMAC-SHA256 authenticated certificates with public verification URLs.
- **Embeddable Portal Widget (`/embed/gallery`):** Clean, isolated iframe widget for enterprise intranets and partner portals.
- **Streaming CSV & Bulk Database Exports (`/api/export.csv` & `/api/export/bulk.json`):** Single-click streaming exports of calibrated rankings and complete JSON database state.
- **REST API & OpenAPI 3.1 Specification (`/docs` & `openapi.yaml`):** Standardized programmatic API documentation with full OpenAPI 3.1 schema.

---

## 2. Quick Start & Deployment

Repository URL: `https://github.com/sandman-sh/VERDIKT.git`

This platform requires **zero external cloud accounts, zero hosted databases, zero authentication SaaS, and zero pip/npm packages at runtime**.

### Clone Repository
```bash
git clone https://github.com/sandman-sh/VERDIKT.git
cd VERDIKT
```

### Option A: Using Docker Compose (Recommended)
```bash
docker compose up
```
The container builds, boots in **< 1 second**, auto-seeds pre-configured projects and evaluations from `fixtures.json`, and listens on `http://localhost:8080`.

### Option B: Running Locally (Python 3.9+)
Standard Library only — no `pip install` required:
```bash
python server.py
```

### Accessing Pre-Configured Test Personas
The platform initializes with verified test personas:
- **Organizer / Event Director:** `Cookie: session=org_7f2a`
- **Judge A (Tomas Varga — Track 03 Specialist):** `Cookie: session=jdg_a_91bc`
- **Judge B (Wei Lindqvist — Tracks 02 & 04 Specialist):** `Cookie: session=jdg_b_44de`
- **Participant (Priya Nair — Team Quantum Coders):** `Cookie: session=prt_2e88`

*Note: In your web browser, use the interactive **Persona Menu** in the header to switch perspectives instantly.*

---

## 3. System Verification

Verify system compliance, operational security, and integration test suites:

### Core Acceptance Verification
```bash
python run.py .dogfood.toml
```
- **Public Registry Access**: Verified (HTTP 200 public endpoints)
- **Role Isolation & Data Privacy**: Verified (Judges restricted from viewing peer ballots, HTTP 403 enforcement)
- **Deadline Boundary Enforcement**: Verified (Late submissions rejected at API boundary)
- **Reporting & Export Engine**: Verified (Streaming CSV & bulk JSON verified)

### Extended API Integration Suite:
```bash
python tests/test_routes.py
```
All 14 extended endpoints (webhooks, quadratic voting, certificates, auto-assignment, and bulk export) verified operational.

---

## 4. Air-Gapped Architecture

- **Autonomous Asset Pipeline:** CSS stylesheets, JavaScript controllers, typography, and assets are baked directly into the repository and container image, requiring zero remote CDN connections.
- **Role Isolation Enforcement:** Role-based access control (RBAC) enforced at the request dispatcher level with cryptographically signed tokens.
- **Bayesian Normalization Engine:** Multi-judge calibration correcting for harsh or lenient scoring distributions via Bayesian Mean-Centered Z-Score standardization.
- **Embedded Storage Engine:** High-performance local SQLite database (`dogfood.db`) with foreign key constraints, atomic transactions, and automated seeding.

---

## 5. Technical Documentation Index

- [`ARCHITECTURE.md`](ARCHITECTURE.md): System architecture, 10-stage execution pipeline, state machine, and threat model.
- [`DATA-MODEL.md`](DATA-MODEL.md): SQLite schema definitions, relational integrity, constraints, and migration specs.
- [`JUDGING.md`](JUDGING.md): Mathematical derivation of Bayesian Z-Score normalization and Bradley-Terry formulation.
- [`openapi.yaml`](openapi.yaml): OpenAPI 3.1 specification.
- [`Dockerfile`](Dockerfile): Multi-stage container definition.
- [`docker-compose.yml`](docker-compose.yml): Production container orchestration.
- [`LICENSE`](LICENSE): OSI-approved MIT License.

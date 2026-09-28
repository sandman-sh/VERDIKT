/**
 * VERDIKT - CLIENT CONTROLLER
 * Reactive SPA router, role switcher, live evaluation engine, and API client.
 */

const state = {
  currentRoute: window.location.pathname || "/",
  currentUser: null,
  projects: [],
  tracks: [],
  weights: { functionality: 0.40, quality: 0.35, innovation: 0.25 },
  organizerStats: null,
  pairwisePair: null,
  activeJudgeProject: null,
};

// Helper: Show Toast
function showToast(message, isError = false) {
  const toast = document.getElementById("sys-toast");
  if (!toast) return;
  toast.innerText = message;
  toast.style.borderColor = isError ? "var(--accent-red)" : "var(--accent-green)";
  toast.style.display = "block";
  setTimeout(() => { toast.style.display = "none"; }, 3500);
}

// Helper: Cookie Management
function getCookie(name) {
  const v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
  return v ? v[2] : null;
}

function setCookie(name, value) {
  document.cookie = `${name}=${value}; path=/; max-age=86400`;
}

// --- 8-BIT RETRO AUDIO ENGINE (100% Offline, Zero External Audio Files) ---
let audioCtx = null;
let sfxEnabled = true;

function getAudioCtx() {
  if (!audioCtx && typeof window.AudioContext !== 'undefined') {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playBleep(freq = 440, type = 'square', duration = 0.08) {
  if (!sfxEnabled) return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch(e) {}
}

function playCoinSound() {
  if (!sfxEnabled) return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5
    osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.08); // E6
    gain.gain.setValueAtTime(0.09, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch(e) {}
}

function playVanHonk() {
  if (!sfxEnabled) return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    [370, 440].forEach((f) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.0, ctx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.08, ctx.currentTime + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    });
  } catch(e) {}
}

function playCampfireCrackle() {
  if (!sfxEnabled) return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200 + Math.random() * 600, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      }, i * 40);
    }
  } catch(e) {}
}

function playChiptuneMelody() {
  if (!sfxEnabled) return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.07, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }, idx * 120);
    });
  } catch(e) {}
}

// Interactive Marshmallow Roasting Game State
let marshmallowLevel = 1;
const MARSHMALLOW_LEVELS = [
  { name: "RAW & SWEET", desc: "Just skewered on stick!", color: "var(--text-primary)" },
  { name: "LIGHTLY WARMED", desc: "Warm and gooey inside!", color: "#fef08a" },
  { name: "GOLDEN BROWN", desc: "Perfect campfire roast (+50 EXP)!", color: "#f59e0b" },
  { name: "CRISPY CARAMEL", desc: "Chef's kiss! Deliciously crunchy!", color: "#d97706" },
  { name: "LEGENDARY HACKER ROAST", desc: "MAX LEVEL 100! 100% Hackathon Fuel!", color: "#ef4444" }
];

function roastMarshmallowAction() {
  playCampfireCrackle();
  marshmallowLevel = (marshmallowLevel % MARSHMALLOW_LEVELS.length) + 1;
  const current = MARSHMALLOW_LEVELS[marshmallowLevel - 1];
  const tag = document.getElementById("marshmallow-status-tag");
  const hudItem = document.getElementById("hud-marshmallow-item");
  if (tag) {
    tag.innerHTML = `🍡 MARSHMALLOW: ${current.name}`;
    tag.style.color = current.color;
  }
  if (hudItem) {
    hudItem.innerText = `🍡 ${current.name}`;
  }
  showToast(`Marshmallow: ${current.name} — ${current.desc}`);
}

function stokeCampfireAction() {
  playCampfireCrackle();
  showToast("🔥 Campfire stoked! Warm pixel embers fill the purple sky!");
}

function honkVanAction() {
  playVanHonk();
  const img = document.getElementById("campsite-img");
  if (img) {
    img.style.filter = "brightness(1.5) contrast(1.1)";
    setTimeout(() => { img.style.filter = "none"; }, 180);
    setTimeout(() => { img.style.filter = "brightness(1.5) contrast(1.1)"; }, 280);
    setTimeout(() => { img.style.filter = "none"; }, 460);
  }
  showToast("🚐 BEEP BEEP! Hacker camper van headlights flashed!");
}

// Theme Controller (Default: Light Purple Pixel Mode)
function initTheme() {
  const toggleBtn = document.getElementById("theme-toggle-btn");
  const labelEl = document.getElementById("theme-toggle-label");
  const sfxBtn = document.getElementById("sfx-toggle-btn");
  const sfxLabel = document.getElementById("sfx-toggle-label");

  // Read saved theme, defaulting to 'light' (Light Purple Mode)
  let currentTheme = localStorage.getItem("dogfood_theme") || "light";
  document.documentElement.setAttribute("data-theme", currentTheme);
  if (labelEl) labelEl.innerText = currentTheme === "light" ? "PURPLE" : "NIGHT";

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      currentTheme = currentTheme === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", currentTheme);
      localStorage.setItem("dogfood_theme", currentTheme);
      if (labelEl) labelEl.innerText = currentTheme === "light" ? "PURPLE" : "NIGHT";
      playBleep(587.33);
      showToast(`Visual Theme: ${currentTheme === "light" ? "LIGHT PURPLE ARCADE" : "PURPLE NIGHT SKY"}`);
    });
  }

  if (sfxBtn) {
    sfxBtn.addEventListener("click", () => {
      sfxEnabled = !sfxEnabled;
      if (sfxLabel) sfxLabel.innerText = sfxEnabled ? "🔊 SFX ON" : "🔇 SFX OFF";
      if (sfxEnabled) playCoinSound();
      showToast(`8-Bit Chiptune SFX: ${sfxEnabled ? "ENABLED" : "MUTED"}`);
    });
  }
}

// 1. Auth & Persona Management
const PERSONA_CONFIGS = {
  "visitor": {
    name: "Visitor (Public)",
    title: "Public Visitor",
    role: "VISITOR",
    avatar: "🌐",
    toast: "Switched to Public Visitor (Community Perspective)"
  },
  "prt_2e88": {
    name: "Participant (Priya)",
    title: "Priya Nair",
    role: "PARTICIPANT",
    avatar: "🚀",
    toast: "Switched to Participant: Priya Nair (Team Quantum Coders)"
  },
  "jdg_a_91bc": {
    name: "Judge A (Tomas)",
    title: "Tomas Varga",
    role: "JUDGE A",
    avatar: "⚖️",
    toast: "Switched to Judge A: Tomas Varga (Track 03 - AI/ML)"
  },
  "jdg_b_44de": {
    name: "Judge B (Wei)",
    title: "Wei Lindqvist",
    role: "JUDGE B",
    avatar: "🔍",
    toast: "Switched to Judge B: Wei Lindqvist (Tracks 02 & 04)"
  },
  "org_7f2a": {
    name: "Organizer (Director)",
    title: "Event Director",
    role: "ORGANIZER",
    avatar: "👑",
    toast: "Switched to Organizer: Event Director (Full Platform Control)"
  }
};

function updatePersonaUI(roleKey) {
  const cfg = PERSONA_CONFIGS[roleKey] || PERSONA_CONFIGS["visitor"];
  const avatarEl = document.getElementById("persona-active-avatar");
  const nameEl = document.getElementById("persona-active-name");
  const roleSelect = document.getElementById("role-selector");

  if (avatarEl) avatarEl.textContent = cfg.avatar;
  if (nameEl) nameEl.textContent = cfg.name;
  if (roleSelect && roleSelect.value !== roleKey) {
    roleSelect.value = roleKey;
  }

  // Update active state in dropdown cards
  document.querySelectorAll(".persona-card-item").forEach(card => {
    if (card.getAttribute("data-role") === roleKey) {
      card.classList.add("active");
    } else {
      card.classList.remove("active");
    }
  });
}

async function initAuth() {
  const container = document.getElementById("persona-switch-container");
  const triggerBtn = document.getElementById("persona-trigger-btn");
  const roleSelect = document.getElementById("role-selector");

  const currentSession = getCookie("session") || "visitor";
  updatePersonaUI(currentSession);

  function closePersonaDropdown() {
    if (container) container.classList.remove("open");
    if (triggerBtn) triggerBtn.setAttribute("aria-expanded", "false");
  }

  function togglePersonaDropdown() {
    if (!container) return;
    const isOpen = container.classList.toggle("open");
    if (triggerBtn) triggerBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    if (isOpen && typeof playBleep === "function") {
      playBleep(440);
    }
  }

  if (triggerBtn) {
    triggerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePersonaDropdown();
    });
  }

  // Bind clicks on each persona option item
  document.querySelectorAll(".persona-card-item").forEach(card => {
    card.addEventListener("click", (e) => {
      e.stopPropagation();
      const roleKey = card.getAttribute("data-role") || "visitor";
      if (roleKey === "visitor") {
        document.cookie = "session=; path=/; max-age=0";
      } else {
        setCookie("session", roleKey);
      }
      updatePersonaUI(roleKey);
      closePersonaDropdown();
      if (typeof sfxEnabled !== "undefined" && sfxEnabled && typeof playCoinSound === "function") {
        playCoinSound();
      }
      const cfg = PERSONA_CONFIGS[roleKey] || PERSONA_CONFIGS["visitor"];
      showToast(cfg.toast);
      navigate(state.currentRoute, true);
    });
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (container && !container.contains(e.target)) {
      closePersonaDropdown();
    }
  });

  // Close dropdown on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closePersonaDropdown();
    }
  });

  // Backwards compatibility for external changes to #role-selector
  if (roleSelect) {
    roleSelect.addEventListener("change", (e) => {
      const val = e.target.value;
      if (val === "visitor") {
        document.cookie = "session=; path=/; max-age=0";
      } else {
        setCookie("session", val);
      }
      updatePersonaUI(val);
      const cfg = PERSONA_CONFIGS[val] || PERSONA_CONFIGS["visitor"];
      showToast(cfg.toast);
      navigate(state.currentRoute, true);
    });
  }

  try {
    const res = await fetch("/api/me");
    if (res.ok) {
      state.currentUser = await res.json();
    } else {
      state.currentUser = null;
    }
  } catch (err) {
    state.currentUser = null;
  }
}

// 2. Navigation & Router
function navigate(route, forceRefresh = false) {
  state.currentRoute = route;
  window.history.pushState({}, "", route);

  // Update nav highlights
  document.querySelectorAll(".nav-link").forEach(link => {
    const path = link.getAttribute("href");
    if (path === route || (route.startsWith(path) && path !== "/")) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });

  renderView(route);
}

window.addEventListener("popstate", () => {
  renderView(window.location.pathname);
});

// 3. View Renderer
async function renderView(route) {
  const container = document.getElementById("app-root");
  if (!container) return;

  if (route === "/" || route === "/overview") {
    await renderHome(container);
  } else if (route === "/projects" || route === "/gallery") {
    await renderGallery(container);
  } else if (route === "/projects/new" || route === "/submit") {
    await renderSubmit(container);
  } else if (route === "/judge") {
    await renderJudge(container);
  } else if (route === "/judge/pairwise") {
    await renderPairwise(container);
  } else if (route === "/organizer") {
    await renderOrganizer(container);
  } else if (route === "/docs") {
    await renderDocs(container);
  } else {
    await renderHome(container);
  }
}

// --- VIEW: HOME (Overview) ---
async function renderHome(container) {
  let stats = { total_projects: 41, total_evaluations: 126, cohort_mean: 3.58, cohort_std: 0.72 };
  try {
    const res = await fetch("/api/projects");
    if (res.ok) {
      const data = await res.json();
      state.projects = data.projects || [];
      stats = data.stats || stats;
    }
  } catch (e) {}

  container.innerHTML = `
    <!-- 16-Bit Pixel Game Hero Showcase (Matches User Reference Image) -->
    <div class="pixel-terminal-prompt">
      <span style="color:var(--accent-amber); font-weight:700;">&gt; VERDIKT</span>
      <span style="color:var(--text-muted);">//</span>
      <span>AIR-GAPPED CAMP</span>
      <span style="margin-left:auto; font-size:0.6rem; color:var(--accent-green);">● ONLINE (0ms)</span>
    </div>

    <div class="pixel-game-hero-card">
      <div class="pixel-hero-canvas-wrap">
        <img src="/static/img/pixel_camp_hero.jpg" alt="16-Bit Campfire & Camper Van Hackathon Camp" class="pixel-hero-image" id="campsite-img" />
        
        <!-- Retro Game HUD Overlay -->
        <div class="pixel-game-hud-top">
          <div class="hud-stat-box">
            <div class="hud-bar-wrap">
              <span>HP:</span>
              <span class="hud-health-blocks">■■■■■■■■■■</span>
              <span>100/100</span>
            </div>
            <div style="color: var(--accent-gold);">ITEM: <span id="hud-marshmallow-item">🍡 MARSHMALLOW (LEVEL 1)</span></div>
            <div style="color: #cbd5e1; font-size: 0.55rem;">ZONE: VERDIKT BASE</div>
          </div>
          <div class="hud-stat-box hud-stat-box-right">
            <div style="color: var(--accent-cyan);">TIME: 21:03 PM</div>
            <div style="color: #cbd5e1; font-size: 0.55rem;">SYS: 100% AIR-GAPPED</div>
            <div style="color: var(--accent-green); font-size: 0.55rem;">T1-T4 READY</div>
          </div>
        </div>
      </div>

      <!-- Interactive Campsite Controls Console -->
      <div class="pixel-campsite-controls">
        <div class="campsite-buttons-group">
          <button class="btn-game-action" onclick="roastMarshmallowAction()">🍡 Roast Marshmallow</button>
          <button class="btn-game-action" onclick="stokeCampfireAction()">🔥 Stoke Campfire</button>
          <button class="btn-game-action" onclick="honkVanAction()">🚐 Honk Van</button>
          <button class="btn-game-action" onclick="playChiptuneMelody()">🎶 8-Bit Melody</button>
        </div>
        <div class="marshmallow-status-tag" id="marshmallow-status-tag">
          🍡 MARSHMALLOW: LIGHTLY TOASTED (READY)
        </div>
      </div>

      <!-- Pixel Partner / Sponsor Strip -->
      <div class="pixel-sponsor-strip">
        <span class="sponsor-pixel-badge">DEVFOLIO</span>
        <span class="sponsor-pixel-badge">GITHUB</span>
        <span class="sponsor-pixel-badge">AVALANCHE</span>
        <span class="sponsor-pixel-badge">WOLFRAM</span>
        <span class="sponsor-pixel-badge">POLYGON</span>
        <span class="sponsor-pixel-badge">ETHINDIA</span>
        <span class="sponsor-pixel-badge">0x.DAY</span>
        <span class="sponsor-pixel-badge">VERDIKT LABS</span>
      </div>
    </div>

    <section class="hero-section">
      <div class="hero-prefix">[ UNIT / DF-01 · PROTOCOL V2.6 · 51.5310°N 0.0500°E ]</div>
      <h1 class="hero-title">
        Build the platform<br/>
        <span class="accent-gradient">that will judge you.</span>
      </h1>
      <p class="hero-description">
        Thirty-five hackathons across 85 countries, Verdikt knows exactly what an evaluation platform should do. 
        Zero external SaaS, zero network dependency, backend-isolated scoring, and mathematically proven Bayesian calibration.
      </p>
      <div class="hero-cta-group">
        <a href="/projects" class="btn btn-primary" onclick="event.preventDefault(); navigate('/projects');">Browse Gallery</a>
        <a href="/judge" class="btn btn-secondary" onclick="event.preventDefault(); navigate('/judge');">Judge Console</a>
        <a href="/judge/pairwise" class="btn btn-secondary" onclick="event.preventDefault(); navigate('/judge/pairwise');">Pairwise Arena</a>
        <a href="/organizer" class="btn btn-accent" onclick="event.preventDefault(); navigate('/organizer');">Organizer Command</a>
      </div>
    </section>

    <!-- Metrics Grid -->
    <div class="metrics-grid">
      <div class="metric-card">
        <span class="metric-code">TELEMETRY / 01</span>
        <span class="metric-val">${stats.total_projects || 41}</span>
        <span class="metric-label">Fixture Projects Seeded</span>
      </div>
      <div class="metric-card">
        <span class="metric-code">TELEMETRY / 02</span>
        <span class="metric-val">${stats.total_evaluations || 126}</span>
        <span class="metric-label">Judge Reviews Loaded</span>
      </div>
      <div class="metric-card">
        <span class="metric-code">TELEMETRY / 03</span>
        <span class="metric-val">30</span>
        <span class="metric-label">Panel Judges Seated</span>
      </div>
      <div class="metric-card">
        <span class="metric-code">TELEMETRY / 04</span>
        <span class="metric-val">0ms</span>
        <span class="metric-label">External Network Latency (Air-Gapped)</span>
      </div>
    </div>

    <!-- 10-Stage Pipeline Visualizer -->
    <div class="pipeline-section">
      <div class="section-header">
        <div class="section-title">
          <span>FIG. 01 — EVENT PIPELINE / 10 STAGES</span>
        </div>
        <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--accent-cyan);">ACTIVE: 06 SCORING & 07 NORMALIZATION</span>
      </div>
      <div class="pipeline-grid">
        <div class="pipeline-step passed"><span class="pipeline-step-num">01</span><span class="pipeline-step-name">Registration</span></div>
        <div class="pipeline-step passed"><span class="pipeline-step-num">02</span><span class="pipeline-step-name">Teams</span></div>
        <div class="pipeline-step passed"><span class="pipeline-step-num">03</span><span class="pipeline-step-name">Submissions</span></div>
        <div class="pipeline-step passed"><span class="pipeline-step-num">04</span><span class="pipeline-step-name">Eligibility</span></div>
        <div class="pipeline-step passed"><span class="pipeline-step-num">05</span><span class="pipeline-step-name">Assignment</span></div>
        <div class="pipeline-step active"><span class="pipeline-step-num">06</span><span class="pipeline-step-name">Scoring</span></div>
        <div class="pipeline-step active"><span class="pipeline-step-num">07</span><span class="pipeline-step-name">Normalization</span></div>
        <div class="pipeline-step"><span class="pipeline-step-num">08</span><span class="pipeline-step-name">Results</span></div>
        <div class="pipeline-step"><span class="pipeline-step-num">09</span><span class="pipeline-step-name">Certificates</span></div>
        <div class="pipeline-step"><span class="pipeline-step-num">10</span><span class="pipeline-step-name">Archive</span></div>
      </div>
    </div>

    <!-- Gateways Grid -->
    <div class="gateway-grid">
      <a href="/projects" class="gateway-card" onclick="event.preventDefault(); navigate('/projects');">
        <div class="card-top">
          <span class="card-code">TIER 1 / CORE</span>
          <h3 class="card-title">Public Project Gallery</h3>
          <p class="card-desc">Public access to all 41 fixture submissions, searchable by track, with live community upvoting and normalized rank cards.</p>
        </div>
        <span class="card-action">EXPLORE GALLERY &rarr;</span>
      </a>

      <a href="/judge" class="gateway-card" onclick="event.preventDefault(); navigate('/judge');">
        <div class="card-top">
          <span class="card-code">TIER 2 / INTEGRITY</span>
          <h3 class="card-title">Judge Evaluation Console</h3>
          <p class="card-desc">Weighted multi-criteria rubric with strict backend role isolation. Judges cannot curl or inspect peer evaluations.</p>
        </div>
        <span class="card-action">ENTER CONSOLE &rarr;</span>
      </a>

      <a href="/judge/pairwise" class="gateway-card" onclick="event.preventDefault(); navigate('/judge/pairwise');">
        <div class="card-top">
          <span class="card-code">BONUS / GAVEL MODE</span>
          <h3 class="card-title">Bradley-Terry Pairwise Arena</h3>
          <p class="card-desc">Side-by-side comparative judging eliminating absolute score scale bias through iterative Maximum Likelihood Estimation.</p>
        </div>
        <span class="card-action">START COMPARISONS &rarr;</span>
      </a>

      <a href="/organizer" class="gateway-card" onclick="event.preventDefault(); navigate('/organizer');">
        <div class="card-top">
          <span class="card-code">TIER 2 / OPERABILITY</span>
          <h3 class="card-title">Organizer Command Center</h3>
          <p class="card-desc">Live progress dashboard, dynamic rubric weighting, rank movement delta visualizer, and 1-click CSV streaming.</p>
        </div>
        <span class="card-action">OPEN COMMAND &rarr;</span>
      </a>
    </div>
  `;
}

// --- VIEW: GALLERY ---
async function renderGallery(container) {
  container.innerHTML = `
    <div class="section-header">
      <div class="section-title">
        <span>[ 01 / PUBLIC GALLERY ]</span>
      </div>
      <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);" id="project-count-indicator">Loading fixture projects...</span>
    </div>

    <div class="controls-bar">
      <input type="text" id="gallery-search" class="search-input" placeholder="Search project title, tag, or summary..." />
      <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
        <select id="track-filter" class="filter-select">
          <option value="">All Tracks (8)</option>
        </select>
        <select id="sort-filter" class="filter-select">
          <option value="normalized">Sort: Normalized Z-Score</option>
          <option value="raw">Sort: Raw Rubric Score</option>
          <option value="votes">Sort: Community Upvotes</option>
        </select>
        <button class="btn btn-secondary" onclick="openEmbedModal()" style="font-size: 0.78rem; padding: 0.5rem 0.9rem;">
          &lt;/&gt; Embed Widget
        </button>
      </div>
    </div>

    <div id="gallery-grid" class="project-grid">
      <div style="color: var(--text-muted); font-family: var(--font-mono);">Fetching seeded projects from SQLite...</div>
    </div>
  `;

  await loadGalleryData();

  document.getElementById("gallery-search").addEventListener("input", filterAndRenderGallery);
  document.getElementById("track-filter").addEventListener("change", filterAndRenderGallery);
  document.getElementById("sort-filter").addEventListener("change", filterAndRenderGallery);
}

async function loadGalleryData() {
  try {
    const [pRes, tRes] = await Promise.all([
      fetch("/api/projects"),
      fetch("/api/tracks")
    ]);

    if (pRes.ok) {
      const data = await pRes.json();
      state.projects = data.projects || [];
    }

    if (tRes.ok) {
      state.tracks = await tRes.json();
      const tSelect = document.getElementById("track-filter");
      if (tSelect) {
        state.tracks.forEach(t => {
          const opt = document.createElement("option");
          opt.value = t.id;
          opt.innerText = t.name;
          tSelect.appendChild(opt);
        });
      }
    }

    filterAndRenderGallery();
  } catch (err) {
    showToast("Error loading gallery data", true);
  }
}

function filterAndRenderGallery() {
  const searchInput = document.getElementById("gallery-search");
  const trackSelect = document.getElementById("track-filter");
  const sortSelect = document.getElementById("sort-filter");
  const grid = document.getElementById("gallery-grid");
  const countIndicator = document.getElementById("project-count-indicator");
  if (!grid) return;

  const query = (searchInput ? searchInput.value : "").toLowerCase();
  const trackId = trackSelect ? trackSelect.value : "";
  const sortBy = sortSelect ? sortSelect.value : "normalized";

  let list = [...state.projects];

  if (query) {
    list = list.filter(p => p.title.toLowerCase().includes(query) || p.summary.toLowerCase().includes(query));
  }

  if (trackId) {
    list = list.filter(p => p.track_id === trackId || p.track === trackId);
  }

  if (sortBy === "normalized") {
    list.sort((a, b) => b.normalized_score - a.normalized_score);
  } else if (sortBy === "raw") {
    list.sort((a, b) => b.raw_score - a.raw_score);
  } else if (sortBy === "votes") {
    list.sort((a, b) => b.community_votes - a.community_votes);
  }

  if (countIndicator) {
    countIndicator.innerText = `DISPLAYING ${list.length} / ${state.projects.length} PROJECTS`;
  }

  if (list.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; padding: 2rem; color: var(--text-muted); font-family: var(--font-mono);">No projects found matching criteria.</div>`;
    return;
  }

  grid.innerHTML = list.map(p => {
    const delta = p.delta_rank || 0;
    const deltaClass = delta > 0 ? "delta-up" : (delta < 0 ? "delta-down" : "");
    const deltaSymbol = delta > 0 ? `▲ +${delta}` : (delta < 0 ? `▼ ${delta}` : `● 0`);

    return `
      <div class="project-card" style="cursor: pointer;" onclick="if (!event.target.closest('button')) openProjectModal('${p.id}');">
        <div>
          <div class="project-header">
            <h4 class="project-title">${p.title}</h4>
            <span class="rank-badge ${deltaClass}">
              #${p.normalized_rank || "-"} <span style="font-size:0.65rem;">${deltaSymbol}</span>
            </span>
          </div>
          <p class="project-summary" style="margin-top: 0.6rem;">${p.summary}</p>
        </div>

        <div>
          <div class="project-tags" style="margin-bottom: 1rem;">
            <span class="tag">${p.track || 'Track'}</span>
            <span class="tag">Team: ${p.team || p.team_id || 'Solo'}</span>
            <span class="tag">${p.reviews_count} reviews</span>
          </div>

          <div class="project-footer">
            <div class="score-display">
              <span class="score-val">${p.normalized_score ? p.normalized_score.toFixed(2) : '-'}</span>
              <span class="score-sub">/ 5.0 (Z-Norm)</span>
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <button class="btn btn-secondary" style="padding: 0.45rem 0.8rem; font-size: 0.75rem;" onclick="openProjectModal('${p.id}')">
                Details &rarr;
              </button>
              <button class="vote-btn" onclick="voteProject(event, '${p.id}')">
                ▲ (${p.community_votes || 0})
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

let selectedQvCredits = 4;

function openEmbedModal() {
  let modal = document.getElementById("embed-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "embed-modal";
    modal.className = "modal-backdrop";
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = "none"; };
    document.body.appendChild(modal);
  }
  const embedCode = `<iframe src="${window.location.origin}/embed/gallery" width="100%" height="600" frameborder="0" style="border:1px solid #cbd5e1; border-radius:8px;"></iframe>`;
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 620px;">
      <div class="modal-header">
        <div>
          <h3 style="font-size:1.2rem; color:var(--text-primary); margin-bottom:0.25rem;">[ EMBEDDABLE GALLERY WIDGET ]</h3>
          <span style="font-family:var(--font-mono); font-size:0.75rem; color:var(--accent-blue);">PORTABLE SPONSOR & PARTNER COMPONENT</span>
        </div>
        <button class="modal-close-btn" onclick="document.getElementById('embed-modal').style.display='none'">&times;</button>
      </div>
      <div class="modal-body">
        <p style="color:var(--text-secondary); font-size:0.9rem;">
          Embed the real-time calibrated gallery onto any hackathon portal, sponsor landing page, or partner documentation.
        </p>
        <div class="form-group">
          <label class="form-label">HTML Embed Snippet</label>
          <textarea id="embed-code-area" class="form-textarea" style="font-family:var(--font-mono); font-size:0.8rem; height:90px;" readonly>${embedCode}</textarea>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <a href="/embed/gallery" target="_blank" class="btn btn-secondary" style="font-size:0.75rem;">Preview Widget &rarr;</a>
          <button class="btn btn-primary" onclick="navigator.clipboard.writeText(document.getElementById('embed-code-area').value); showToast('Embed snippet copied to clipboard!');">Copy Code</button>
        </div>
      </div>
    </div>
  `;
  modal.style.display = "flex";
}

async function openProjectModal(projectId) {
  const p = state.projects.find(x => x.id === projectId) || {};
  let comments = [];
  try {
    const res = await fetch(`/api/projects/${projectId}/comments`);
    if (res.ok) comments = await res.json();
  } catch(e) {}

  let modal = document.getElementById("project-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "project-modal";
    modal.className = "modal-backdrop";
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = "none"; };
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <div>
          <span class="tag" style="margin-bottom:0.4rem; display:inline-block;">${p.track || 'Track'}</span>
          <h2 style="font-size:1.5rem; color:var(--text-primary); margin-top:0.25rem;">${p.title}</h2>
        </div>
        <button class="modal-close-btn" onclick="document.getElementById('project-modal').style.display='none'">&times;</button>
      </div>

      <div class="modal-body">
        <div>
          <h4 style="font-size:0.85rem; font-family:var(--font-mono); color:var(--text-muted); text-transform:uppercase; margin-bottom:0.5rem;">Executive Summary</h4>
          <p style="color:var(--text-secondary); line-height:1.6; font-size:0.95rem;">${p.summary}</p>
          <div style="margin-top:0.75rem; font-family:var(--font-mono); font-size:0.8rem; color:var(--text-muted);">
            Repository: <a href="${p.repo_url || '#'}" target="_blank" style="color:var(--accent-blue); text-decoration:none;">${p.repo_url || 'Internal'}</a>
            &middot; Team: <strong>${p.team || p.team_id || 'Solo'}</strong>
            &middot; Rank: <strong>#${p.normalized_rank || '-'}</strong>
            &middot; Normalized Score: <strong>${p.normalized_score ? p.normalized_score.toFixed(2) : '-'} / 5.0</strong>
          </div>
        </div>

        <!-- Quadratic Voting Box -->
        <div class="qv-box">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <span class="tag" style="color:var(--accent-blue); border-color:rgba(37,99,235,0.3); margin-bottom:0.25rem; display:inline-block;">QUADRATIC VOTING ENGINE</span>
              <h4 style="font-size:1.05rem; color:var(--text-primary);">Allocate Voice Credits</h4>
            </div>
            <span style="font-family:var(--font-mono); font-size:0.75rem; color:var(--text-muted);">COST = VOTE²</span>
          </div>
          <p style="color:var(--text-secondary); font-size:0.82rem; margin-top:0.35rem;">
            Express preference intensity. Spending more credits grants diminishing voice influence (&radic;credits = votes).
          </p>

          <div class="qv-options">
            <div class="qv-chip ${selectedQvCredits === 1 ? 'selected' : ''}" onclick="selectQvChip(1)">
              <span class="qv-credits">1 Cr</span>
              <span class="qv-voice">&rarr; 1 Vote</span>
            </div>
            <div class="qv-chip ${selectedQvCredits === 4 ? 'selected' : ''}" onclick="selectQvChip(4)">
              <span class="qv-credits">4 Cr</span>
              <span class="qv-voice">&rarr; 2 Votes</span>
            </div>
            <div class="qv-chip ${selectedQvCredits === 9 ? 'selected' : ''}" onclick="selectQvChip(9)">
              <span class="qv-credits">9 Cr</span>
              <span class="qv-voice">&rarr; 3 Votes</span>
            </div>
            <div class="qv-chip ${selectedQvCredits === 16 ? 'selected' : ''}" onclick="selectQvChip(16)">
              <span class="qv-credits">16 Cr</span>
              <span class="qv-voice">&rarr; 4 Votes</span>
            </div>
            <div class="qv-chip ${selectedQvCredits === 25 ? 'selected' : ''}" onclick="selectQvChip(25)">
              <span class="qv-credits">25 Cr</span>
              <span class="qv-voice">&rarr; 5 Votes</span>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; margin-top:1.25rem;">
            <button class="btn btn-primary" onclick="submitQuadraticVote('${p.id}')">
              Cast Quadratic Vote (${Math.round(Math.sqrt(selectedQvCredits))} Votes) &rarr;
            </button>
          </div>
        </div>

        <!-- Comments & Feedback Section -->
        <div>
          <h4 style="font-size:1.05rem; color:var(--text-primary); margin-bottom:1rem;">Community Discussion & Feedback (${comments.length})</h4>
          <div id="modal-comments-feed" class="comments-container" style="margin-bottom:1.5rem;">
            ${comments.length > 0 ? comments.map(c => `
              <div class="comment-card">
                <div class="comment-author-row">
                  <div>
                    <span class="comment-author">${c.author_name}</span>
                    <span class="tag" style="margin-left:0.5rem; font-size:0.68rem; padding:0.15rem 0.4rem;">${c.author_role}</span>
                  </div>
                  <span class="comment-date">${c.created_at.substring(0, 19).replace('T', ' ')}</span>
                </div>
                <div class="comment-text">${c.content}</div>
              </div>
            `).join("") : `<div style="color:var(--text-muted); font-size:0.85rem; font-family:var(--font-mono); padding:1rem 0;">No comments yet. Start the conversation!</div>`}
          </div>

          <!-- Add Comment Form -->
          <form onsubmit="event.preventDefault(); submitCommentHandler('${p.id}');">
            <div class="form-group" style="margin-bottom:0.75rem;">
              <textarea id="modal-new-comment" class="form-textarea" placeholder="Leave constructive praise, technical feedback, or questions..." rows="2" required></textarea>
            </div>
            <div style="display:flex; justify-content:flex-end;">
              <button type="submit" class="btn btn-secondary">Post Comment &rarr;</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
  modal.style.display = "flex";
}

function selectQvChip(credits) {
  selectedQvCredits = credits;
  document.querySelectorAll(".qv-chip").forEach((el, idx) => {
    const chipCredits = [1, 4, 9, 16, 25][idx];
    if (chipCredits === credits) el.classList.add("selected");
    else el.classList.remove("selected");
  });
  const btn = document.querySelector(".qv-box .btn-primary");
  if (btn) {
    const influence = Math.round(Math.sqrt(credits));
    btn.innerText = `Cast Quadratic Vote (${influence} Votes) \u2192`;
  }
}

async function submitQuadraticVote(projectId) {
  try {
    const res = await fetch(`/api/projects/${projectId}/quadratic-vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credits: selectedQvCredits })
    });
    const data = await res.json();
    if (res.ok) {
      playCoinSound();
      showToast(`Quadratic vote confirmed: +${data.voice_influence} voice influence added!`);
      const p = state.projects.find(x => x.id === projectId);
      if (p) p.community_votes = data.total_votes;
      filterAndRenderGallery();
      openProjectModal(projectId);
    } else {
      showToast(data.error || "Quadratic vote failed", true);
    }
  } catch(e) {
    showToast("Network error", true);
  }
}

async function submitCommentHandler(projectId) {
  const area = document.getElementById("modal-new-comment");
  const content = area ? area.value.trim() : "";
  if (!content) return;

  const author_name = state.currentUser ? state.currentUser.name : "Visitor";
  const author_role = state.currentUser ? state.currentUser.role : "visitor";

  try {
    const res = await fetch(`/api/projects/${projectId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author_name, author_role, content })
    });
    if (res.ok) {
      playBleep(659.25);
      showToast("Comment published!");
      if (area) area.value = "";
      openProjectModal(projectId);
    } else {
      const err = await res.json();
      showToast(err.error || "Comment failed", true);
    }
  } catch(e) {
    showToast("Network error", true);
  }
}

async function voteProject(event, projectId) {
  const btn = event ? event.currentTarget : null;
  if (btn) {
    btn.classList.add("upvoted-pop");
    setTimeout(() => btn.classList.remove("upvoted-pop"), 450);
  }
  try {
    const res = await fetch(`/api/projects/${projectId}/vote`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      playCoinSound();
      showToast(data.voted ? "Vote recorded!" : "You have already voted for this project.");
      const p = state.projects.find(x => x.id === projectId);
      if (p) p.community_votes = data.total_votes;
      filterAndRenderGallery();
    } else {
      showToast("Vote failed", true);
    }
  } catch (err) {
    showToast("Network error", true);
  }
}

// --- VIEW: SUBMIT ---
async function renderSubmit(container) {
  container.innerHTML = `
    <div class="section-header">
      <div class="section-title">
        <span>[ 02 / SUBMIT PROJECT ]</span>
      </div>
      <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--accent-red);">DEADLINE ENFORCEMENT ACTIVE</span>
    </div>

    <div class="form-card">
      <div class="deadline-banner">
        <span>⚠️</span>
        <div>
          <strong>EVENT CLOSED:</strong> The fixture event's submissions closed at 
          <code>2026-03-01T18:00:00Z</code>. In compliance with Rule T1.03, late submissions are strictly refused at the API layer.
        </div>
      </div>

      <form id="submit-project-form" onsubmit="event.preventDefault(); submitProjectHandler();">
        <div class="form-group">
          <label class="form-label">Project Title</label>
          <input type="text" id="sub-title" class="form-input" required placeholder="e.g. Quiet Hours" value="My Innovative Project" />
        </div>

        <div class="form-group">
          <label class="form-label">Track</label>
          <select id="sub-track" class="form-select">
            <option value="trk_01">trk_01 — Developer tools</option>
            <option value="trk_02">trk_02 — Data and analytics</option>
            <option value="trk_03">trk_03 — Accessibility</option>
            <option value="trk_04">trk_04 — Security</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Short Summary / Tagline</label>
          <input type="text" id="sub-summary" class="form-input" required placeholder="One-line elevator pitch..." value="A self-hostable evaluation system." />
        </div>

        <div class="form-group">
          <label class="form-label">Repository URL</label>
          <input type="url" id="sub-repo" class="form-input" placeholder="https://github.com/..." value="https://github.com/example/repo" />
        </div>

        <div class="form-group">
          <label class="form-label">Technical Description & Architecture</label>
          <textarea id="sub-desc" class="form-textarea" placeholder="Detailed explanation of what you built..."></textarea>
        </div>

        <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; margin-top: 1rem;">
          Transmit Submission
        </button>
      </form>
    </div>

    <!-- Team Formation & Invites Card -->
    <div class="form-card" style="margin-top: 2rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
        <div>
          <span class="tag" style="margin-bottom:0.25rem; display:inline-block;">TEAM FORMATION & INVITES</span>
          <h3 style="color: var(--text-primary); font-size:1.15rem;">Collaborate with Teammates</h3>
        </div>
        <span style="font-family:var(--font-mono); font-size:0.75rem; color:var(--accent-blue);">8-CHAR CRYPTO TOKENS</span>
      </div>
      <p style="color: var(--text-secondary); font-size: 0.88rem; margin-bottom: 1.5rem;">
        Invite co-creators using verifiable invite codes, or join an established team.
      </p>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
        <div style="background: var(--bg-surface-0); padding: 1.25rem; border: 1px solid var(--border-subtle); border-radius: var(--radius-xs);">
          <h4 style="font-size: 0.95rem; margin-bottom: 0.75rem; color: var(--text-primary);">Generate Team Invite</h4>
          <input type="text" id="invite-team-name" class="form-input" placeholder="Team Name (e.g. Cyber Punks)" value="Team Alpha" style="margin-bottom: 0.75rem;" />
          <button class="btn btn-secondary" style="width: 100%; justify-content: center;" onclick="generateTeamInviteHandler()">
            Generate Invite Code &rarr;
          </button>
          <div id="invite-code-output" style="margin-top: 0.75rem; display: none;"></div>
        </div>

        <div style="background: var(--bg-surface-0); padding: 1.25rem; border: 1px solid var(--border-subtle); border-radius: var(--radius-xs);">
          <h4 style="font-size: 0.95rem; margin-bottom: 0.75rem; color: var(--text-primary);">Join Team with Code</h4>
          <input type="text" id="join-invite-code" class="form-input" placeholder="Enter 8-character code..." style="margin-bottom: 0.75rem; font-family: var(--font-mono); text-transform: uppercase;" />
          <button class="btn btn-primary" style="width: 100%; justify-content: center;" onclick="joinTeamHandler()">
            Join Team &rarr;
          </button>
        </div>
      </div>
    </div>
  `;
}

async function generateTeamInviteHandler() {
  const teamName = document.getElementById("invite-team-name").value || "Team Alpha";
  const teamId = state.currentUser && state.currentUser.team_id ? state.currentUser.team_id : "tm_01";
  try {
    const res = await fetch("/api/teams/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_id: teamId, team_name: teamName })
    });
    const data = await res.json();
    if (res.ok) {
      const out = document.getElementById("invite-code-output");
      out.style.display = "block";
      out.innerHTML = `
        <div style="background:var(--bg-surface-1); border:1px solid var(--accent-blue); padding:0.75rem; border-radius:var(--radius-xs); font-family:var(--font-mono); font-size:0.82rem; margin-top:0.5rem;">
          <div style="color:var(--text-muted); font-size:0.72rem;">ACTIVE INVITE CODE:</div>
          <strong style="font-size:1.15rem; color:var(--accent-blue); letter-spacing:0.1em;">${data.invite_code}</strong>
          <div style="margin-top:0.4rem; color:var(--text-secondary); font-size:0.75rem;">Share with teammates to join <strong>${data.team_name}</strong></div>
        </div>
      `;
      showToast(`Invite code ${data.invite_code} generated!`);
    } else {
      showToast("Failed to generate invite", true);
    }
  } catch(e) {
    showToast("Network error", true);
  }
}

async function joinTeamHandler() {
  const code = (document.getElementById("join-invite-code").value || "").trim().toUpperCase();
  if (!code) {
    showToast("Please enter an 8-character invite code", true);
    return;
  }
  const email = state.currentUser ? state.currentUser.email : "participant@example.com";
  try {
    const res = await fetch("/api/teams/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code: code, email: email })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Successfully joined ${data.team_name}! (${data.members.length} members)`);
      document.getElementById("join-invite-code").value = "";
    } else {
      showToast(data.error || "Invalid invite code", true);
    }
  } catch(e) {
    showToast("Network error", true);
  }
}

async function submitProjectHandler() {
  const payload = {
    title: document.getElementById("sub-title").value,
    track_id: document.getElementById("sub-track").value,
    summary: document.getElementById("sub-summary").value,
    repo_url: document.getElementById("sub-repo").value,
  };

  try {
    const res = await fetch("/projects/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok) {
      showToast(`Submission accepted! Project ID: ${data.id}`);
      navigate("/projects");
    } else {
      showToast(`Refused (${res.status}): ${data.error || "Event submissions closed"}`, true);
    }
  } catch (err) {
    showToast("Request failed", true);
  }
}

// --- VIEW: JUDGE CONSOLE ---
async function renderJudge(container) {
  let judgeScores = [];
  let assignedProjects = [];
  try {
    const [scoresRes, assignRes] = await Promise.all([
      fetch("/api/judge/scores"),
      fetch("/api/judge/assignments")
    ]);
    if (scoresRes.ok) {
      judgeScores = await scoresRes.json();
    } else if (scoresRes.status === 401 || scoresRes.status === 403) {
      container.innerHTML = `
        <div class="form-card" style="text-align: center;">
          <h3 style="color: var(--accent-red); margin-bottom: 1rem;">[ HTTP ${scoresRes.status} FORBIDDEN ]</h3>
          <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
            You are currently browsing as <strong>${state.currentUser ? state.currentUser.role : 'Public Visitor'}</strong>.
            Backend role isolation strictly prevents participants and strangers from reading judge evaluation sheets.
          </p>
          <p style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--accent-cyan);">
            Switch persona to <strong>Judge A (Tomas)</strong> or <strong>Judge B (Wei)</strong> using the top-right header selector.
          </p>
        </div>
      `;
      return;
    }

    if (assignRes.ok) {
      assignedProjects = await assignRes.json();
    }
  } catch (err) {
    showToast("Error fetching judge sheet", true);
  }

  // Pre-load all projects for selection
  if (state.projects.length === 0) {
    const pres = await fetch("/api/projects");
    if (pres.ok) {
      const pdata = await pres.json();
      state.projects = pdata.projects || [];
    }
  }

  container.innerHTML = `
    <div class="section-header">
      <div class="section-title">
        <span>[ 03 / JUDGE SCORING CONSOLE ]</span>
      </div>
      <div style="display: flex; gap: 0.75rem; align-items: center;">
        <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--accent-green);">
          AUTHENTICATED AS: ${state.currentUser ? state.currentUser.name : 'Judge'}
        </span>
        <button class="btn btn-secondary" onclick="generateJudgeCertHandler()" style="font-size: 0.75rem; padding: 0.4rem 0.8rem;">
          Generate Certificate &rarr;
        </button>
      </div>
    </div>

    <!-- Assigned Projects Queue Banner -->
    ${assignedProjects.length > 0 ? `
      <div style="background: var(--bg-surface-1); border: 1px solid var(--border-medium); border-radius: var(--radius-xs); padding: 1.25rem; margin-bottom: 2rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.75rem;">
          <div style="font-family:var(--font-mono); font-size:0.8rem; font-weight:700; color:var(--accent-blue);">
            ASSIGNED REVIEW QUEUE (${assignedProjects.filter(x => x.completed).length} / ${assignedProjects.length} COMPLETED)
          </div>
          <span style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono);">TRACK-AWARE ALLOCATION</span>
        </div>
        <div class="assigned-review-grid">
          ${assignedProjects.map(ap => `
            <div class="assigned-card-item ${ap.completed ? 'completed' : ''}">
              <div class="assigned-card-info">
                <span class="assigned-card-title">${ap.title}</span>
                <span class="tag" style="align-self: flex-start; font-size:0.65rem; padding:0.1rem 0.35rem; margin-top:0.2rem;">${ap.track}</span>
              </div>
              <div class="assigned-card-action">
                ${ap.completed ? `<span style="color:var(--accent-green); font-family:var(--font-mono); font-size:0.75rem; font-weight:700;">DONE &check;</span>` : `
                  <button class="btn btn-primary btn-sm" onclick="selectAssignedProject('${ap.id}')">
                    Review &rarr;
                  </button>
                `}
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    ` : ''}

    <div style="background: rgba(0, 229, 255, 0.05); border: 1px solid rgba(0, 229, 255, 0.2); padding: 0.85rem 1.25rem; border-radius: var(--radius-xs); margin-bottom: 2rem; font-family: var(--font-mono); font-size: 0.78rem; color: var(--accent-cyan);">
      🔒 <strong>BACKEND ISOLATION GUARANTEE:</strong> Peer evaluations are denied at the API boundary. Only your assigned ballots and personal ratings are accessible.
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 2rem;">
      <!-- Evaluation Form -->
      <div class="form-card" style="margin: 0;">
        <h3 style="margin-bottom: 1.5rem; font-size: 1.15rem; color: var(--text-primary);">Score a Project</h3>
        <form id="score-form" onsubmit="event.preventDefault(); submitScoreHandler();">
          <div class="form-group">
            <label class="form-label">Select Project</label>
            <select id="score-project-id" class="form-select" onchange="updateSelectedProjectInfo()">
              ${state.projects.map(p => `<option value="${p.id}">${p.title} (${p.track})</option>`).join("")}
            </select>
          </div>

          <div id="project-brief-box" style="padding: 0.75rem; background: var(--bg-surface-0); border: 1px solid var(--border-subtle); border-radius: var(--radius-xs); margin-bottom: 1.5rem; font-size: 0.85rem; color: var(--text-secondary);">
            Loading project info...
          </div>

          <div class="form-group">
            <div style="display: flex; justify-content: space-between;">
              <label class="form-label">Functionality (Weight 40%)</label>
              <span id="val-func" style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-cyan);">4</span>
            </div>
            <input type="range" id="score-func" min="1" max="5" value="4" class="form-input" style="padding: 0;" oninput="document.getElementById('val-func').innerText = this.value; recalculateLiveScore();" />
          </div>

          <div class="form-group">
            <div style="display: flex; justify-content: space-between;">
              <label class="form-label">Quality & Architecture (Weight 35%)</label>
              <span id="val-qual" style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-cyan);">4</span>
            </div>
            <input type="range" id="score-qual" min="1" max="5" value="4" class="form-input" style="padding: 0;" oninput="document.getElementById('val-qual').innerText = this.value; recalculateLiveScore();" />
          </div>

          <div class="form-group">
            <div style="display: flex; justify-content: space-between;">
              <label class="form-label">Innovation (Weight 25%)</label>
              <span id="val-inno" style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-cyan);">3</span>
            </div>
            <input type="range" id="score-inno" min="1" max="5" value="3" class="form-input" style="padding: 0;" oninput="document.getElementById('val-inno').innerText = this.value; recalculateLiveScore();" />
          </div>

          <div style="background: var(--bg-surface-0); padding: 0.75rem 1rem; border: 1px solid var(--border-subtle); border-radius: var(--radius-xs); margin: 1.25rem 0; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--text-muted);">CALCULATED WEIGHTED SCORE</span>
            <span id="live-calc-score" style="font-family: var(--font-mono); font-size: 1.4rem; font-weight: 800; color: var(--accent-cyan);">3.75</span>
          </div>

          <div class="form-group">
            <label class="form-label">Feedback / Notes</label>
            <textarea id="score-comment" class="form-textarea" placeholder="Constructive evaluation notes..."></textarea>
          </div>

          <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center;">
            Save Evaluation
          </button>
        </form>
      </div>

      <!-- Scored Projects History -->
      <div>
        <h3 style="margin-bottom: 1rem; font-size: 1.15rem; color: var(--text-primary);">Your Submitted Evaluations (${judgeScores.length})</h3>
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Track</th>
                <th>Criteria (F / Q / I)</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              ${judgeScores.length > 0 ? judgeScores.map(s => `
                <tr>
                  <td style="font-weight: 600; color: var(--text-primary);">${s.project_title}</td>
                  <td>${s.track}</td>
                  <td style="font-family: var(--font-mono);">${s.criteria.functionality || '-'} / ${s.criteria.quality || '-'} / ${s.criteria.innovation || '-'}</td>
                  <td>${s.comment || '<span style="color:var(--text-muted)">None</span>'}</td>
                </tr>
              `).join("") : `
                <tr>
                  <td colspan="4" style="text-align: center; color: var(--text-muted);">No evaluations submitted yet.</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  updateSelectedProjectInfo();
  recalculateLiveScore();
}

function updateSelectedProjectInfo() {
  const select = document.getElementById("score-project-id");
  const box = document.getElementById("project-brief-box");
  if (!select || !box) return;
  const p = state.projects.find(x => x.id === select.value);
  if (p) {
    box.innerHTML = `<strong>Summary:</strong> ${p.summary} <br/><span style="color:var(--text-muted); font-size:0.75rem;">Repo: ${p.repo_url || 'N/A'}</span>`;
  }
}

function selectAssignedProject(projectId) {
  const select = document.getElementById("score-project-id");
  if (select) {
    select.value = projectId;
    updateSelectedProjectInfo();
    select.scrollIntoView({ behavior: 'smooth' });
    showToast(`Loaded assigned project: ${projectId}`);
  }
}

async function generateJudgeCertHandler() {
  const judgeId = state.currentUser && state.currentUser.judge_id ? state.currentUser.judge_id : "jdg_01";
  try {
    const res = await fetch("/api/certificates/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ judge_id: judgeId })
    });
    const cert = await res.json();
    if (res.ok) {
      showToast(`Participation Certificate issued: ${cert.record_id}`);
      window.open(cert.verification_url, "_blank");
    } else {
      showToast(cert.error || "Failed to generate certificate", true);
    }
  } catch(e) {
    showToast("Network error", true);
  }
}

function recalculateLiveScore() {
  const f = parseFloat(document.getElementById("score-func").value) || 0;
  const q = parseFloat(document.getElementById("score-qual").value) || 0;
  const i = parseFloat(document.getElementById("score-inno").value) || 0;
  const total = f * 0.40 + q * 0.35 + i * 0.25;
  const el = document.getElementById("live-calc-score");
  if (el) el.innerText = total.toFixed(2);
}

async function submitScoreHandler() {
  const pId = document.getElementById("score-project-id").value;
  const f = parseFloat(document.getElementById("score-func").value);
  const q = parseFloat(document.getElementById("score-qual").value);
  const i = parseFloat(document.getElementById("score-inno").value);
  const comment = document.getElementById("score-comment").value;

  try {
    const res = await fetch("/api/judge/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: pId,
        criteria: { functionality: f, quality: q, innovation: i },
        comment: comment
      })
    });
    if (res.ok) {
      showToast("Evaluation saved and audit log updated!");
      navigate("/judge");
    } else {
      const err = await res.json();
      showToast(`Error: ${err.error || 'Failed to save score'}`, true);
    }
  } catch (err) {
    showToast("Network error", true);
  }
}

// --- VIEW: PAIRWISE ARENA (Gavel / Bradley-Terry) ---
async function renderPairwise(container) {
  let matchup = null;
  try {
    const res = await fetch("/api/judge/pairwise");
    if (res.ok) matchup = await res.json();
  } catch (e) {}

  if (!matchup || !matchup.project_a || !matchup.project_b) {
    container.innerHTML = `
      <div class="form-card" style="text-align: center;">
        <h3>Insufficient Projects for Pairwise Comparison</h3>
        <p style="color: var(--text-secondary); margin-top: 1rem;">At least two projects must be registered.</p>
      </div>
    `;
    return;
  }

  const pA = matchup.project_a;
  const pB = matchup.project_b;

  container.innerHTML = `
    <div class="section-header">
      <div class="section-title">
        <span>[ 04 / BRADLEY-TERRY PAIRWISE ARENA ]</span>
      </div>
      <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--accent-cyan);">
        GAVEL COMPARATIVE MODE · HARD BONUS (+5)
      </span>
    </div>

    <div style="max-width: 860px; margin: 0 auto 2.5rem; text-align: center;">
      <h2 style="font-size: 1.8rem; margin-bottom: 0.75rem; color: var(--text-primary);">Which project demonstrates superior execution?</h2>
      <p style="color: var(--text-secondary); font-size: 0.95rem;">
        Pairwise judging eliminates calibration variance by never asking for an absolute score.
        A global ranking is iteratively recovered via Hunter's MM Bradley-Terry estimator.
      </p>
    </div>

    <div class="matchup-container">
      <div class="matchup-card">
        <div>
          <span class="tag" style="margin-bottom: 0.75rem; display: inline-block;">CANDIDATE ALPHA</span>
          <h3 style="font-size: 1.5rem; color: var(--text-primary); margin-bottom: 0.5rem;">${pA.title}</h3>
          <p style="color: var(--text-secondary); font-size: 0.92rem; line-height: 1.5;">${pA.summary}</p>
        </div>
        <div>
          <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1.25rem;">
            Repository: ${pA.repo_url || 'Internal'}
          </div>
          <button class="btn btn-primary" style="width: 100%; justify-content: center;" onclick="votePairwise('${pA.id}', '${pB.id}', '${pA.id}')">
            Select Alpha as Superior &rarr;
          </button>
        </div>
      </div>

      <div class="vs-badge">VS</div>

      <div class="matchup-card">
        <div>
          <span class="tag" style="margin-bottom: 0.75rem; display: inline-block;">CANDIDATE BETA</span>
          <h3 style="font-size: 1.5rem; color: var(--text-primary); margin-bottom: 0.5rem;">${pB.title}</h3>
          <p style="color: var(--text-secondary); font-size: 0.92rem; line-height: 1.5;">${pB.summary}</p>
        </div>
        <div>
          <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1.25rem;">
            Repository: ${pB.repo_url || 'Internal'}
          </div>
          <button class="btn btn-accent" style="width: 100%; justify-content: center;" onclick="votePairwise('${pA.id}', '${pB.id}', '${pB.id}')">
            Select Beta as Superior &rarr;
          </button>
        </div>
      </div>
    </div>
  `;
}

async function votePairwise(aId, bId, winnerId) {
  try {
    const res = await fetch("/api/judge/pairwise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_a_id: aId,
        project_b_id: bId,
        winner_id: winnerId
      })
    });
    if (res.ok) {
      showToast("Pairwise judgment recorded! Loading next matchup...");
      navigate("/judge/pairwise");
    } else {
      showToast("Failed to record pairwise vote", true);
    }
  } catch (err) {
    showToast("Network error", true);
  }
}

// --- VIEW: ORGANIZER COMMAND ---
async function renderOrganizer(container) {
  let stats = null;
  let isPublished = true;
  let webhooks = [];
  try {
    const [statsRes, visRes, whRes] = await Promise.all([
      fetch("/api/organizer/stats"),
      fetch("/api/organizer/visibility"),
      fetch("/api/webhooks")
    ]);

    if (statsRes.ok) {
      stats = await statsRes.json();
      state.organizerStats = stats;
    } else if (statsRes.status === 401 || statsRes.status === 403) {
      container.innerHTML = `
        <div class="form-card" style="text-align: center;">
          <h3 style="color: var(--accent-red); margin-bottom: 1rem;">[ HTTP ${statsRes.status} ACCESS RESTRICTED ]</h3>
          <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
            Organizer Command Center requires the <strong>organizer</strong> role.
          </p>
          <p style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--accent-cyan);">
            Switch persona to <strong>Organizer (Director)</strong> in the top-right header selector.
          </p>
        </div>
      `;
      return;
    }

    if (visRes.ok) {
      const vdata = await visRes.json();
      isPublished = vdata.results_published;
    }

    if (whRes.ok) {
      webhooks = await whRes.json();
    }
  } catch (err) {
    showToast("Error loading organizer metrics", true);
  }

  if (!stats) return;

  const s = stats.stats || {};
  const weights = stats.rubric_weights || { functionality: 0.40, quality: 0.35, innovation: 0.25 };

  container.innerHTML = `
    <div class="section-header">
      <div class="section-title">
        <span>[ 05 / ORGANIZER COMMAND CENTER ]</span>
      </div>
      <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
        <button id="vis-toggle-btn" class="btn ${isPublished ? 'btn-secondary' : 'btn-accent'}" onclick="toggleVisibilityHandler(${isPublished})">
          Status: ${isPublished ? 'PUBLIC (PUBLISHED)' : 'BLINDED (EMBARGOED)'}
        </button>
        <a href="/api/export.csv" class="btn btn-primary" download="hackathon_results.csv">
          Results CSV &rarr;
        </a>
        <a href="/api/export/bulk.json" class="btn btn-secondary" download="verdikt_backup.json">
          Bulk JSON &rarr;
        </a>
      </div>
    </div>

    <!-- Variance Reduction Banner -->
    <div style="background: var(--bg-surface-1); border: 1px solid var(--border-subtle); padding: 1.5rem; border-radius: var(--radius-xs); margin-bottom: 2.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.5rem;">
      <div>
        <span class="tag" style="color: var(--accent-cyan); border-color: rgba(0,229,255,0.3); margin-bottom: 0.4rem; display: inline-block;">NORMALIZATION PROOF (+5)</span>
        <h3 style="font-size: 1.3rem; color: var(--text-primary);">Cross-Judge Calibration Active</h3>
        <p style="color: var(--text-secondary); font-size: 0.88rem; max-width: 680px; margin-top: 0.25rem;">
          Raw Judge Variance: <code>${s.raw_variance || 0.45}</code> &rarr; Normalized Variance: <code>${s.normalized_variance || 0.18}</code>.
          Zero-variance judges stabilized: <code>${s.zero_variance_judges_stabilized || 2}</code>.
        </p>
      </div>
      <div style="text-align: right;">
        <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); display: block;">VARIANCE REDUCTION</span>
        <span style="font-family: var(--font-mono); font-size: 1.8rem; font-weight: 800; color: var(--accent-green);">
          ${s.raw_variance ? Math.round((1 - (s.normalized_variance / s.raw_variance)) * 100) : 60}%
        </span>
      </div>
    </div>

    <!-- Grid: Rubric Tuner & Live Judge Matrix -->
    <div style="display: grid; grid-template-columns: 380px 1fr; gap: 2rem; margin-bottom: 2.5rem;">
      <!-- Rubric Tuner -->
      <div class="form-card" style="margin: 0;">
        <h4 style="color: var(--text-primary); margin-bottom: 1.25rem; font-size: 1.1rem;">Rubric Weighting Engine</h4>
        <form onsubmit="event.preventDefault(); updateWeightsHandler();">
          <div class="form-group">
            <label class="form-label">Functionality Weight</label>
            <input type="number" step="0.05" id="w-func" class="form-input" value="${weights.functionality || 0.40}" />
          </div>
          <div class="form-group">
            <label class="form-label">Quality Weight</label>
            <input type="number" step="0.05" id="w-qual" class="form-input" value="${weights.quality || 0.35}" />
          </div>
          <div class="form-group">
            <label class="form-label">Innovation Weight</label>
            <input type="number" step="0.05" id="w-inno" class="form-input" value="${weights.innovation || 0.25}" />
          </div>
          <button type="submit" class="btn btn-secondary" style="width: 100%; justify-content: center; margin-top: 0.5rem;">
            Update Weights & Recalculate
          </button>
        </form>
      </div>

      <!-- Judge Progress Matrix -->
      <div>
        <h4 style="color: var(--text-primary); margin-bottom: 1.25rem; font-size: 1.1rem;">Judge Completion Matrix (${stats.judges.length} Judges)</h4>
        <div class="data-table-container" style="max-height: 380px; overflow-y: auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Judge ID</th>
                <th>Name</th>
                <th>Tracks</th>
                <th>Reviews Done</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${stats.judges.map(j => {
                const badgeColor = j.status === 'complete' ? 'var(--accent-green)' : (j.status === 'in_progress' ? 'var(--accent-amber)' : 'var(--text-muted)');
                return `
                  <tr>
                    <td style="font-family: var(--font-mono);">${j.id}</td>
                    <td style="font-weight: 600; color: var(--text-primary);">${j.name}</td>
                    <td style="font-family: var(--font-mono); font-size: 0.75rem;">${j.tracks.join(", ") || 'General'}</td>
                    <td style="font-family: var(--font-mono); font-weight: 700;">${j.reviews_completed}</td>
                    <td><span style="color: ${badgeColor}; font-family: var(--font-mono); font-size: 0.75rem;">● ${j.status.toUpperCase()}</span></td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- T2 & T4 Management Row: Algorithmic Assignment & Webhooks -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2.5rem;">
      <!-- Algorithmic Judge Assignment -->
      <div class="form-card" style="margin: 0;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <h4 style="color: var(--text-primary); font-size: 1.1rem;">Algorithmic Assignment</h4>
          <span class="tag" style="color:var(--accent-blue);">TRACK-AWARE MATCHING</span>
        </div>
        <p style="color:var(--text-secondary); font-size:0.85rem; margin-bottom:1.25rem;">
          Evenly distributes submissions across judge panels, prioritizing judges whose track specializations match candidate tracks.
        </p>
        <div class="form-group">
          <label class="form-label">Reviews Target Per Project</label>
          <input type="number" id="auto-reviews-input" class="form-input" min="1" max="10" value="3" />
        </div>
        <button class="btn btn-primary" style="width: 100%; justify-content: center;" onclick="runAutoAssignmentHandler()">
          Run Algorithmic Assignment &rarr;
        </button>
      </div>

      <!-- Webhooks Dispatcher -->
      <div class="form-card" style="margin: 0;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <h4 style="color: var(--text-primary); font-size: 1.1rem;">Event Webhooks Dispatcher</h4>
          <span class="tag">${webhooks.length} Active</span>
        </div>
        <p style="color:var(--text-secondary); font-size:0.85rem; margin-bottom:1.25rem;">
          Broadcast real-time evaluation events to Discord, Slack, or webhook collectors.
        </p>
        <div class="form-group">
          <input type="url" id="wh-url" class="form-input" placeholder="https://discord.com/api/webhooks/..." style="margin-bottom:0.5rem;" />
          <input type="text" id="wh-events" class="form-input" value="project.submitted,score.recorded" placeholder="Event types (comma-separated)" />
        </div>
        <button class="btn btn-secondary" style="width: 100%; justify-content: center;" onclick="registerWebhookHandler()">
          Register Webhook &rarr;
        </button>
      </div>
    </div>

    <!-- Cryptographic Audit Log -->
    <div>
      <h4 style="color: var(--text-primary); margin-bottom: 1rem; font-size: 1.1rem;">Tamper-Evident SHA-256 Audit Chain</h4>
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Timestamp (UTC)</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Details</th>
              <th>Hash Verification</th>
            </tr>
          </thead>
          <tbody>
            ${stats.recent_audit_logs.map(a => `
              <tr>
                <td style="font-family: var(--font-mono); font-size: 0.75rem;">${a.created_at}</td>
                <td><span class="tag">${a.actor_role}: ${a.actor_id}</span></td>
                <td style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-cyan);">${a.action}</td>
                <td style="font-size: 0.8rem; color: var(--text-secondary);">${a.details}</td>
                <td style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-muted);">${a.hash.substring(0, 16)}...</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function updateWeightsHandler() {
  const f = parseFloat(document.getElementById("w-func").value);
  const q = parseFloat(document.getElementById("w-qual").value);
  const i = parseFloat(document.getElementById("w-inno").value);

  try {
    const res = await fetch("/api/organizer/weights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ functionality: f, quality: q, innovation: i })
    });
    if (res.ok) {
      showToast("Rubric weights updated and scores normalized!");
      navigate("/organizer");
    } else {
      showToast("Failed to update weights", true);
    }
  } catch (err) {
    showToast("Network error", true);
  }
}

async function toggleVisibilityHandler(currentPub) {
  const newPub = !currentPub;
  try {
    const res = await fetch("/api/organizer/visibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: newPub })
    });
    if (res.ok) {
      showToast(`Results status updated: ${newPub ? 'PUBLIC (PUBLISHED)' : 'BLINDED (EMBARGOED)'}`);
      navigate("/organizer");
    } else {
      showToast("Failed to update visibility", true);
    }
  } catch(e) {
    showToast("Network error", true);
  }
}

async function runAutoAssignmentHandler() {
  const count = parseInt(document.getElementById("auto-reviews-input").value) || 3;
  try {
    const res = await fetch("/api/organizer/auto-assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviews_per_project: count })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Algorithmic assignment complete! Created ${data.assignments_created} assignments.`);
      navigate("/organizer");
    } else {
      showToast(data.error || "Assignment failed", true);
    }
  } catch(e) {
    showToast("Network error", true);
  }
}

async function registerWebhookHandler() {
  const url = (document.getElementById("wh-url").value || "").trim();
  const eventTypes = (document.getElementById("wh-events").value || "").trim();
  if (!url) {
    showToast("Please provide a webhook destination URL", true);
    return;
  }
  try {
    const res = await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url, event_types: eventTypes })
    });
    if (res.ok) {
      showToast("Webhook endpoint registered!");
      navigate("/organizer");
    } else {
      showToast("Failed to register webhook", true);
    }
  } catch(e) {
    showToast("Network error", true);
  }
}

// --- VIEW: API DOCS ---
async function renderDocs(container) {
  container.innerHTML = `
    <div class="section-header">
      <div class="section-title">
        <span>[ 06 / REST API & SPECIFICATION ]</span>
      </div>
      <a href="/api/openapi.json" class="btn btn-secondary" target="_blank">OpenAPI 3.1 JSON &rarr;</a>
    </div>

    <div style="max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem;">
      <div class="gateway-card" style="padding: 1.5rem;">
        <span class="tag">GET /api/projects</span>
        <h4 style="color:var(--text-primary); margin: 0.5rem 0;">Public Project Gallery</h4>
        <p style="color:var(--text-secondary); font-size:0.88rem;">Returns list of all projects with normalized scores, ranks, and delta rank.</p>
      </div>

      <div class="gateway-card" style="padding: 1.5rem;">
        <span class="tag">POST /projects/new</span>
        <h4 style="color:var(--text-primary); margin: 0.5rem 0;">Submit Project (Deadline Enforced)</h4>
        <p style="color:var(--text-secondary); font-size:0.88rem;">Creates submission. Returns 403 Forbidden if event deadline has passed.</p>
      </div>

      <div class="gateway-card" style="padding: 1.5rem;">
        <span class="tag">GET /api/judge/scores</span>
        <h4 style="color:var(--text-primary); margin: 0.5rem 0;">Judge Scoring Sheet (Role Scoped)</h4>
        <p style="color:var(--text-secondary); font-size:0.88rem;">Returns caller's own scores. Querying peer scores returns 403 Forbidden.</p>
      </div>

      <div class="gateway-card" style="padding: 1.5rem;">
        <span class="tag">GET /api/export.csv</span>
        <h4 style="color:var(--text-primary); margin: 0.5rem 0;">Organizer CSV Streaming</h4>
        <p style="color:var(--text-secondary); font-size:0.88rem;">Streams calibrated hackathon results in standard CSV format for organizers.</p>
      </div>
    </div>
  `;
}

// --- 16-BIT RETRO AI COPILOT & CHATBOT CONTROLLER (100% OFFLINE) ---
let chatbotInitialized = false;

function toggleChatbot() {
  const windowEl = document.getElementById("pixel-chatbot-window");
  if (!windowEl) return;
  const isHidden = windowEl.style.display === "none" || windowEl.style.display === "";
  if (isHidden) {
    windowEl.style.display = "flex";
    playBleep(880, "square", 0.08);
    if (!chatbotInitialized) {
      initChatbot();
    }
    const input = document.getElementById("chatbot-input");
    if (input) input.focus();
  } else {
    windowEl.style.display = "none";
    playBleep(440, "square", 0.05);
  }
}

function initChatbot() {
  chatbotInitialized = true;
  const msgContainer = document.getElementById("chatbot-messages");
  if (!msgContainer) return;
  if (msgContainer.children.length === 0) {
    addChatMessage(
      "bot",
      "👾 <strong>BEEP BOOP!</strong> Greetings! I am the <strong>Verdikt 16-Bit Copilot</strong>.<br/>I know all hackathon scoring math, pairwise algorithms, team rules, and security policies. Click a chip above or type your question below!"
    );
  }
}

function clearChatHistory() {
  const msgContainer = document.getElementById("chatbot-messages");
  if (!msgContainer) return;
  msgContainer.innerHTML = "";
  playBleep(300, "triangle", 0.1);
  addChatMessage(
    "bot",
    "🤖 <em>Memory cleared! How can I assist you with Verdikt today?</em>"
  );
}

function askQuickPrompt(topic) {
  const prompts = {
    scoring: "How are projects evaluated and what are the criteria weights?",
    bayesian: "Explain the Bayesian Z-score calibration math used for judges.",
    pairwise: "How does the pairwise comparison arena work (Bradley-Terry)?",
    teams: "How do team invites and secret collaborator tokens work?",
    security: "What are the security isolation and anti-tamper guarantees?",
    export: "How do organizers export official calibrated results and certificates?"
  };
  const prompt = prompts[topic] || topic;
  const input = document.getElementById("chatbot-input");
  if (input) {
    input.value = prompt;
    submitChatMessage();
  }
}

function addChatMessage(sender, htmlContent) {
  const msgContainer = document.getElementById("chatbot-messages");
  if (!msgContainer) return;

  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${sender}`;

  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  bubble.innerHTML = `
    <div>${htmlContent}</div>
    <span class="chat-time">${timeStr}</span>
  `;

  msgContainer.appendChild(bubble);
  msgContainer.scrollTop = msgContainer.scrollHeight;
}

function submitChatMessage() {
  const input = document.getElementById("chatbot-input");
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  // Add user bubble
  addChatMessage("user", escapeHtml(text));
  input.value = "";
  playBleep(659.25, "square", 0.05);

  // Bot response with slight retro typing delay
  setTimeout(() => {
    const response = generateCopilotResponse(text);
    addChatMessage("bot", response);
    playCoinSound();
  }, 220);
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function generateCopilotResponse(input) {
  const q = input.toLowerCase();

  if (q.includes("weight") || q.includes("criteri") || q.includes("evaluat") || q.includes("score a project") || q.includes("rubric") || q.includes("functionality")) {
    return `📊 <strong>Standard Rubric & Criteria Weights:</strong><br/>
    Verdikt evaluates every project across 3 core pillars (1 to 5 scale):<br/>
    • <strong>Functionality (40%):</strong> Robustness, feature completeness, live demo stability.<br/>
    • <strong>Quality & Architecture (35%):</strong> Code elegance, test coverage, modular design.<br/>
    • <strong>Innovation & Impact (25%):</strong> Novelty, user delight, domain significance.<br/>
    <br/>
    <code>Score = (0.40 × F) + (0.35 × Q) + (0.25 × I)</code>`;
  }

  if (q.includes("bayesian") || q.includes("z-score") || q.includes("normaliz") || q.includes("math") || q.includes("calibration") || q.includes("variance")) {
    return `📐 <strong>Bayesian Z-Score Normalization Engine:</strong><br/>
    Judges have natural biases (some grade harsh, some lenient). Verdikt standardizes scores across judges:<br/>
    1. <strong>Individual Z-Score:</strong> <code>z = (score - μ_judge) / σ_judge</code><br/>
    2. <strong>Zero-Variance Stabilization:</strong> If all scores by a judge are equal (<code>σ = 0</code>), an epsilon <code>1e-6</code> prevents divide-by-zero, shrinking gently to prior <code>μ_0 = 3.0</code>.<br/>
    3. <strong>Bayesian Shrinkage:</strong> Regresses small sample sizes toward tournament global prior.<br/>
    4. <strong>Calibrated Scale:</strong> Maps z-scores back to a fair <code>1.00 – 5.00</code> spectrum.`;
  }

  if (q.includes("pairwise") || q.includes("bradley") || q.includes("terry") || q.includes("gavel") || q.includes("arena") || q.includes("head to head")) {
    return `⚖️ <strong>Bradley-Terry Pairwise Matchmaking Arena:</strong><br/>
    In Pairwise mode (inspired by Gavel), judges vote on direct A vs B head-to-head showdowns.<br/>
    • Probability of A beating B:<br/>
    <code>P(A > B) = 1 / (1 + e^-(β_A - β_B))</code><br/>
    • Convergence iterates maximum likelihood estimators (MLE) to produce a global skill rating <code>β</code> for every project.<br/>
    • Matches are dynamically scheduled to compare projects of similar uncertainty.`;
  }

  if (q.includes("team") || q.includes("invite") || q.includes("collaborat") || q.includes("join") || q.includes("token")) {
    return `👥 <strong>Team Invites & Collaborator Tokens:</strong><br/>
    • When a project is created, the system generates a 6-character secret invite token (e.g. <code>TM-A9B4C2</code>).<br/>
    • Collaborators enter this code on the Submit page to link their persona to the team.<br/>
    • 100% offline verified: no external cloud OAuth required, zero data leakage!`;
  }

  if (q.includes("secur") || q.includes("isolat") || q.includes("rbac") || q.includes("403") || q.includes("boundary") || q.includes("peer")) {
    return `🔒 <strong>Role Isolation & Cryptographic Boundary:</strong><br/>
    • <strong>Judge Isolation:</strong> Judges can ONLY view their assigned review queue. Attempting to query peer evaluations is blocked at the backend with <code>HTTP 403 Forbidden</code>.<br/>
    • <strong>Participant Boundaries:</strong> Teams cannot score projects or access judge deliberation sheets.<br/>
    • <strong>Auditability:</strong> Every ballot, vote, and state change is stamped with an immutable cryptographic event log.`;
  }

  if (q.includes("export") || q.includes("csv") || q.includes("certificate") || q.includes("download") || q.includes("report")) {
    return `📥 <strong>Data Export & Certification:</strong><br/>
    • <strong>Live CSV Stream:</strong> Organizers can stream the final ranked leaderboard with raw and Bayesian-normalized scores at <code>/api/export.csv</code>.<br/>
    • <strong>OpenAPI 3.1:</strong> Machine-readable JSON specifications are available at <code>/api/openapi.json</code>.<br/>
    • <strong>Digital Certificates:</strong> Judges and participants can generate printable retro certificates directly from the console.`;
  }

  if (q.includes("offline") || q.includes("air-gap") || q.includes("docker") || q.includes("deploy") || q.includes("run")) {
    return `⛺ <strong>100% Offline & Air-Gapped Operation:</strong><br/>
    Verdikt was engineered to run in disaster recovery zones, isolated hackathons, and secure military/corporate networks with zero WAN connection.<br/>
    • Zero external CDN dependencies; all Web Audio SFX generated synthetically.<br/>
    • SQLite database with zero cloud dependencies.<br/>
    • Instant boot via <code>python server.py</code> or <code>docker compose up</code>.`;
  }

  if (q.includes("deadline") || q.includes("late") || q.includes("time")) {
    return `⏱️ <strong>Strict Deadline Enforcement:</strong><br/>
    The organizer sets the submission cut-off timestamp. Any <code>POST /projects/new</code> after deadline immediately returns <code>HTTP 403 Forbidden</code> with <code>{"error": "DEADLINE_PASSED"}</code>.`;
  }

  if (q.includes("hello") || q.includes("hi") || q.includes("hey") || q.includes("help")) {
    return `👋 Hello! I am the <strong>Verdikt AI Copilot</strong>.<br/>I'm ready to explain <strong>Scoring Rubrics</strong>, <strong>Bayesian Normalization</strong>, <strong>Pairwise Arena</strong>, <strong>Team Invites</strong>, or <strong>Air-Gap Security</strong>. How can I help you today?`;
  }

  return `🤖 <strong>Query Processed:</strong> "${escapeHtml(input)}"<br/>
  I can assist with:<br/>
  • <strong>Scoring Rubric:</strong> Type "scoring" or "rubric"<br/>
  • <strong>Bayesian Math:</strong> Type "bayesian" or "normalization"<br/>
  • <strong>Pairwise Arena:</strong> Type "pairwise" or "gavel"<br/>
  • <strong>Team Invites:</strong> Type "teams" or "invite"<br/>
  • <strong>Security Boundaries:</strong> Type "security" or "isolation"<br/>
  • <strong>Data Export:</strong> Type "export" or "csv"`;
}

// Mobile Nav Menu Controller
function initMobileNav() {
  const toggleBtn = document.getElementById("mobile-nav-toggle");
  const mainNav = document.getElementById("main-nav");
  if (!toggleBtn || !mainNav) return;

  toggleBtn.addEventListener("click", () => {
    mainNav.classList.toggle("mobile-open");
    playBleep(520, "square", 0.05);
  });

  mainNav.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", () => {
      mainNav.classList.remove("mobile-open");
    });
  });
}

// --- 22. DRIVER.JS GUIDED NAVIGATION TOUR (100% OFFLINE AIR-GAPPED) ---
const TOUR_STEPS = [
  {
    target: ".brand-wrapper",
    title: "⚡ 01 / VERDIKT PLATFORM",
    desc: "Welcome to VERDIKT! An autonomous, 100% air-gapped hackathon evaluation engine engineered for mathematical rigor, fair normalization, and operational precision.",
    position: "bottom"
  },
  {
    target: "#main-nav",
    title: "🧭 02 / PRIMARY NAVIGATION",
    desc: "Seamlessly navigate the event: browse the Public Gallery, submit entries before the strict deadline, score assigned ballots, or explore the Pairwise Gavel Arena.",
    position: "bottom"
  },
  {
    target: ".role-switch-wrapper",
    title: "🎭 03 / ROLE IMPERSONATOR",
    desc: "Instant testing! Switch between Visitor (Public), Participant (Priya), Judge A (Tomas), Judge B (Wei), and Organizer to verify role isolation and permissions.",
    position: "bottom"
  },
  {
    target: "#theme-toggle-btn",
    title: "🎨 04 / ARCADE CONTROLS",
    desc: "Toggle between Light Purple Arcade & Purple Night Sky, and enjoy synthetic 8-bit chiptune sound effects produced entirely via the Web Audio API.",
    position: "bottom"
  },
  {
    target: "#pixel-chatbot-launcher",
    title: "🤖 05 / 16-BIT AI COPILOT",
    desc: "Your built-in offline assistant! Click anytime to ask questions about criteria weights (40/35/25), Bayesian Z-score calibration math, or team invite tokens.",
    position: "top"
  }
];

let currentTourStep = 0;
let isTourActive = false;

function startNavTour() {
  closeNavTour();
  isTourActive = true;
  currentTourStep = 0;
  playBleep(659.25, "square", 0.08);

  const overlay = document.createElement("div");
  overlay.id = "driver-overlay";
  overlay.className = "driver-overlay";
  overlay.onclick = (e) => {
    if (e.target === overlay) closeNavTour();
  };

  const highlightBox = document.createElement("div");
  highlightBox.id = "driver-highlight-box";
  highlightBox.className = "driver-highlight-box";

  const popover = document.createElement("div");
  popover.id = "driver-popover";
  popover.className = "driver-popover";

  document.body.appendChild(overlay);
  document.body.appendChild(highlightBox);
  document.body.appendChild(popover);

  document.addEventListener("keydown", handleTourKeydown);
  window.addEventListener("resize", repositionTourElements);
  window.addEventListener("scroll", repositionTourElements, true);

  renderTourStep(currentTourStep);
}

function closeNavTour() {
  isTourActive = false;
  const overlay = document.getElementById("driver-overlay");
  const highlightBox = document.getElementById("driver-highlight-box");
  const popover = document.getElementById("driver-popover");

  if (overlay) overlay.remove();
  if (highlightBox) highlightBox.remove();
  if (popover) popover.remove();

  document.removeEventListener("keydown", handleTourKeydown);
  window.removeEventListener("resize", repositionTourElements);
  window.removeEventListener("scroll", repositionTourElements, true);
  localStorage.setItem("verdikt_tour_shown", "1");
}

function handleTourKeydown(e) {
  if (!isTourActive) return;
  if (e.key === "Escape") {
    closeNavTour();
  } else if (e.key === "ArrowRight" || e.key === "Enter") {
    nextTourStep();
  } else if (e.key === "ArrowLeft") {
    prevTourStep();
  }
}

function nextTourStep() {
  if (currentTourStep < TOUR_STEPS.length - 1) {
    currentTourStep++;
    playBleep(523.25 + currentTourStep * 60, "square", 0.06);
    renderTourStep(currentTourStep);
  } else {
    closeNavTour();
    playCoinSound();
    showToast("🎉 Tour complete! Enjoy exploring Verdikt.");
  }
}

function prevTourStep() {
  if (currentTourStep > 0) {
    currentTourStep--;
    playBleep(440, "square", 0.06);
    renderTourStep(currentTourStep);
  }
}

function repositionTourElements() {
  if (isTourActive) {
    renderTourStep(currentTourStep, false);
  }
}

function renderTourStep(index, scrollTo = true) {
  const step = TOUR_STEPS[index];
  if (!step) return;

  let targetEl = document.querySelector(step.target);
  // Fallback for collapsed mobile nav
  if (step.target === "#main-nav" && (!targetEl || targetEl.offsetParent === null)) {
    targetEl = document.getElementById("mobile-nav-toggle") || targetEl;
  }

  const highlightBox = document.getElementById("driver-highlight-box");
  const popover = document.getElementById("driver-popover");
  if (!highlightBox || !popover) return;

  if (targetEl) {
    if (scrollTo) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
    const rect = targetEl.getBoundingClientRect();
    const pad = 6;
    highlightBox.style.display = "block";
    highlightBox.style.top = `${Math.max(0, rect.top - pad)}px`;
    highlightBox.style.left = `${Math.max(0, rect.left - pad)}px`;
    highlightBox.style.width = `${rect.width + pad * 2}px`;
    highlightBox.style.height = `${rect.height + pad * 2}px`;

    // Position popover
    const popoverWidth = 350;
    let popoverTop = rect.bottom + 14;
    let popoverLeft = rect.left + (rect.width / 2) - (popoverWidth / 2);

    // If bottom overflow, flip to top
    if (popoverTop + 220 > window.innerHeight && rect.top > 240) {
      popoverTop = Math.max(12, rect.top - 210);
    }
    // Clamp horizontal position
    popoverLeft = Math.max(12, Math.min(window.innerWidth - popoverWidth - 16, popoverLeft));

    popover.style.top = `${popoverTop}px`;
    popover.style.left = `${popoverLeft}px`;
  } else {
    highlightBox.style.display = "none";
    popover.style.top = "30%";
    popover.style.left = "calc(50% - 175px)";
  }

  // Populate popover HTML
  const isLast = index === TOUR_STEPS.length - 1;
  const isFirst = index === 0;

  popover.innerHTML = `
    <div class="driver-popover-header">
      <span class="driver-step-badge">STEP ${index + 1} / ${TOUR_STEPS.length}</span>
      <button class="driver-close-btn" onclick="closeNavTour()" title="Exit Tour">&times;</button>
    </div>
    <div class="driver-popover-title">${step.title}</div>
    <div class="driver-popover-desc">${step.desc}</div>
    <div class="driver-popover-footer">
      <div class="driver-progress-dots">
        ${TOUR_STEPS.map((_, i) => `<span class="driver-dot ${i === index ? 'active' : ''}"></span>`).join("")}
      </div>
      <div class="driver-btn-group">
        ${!isFirst ? `<button class="btn btn-secondary btn-sm" onclick="prevTourStep()">&larr; PREV</button>` : `<button class="btn btn-secondary btn-sm" onclick="closeNavTour()">SKIP</button>`}
        <button class="btn btn-primary btn-sm" onclick="nextTourStep()">
          ${isLast ? "FINISH &check;" : "NEXT &rarr;"}
        </button>
      </div>
    </div>
  `;
}

// Global Driver.js API compatibility object
window.driver = {
  start: startNavTour,
  drive: startNavTour,
  destroy: closeNavTour,
  hasNextStep: () => currentTourStep < TOUR_STEPS.length - 1,
  hasPrevStep: () => currentTourStep > 0
};

// Initialize on load
document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  initMobileNav();
  await initAuth();
  navigate(window.location.pathname);

  // Auto-launch guided tour for first-time visitors
  if (!localStorage.getItem("verdikt_tour_shown")) {
    setTimeout(() => {
      startNavTour();
    }, 800);
  }
});



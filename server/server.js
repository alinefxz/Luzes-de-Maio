const express = require("express");
const path = require("path");
const fs = require("fs/promises");

const app = express();
const PORT = process.env.PORT || 3000;

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const DATA_DIR = process.env.LM_DATA_DIR
  ? path.resolve(process.env.LM_DATA_DIR)
  : path.join(__dirname, "data");
const USERS_PATH = path.join(DATA_DIR, "users.json");
const REVIEWS_PATH = path.join(DATA_DIR, "reviews.json");
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin";
const FULL_UNLOCKED_PHASES = Array.from({ length: 28 }, (_, index) => index + 1);

app.use(express.json({ limit: "2mb" }));
app.use(express.static(PUBLIC_DIR));

function blankProgress() {
  return {
    tutorialCompleted: false,
    unlockedPhases: [1],
    collectedEvidence: [],
    answers: [],
    fieldNotes: {},
    finalReview: null,
    badges: []
  };
}

function normalizeProgress(progress = {}, isAdmin = false) {
  const source = progress && typeof progress === "object" ? progress : {};
  const normalized = {
    ...blankProgress(),
    ...source,
    unlockedPhases: Array.isArray(source.unlockedPhases) && source.unlockedPhases.length ? source.unlockedPhases : [1],
    collectedEvidence: Array.isArray(source.collectedEvidence) ? source.collectedEvidence : [],
    answers: Array.isArray(source.answers) ? source.answers : [],
    fieldNotes: source.fieldNotes && typeof source.fieldNotes === "object" && !Array.isArray(source.fieldNotes) ? source.fieldNotes : {},
    finalReview: source.finalReview || null,
    badges: Array.isArray(source.badges) ? source.badges : []
  };

  if (!isAdmin) return normalized;

  return {
    ...normalized,
    tutorialCompleted: true,
    notebookIntroduced: true,
    unlockedPhases: FULL_UNLOCKED_PHASES,
    badges: ["primeira-pista", "linha-do-tempo", "leitura-local", "voz-publica", "guardia-do-dossie"]
  };
}

function createAdminUser(overrides = {}) {
  const base = {
    name: ADMIN_USERNAME,
    fullName: "Admin do Arquivo",
    password: ADMIN_PASSWORD,
    knowledgeLevel: 5,
    ageGroup: "25 a 34",
    gender: "Prefiro nao informar",
    location: "Muzambinho",
    occupation: "Pesquisador",
    avatar: "bertha",
    isAdmin: true,
    updatedAt: new Date().toISOString()
  };

  return {
    ...base,
    ...overrides,
    name: ADMIN_USERNAME,
    password: overrides.password || ADMIN_PASSWORD,
    isAdmin: true,
    progress: normalizeProgress(overrides.progress, true)
  };
}

async function writeJSON(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function initDB() {
  try { await fs.mkdir(DATA_DIR, { recursive: true }); } catch (e) {}
  try { await fs.access(USERS_PATH); } catch { await writeJSON(USERS_PATH, { current: null, users: [createAdminUser()] }); }
  try { await fs.access(REVIEWS_PATH); } catch { await writeJSON(REVIEWS_PATH, { reviews: [] }); }
}
initDB();

async function readJSON(filePath, fallback) {
  try {
    const data = await fs.readFile(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    return fallback;
  }
}

function normalizeUserPayload(body = {}, existing = {}) {
  const name = String(body.name || existing.name || "").trim();
  const isAdmin = name.toLowerCase() === ADMIN_USERNAME;
  if (!name) return null;

  if (isAdmin) {
    return createAdminUser({
      ...existing,
      ...body,
      fullName: body.fullName || existing.fullName || "Admin do Arquivo",
      progress: body.progress || existing.progress
    });
  }

  return {
    ...existing,
    name,
    fullName: body.fullName || existing.fullName || name,
    password: body.password || existing.password || "",
    knowledgeLevel: Number(body.knowledgeLevel || existing.knowledgeLevel) || 3,
    ageGroup: body.ageGroup || existing.ageGroup || "",
    gender: body.gender || existing.gender || "",
    location: body.location || existing.location || "",
    occupation: body.occupation || existing.occupation || "",
    avatar: body.avatar || existing.avatar || "leolinda",
    isAdmin: false,
    progress: normalizeProgress(body.progress || existing.progress, false),
    updatedAt: new Date().toISOString()
  };
}

app.get("/api/user", async (req, res) => {
  const data = await readJSON(USERS_PATH, { current: null, users: [] });
  data.users = Array.isArray(data.users) ? data.users : [];
  if (!data.users.some(user => String(user.name || "").toLowerCase() === ADMIN_USERNAME)) {
    data.users.unshift(createAdminUser());
    await writeJSON(USERS_PATH, data);
  }
  res.json(data);
});

app.post("/api/user", async (req, res) => {
  const body = req.body || {};
  if (!body.name || !body.password) {
    return res.status(400).json({ error: "Nome de usuario e senha sao obrigatorios." });
  }

  const data = await readJSON(USERS_PATH, { current: null, users: [] });
  data.users = Array.isArray(data.users) ? data.users : [];

  const name = String(body.name).trim().toLowerCase();
  const existingIndex = data.users.findIndex(user => String(user.name || "").trim().toLowerCase() === name);
  const existing = existingIndex >= 0 ? data.users[existingIndex] : {};
  const user = normalizeUserPayload(body, existing);

  if (!user) return res.status(400).json({ error: "Credencial invalida." });

  if (existingIndex >= 0) data.users[existingIndex] = user;
  else data.users.push(user);

  if (!data.users.some(item => String(item.name || "").toLowerCase() === ADMIN_USERNAME)) {
    data.users.unshift(createAdminUser());
  }

  data.current = user;
  await writeJSON(USERS_PATH, data);
  res.json(data);
});

app.post("/api/user/logout", async (req, res) => {
  const data = await readJSON(USERS_PATH, { current: null, users: [createAdminUser()] });
  data.current = null;
  await writeJSON(USERS_PATH, data);
  res.json({ success: true });
});

app.delete("/api/user/:name", async (req, res) => {
  const name = String(req.params.name || "").trim().toLowerCase();
  if (name === ADMIN_USERNAME) {
    return res.status(403).json({ error: "A credencial admin nao pode ser removida." });
  }

  const data = await readJSON(USERS_PATH, { current: null, users: [createAdminUser()] });
  data.users = Array.isArray(data.users) ? data.users.filter(user => String(user.name || "").trim().toLowerCase() !== name) : [];
  if (!data.users.some(user => String(user.name || "").toLowerCase() === ADMIN_USERNAME)) data.users.unshift(createAdminUser());
  if (data.current && String(data.current.name || "").trim().toLowerCase() === name) data.current = null;
  await writeJSON(USERS_PATH, data);
  res.json({ success: true });
});

app.get("/api/reviews", async (req, res) => {
  const data = await readJSON(REVIEWS_PATH, { reviews: [] });
  res.json({ reviews: Array.isArray(data.reviews) ? data.reviews : [] });
});

app.post("/api/reviews", async (req, res) => {
  const review = {
    ...req.body,
    date: req.body?.date || new Date().toISOString()
  };
  const reviewerName = String(review.name || "").trim();
  const rating = Number(review.rating);
  if (!reviewerName || !Number.isFinite(rating) || rating <= 0) {
    return res.status(400).json({ error: "Avaliacao incompleta." });
  }

  const data = await readJSON(REVIEWS_PATH, { reviews: [] });
  data.reviews = Array.isArray(data.reviews) ? data.reviews : [];
  data.reviews.unshift(review);
  await writeJSON(REVIEWS_PATH, data);

  const usersData = await readJSON(USERS_PATH, { current: null, users: [] });
  usersData.users = Array.isArray(usersData.users) ? usersData.users : [];
  const reviewerIndex = usersData.users.findIndex(user => String(user.name || "").trim().toLowerCase() === reviewerName.toLowerCase());
  if (reviewerIndex >= 0) {
    const reviewer = usersData.users[reviewerIndex];
    reviewer.progress = normalizeProgress(reviewer.progress, reviewerName.toLowerCase() === ADMIN_USERNAME);
    reviewer.progress.finalReview = review;
    reviewer.updatedAt = new Date().toISOString();
    usersData.users[reviewerIndex] = reviewer;
    if (usersData.current && String(usersData.current.name || "").trim().toLowerCase() === reviewerName.toLowerCase()) {
      usersData.current = reviewer;
    }
    await writeJSON(USERS_PATH, usersData);
  }

  res.status(201).json({ success: true, review });
});

app.listen(PORT, () => console.log(`Jogo rodando em: http://localhost:${PORT}`));

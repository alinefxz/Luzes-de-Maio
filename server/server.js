const express = require("express");
const path = require("path");
const fs = require("fs/promises");

const app = express();
const PORT = 3000;

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const DATA_DIR = path.join(__dirname, "data");
const USERS_PATH = path.join(DATA_DIR, "users.json");
const REVIEWS_PATH = path.join(DATA_DIR, "reviews.json");

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// inicializa os arquivos JSON
async function initDB() {
  try { await fs.mkdir(DATA_DIR, { recursive: true }); } catch (e) {}
  try { await fs.access(USERS_PATH); } catch { await fs.writeFile(USERS_PATH, JSON.stringify({ current: null, users: [] })); }
  try { await fs.access(REVIEWS_PATH); } catch { await fs.writeFile(REVIEWS_PATH, JSON.stringify({ reviews: [] })); }
}
initDB();

async function readJSON(filePath) {
  const data = await fs.readFile(filePath, "utf8");
  return JSON.parse(data);
}

// usuário
app.get("/api/user", async (req, res) => {
  const data = await readJSON(USERS_PATH);
  res.json(data);
});

app.post("/api/user", async (req, res) => {
  const body = req.body;
  // Agora exige Nome de Usuário e Senha
  if (!body.name || !body.password) return res.status(400).json({ error: "Nome de usuário e senha são obrigatórios." });

  let data = await readJSON(USERS_PATH);
  let existingIndex = data.users.findIndex(u => u.name.toLowerCase() === body.name.toLowerCase());

  let user = existingIndex >= 0 ? { ...data.users[existingIndex] } : {};

  // Salvando todos os campos, incluindo a Senha e o Nome Completo
  user.name = body.name;
  user.fullName = body.fullName || user.fullName || "";
  user.password = body.password;
  user.knowledgeLevel = Number(body.knowledgeLevel) || 3;
  user.ageGroup = body.ageGroup || "";
  user.gender = body.gender || "";
  user.location = body.location || "";
  user.occupation = body.occupation || "";
  user.avatar = body.avatar || "leolinda";
  user.updatedAt = new Date().toISOString();

  if (existingIndex >= 0) data.users[existingIndex] = user;
  else data.users.push(user);
  
  data.current = user;
  await fs.writeFile(USERS_PATH, JSON.stringify(data, null, 2));
  res.json(data);
});

// Logout
app.post("/api/user/logout", async (req, res) => {
  let data = await readJSON(USERS_PATH);
  data.current = null;
  await fs.writeFile(USERS_PATH, JSON.stringify(data, null, 2));
  res.json({ success: true });
});

// Rotas de Avaliação
app.get("/api/reviews", async (req, res) => {
  const data = await readJSON(REVIEWS_PATH);
  res.json(data);
});

app.post("/api/reviews", async (req, res) => {
  const review = req.body;
  let data = await readJSON(REVIEWS_PATH);
  data.reviews.unshift(review);
  await fs.writeFile(REVIEWS_PATH, JSON.stringify(data, null, 2));
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`Jogo rodando em: http://localhost:${PORT}`));
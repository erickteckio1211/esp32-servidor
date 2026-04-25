const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("MongoDB conectado"))
  .catch((err) => console.error("Erro MongoDB:", err));

const User = mongoose.model("User", {
  name: String,
  email: { type: String, unique: true },
  passwordHash: String,
});

const Device = mongoose.model("Device", {
  userId: mongoose.Schema.Types.ObjectId,
  name: String,
  deviceId: { type: String, unique: true },
  apiKey: String,
  createdAt: { type: Date, default: Date.now },
});

const Telemetry = mongoose.model("Telemetry", {
  userId: mongoose.Schema.Types.ObjectId,
  deviceId: String,
  temperatura: Number,
  ph: Number,
  data: String,
  horario: String,
  createdAt: { type: Date, default: Date.now },
});

function authUser(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ erro: "Token ausente" });

  try {
    req.user = jwt.verify(header.replace("Bearer ", ""), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ erro: "Token inválido" });
  }
}

function gerarApiKey() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let key = "";
  for (let i = 0; i < 8; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>AquaSense IoT</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<style>
:root {
  --bg: #020617;
  --panel: #0f172a;
  --card: #111827;
  --card2: #1e293b;
  --border: #334155;
  --text: #f8fafc;
  --muted: #94a3b8;
  --primary: #38bdf8;
  --primary2: #0ea5e9;
  --success: #22c55e;
  --danger: #ef4444;
  --warning: #f59e0b;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background:
    radial-gradient(circle at top left, rgba(56, 189, 248, 0.16), transparent 35%),
    radial-gradient(circle at bottom right, rgba(34, 197, 94, 0.10), transparent 30%),
    var(--bg);
  color: var(--text);
}

button, input, select {
  font-family: inherit;
}

.hidden {
  display: none !important;
}

.auth-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
}

.hero {
  padding: 64px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 56px;
}

.logo-icon {
  width: 46px;
  height: 46px;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--primary), var(--success));
  display: grid;
  place-items: center;
  font-weight: 900;
  color: #020617;
}

.hero h1 {
  font-size: clamp(38px, 6vw, 72px);
  line-height: 0.95;
  margin: 0 0 24px;
  letter-spacing: -0.05em;
}

.hero p {
  color: var(--muted);
  font-size: 18px;
  max-width: 560px;
  line-height: 1.7;
}

.hero-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  margin-top: 48px;
  max-width: 620px;
}

.hero-metric {
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.16);
  padding: 20px;
  border-radius: 22px;
  backdrop-filter: blur(20px);
}

.hero-metric strong {
  display: block;
  font-size: 26px;
}

.hero-metric span {
  color: var(--muted);
  font-size: 13px;
}

.auth-panel {
  display: grid;
  place-items: center;
  padding: 32px;
}

.auth-card {
  width: 100%;
  max-width: 430px;
  background: rgba(15, 23, 42, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 28px;
  padding: 34px;
  box-shadow: 0 28px 80px rgba(0,0,0,0.45);
  backdrop-filter: blur(22px);
}

.auth-card h2 {
  margin: 0 0 6px;
  font-size: 30px;
  letter-spacing: -0.03em;
}

.auth-card p {
  margin: 0 0 26px;
  color: var(--muted);
}

.field {
  margin-bottom: 14px;
}

.field label {
  display: block;
  font-size: 13px;
  color: var(--muted);
  margin-bottom: 8px;
}

.input {
  width: 100%;
  border: 1px solid var(--border);
  background: #020617;
  color: var(--text);
  border-radius: 14px;
  padding: 14px 15px;
  outline: none;
}

.input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 4px rgba(56,189,248,0.12);
}

.btn {
  border: none;
  border-radius: 14px;
  padding: 14px 18px;
  font-weight: 800;
  cursor: pointer;
  transition: 0.18s;
}

.btn-primary {
  width: 100%;
  background: linear-gradient(135deg, var(--primary), var(--primary2));
  color: #020617;
}

.btn-primary:hover {
  transform: translateY(-1px);
}

.btn-secondary {
  background: #1e293b;
  color: white;
  border: 1px solid var(--border);
}

.btn-danger {
  background: rgba(239,68,68,0.14);
  color: #fecaca;
  border: 1px solid rgba(239,68,68,0.28);
}

.switch-auth {
  text-align: center;
  color: var(--muted);
  margin-top: 18px;
  font-size: 14px;
}

.switch-auth button {
  background: none;
  border: none;
  color: var(--primary);
  cursor: pointer;
  font-weight: 800;
}

.app {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 280px 1fr;
}

.sidebar {
  border-right: 1px solid rgba(148,163,184,0.14);
  background: rgba(15,23,42,0.78);
  padding: 24px;
  position: sticky;
  top: 0;
  height: 100vh;
}

.nav-title {
  color: var(--muted);
  font-size: 12px;
  text-transform: uppercase;
  margin: 34px 0 12px;
  letter-spacing: 0.12em;
}

.nav-item {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 13px 14px;
  border-radius: 14px;
  color: #cbd5e1;
  margin-bottom: 8px;
  background: transparent;
}

.nav-item.active {
  background: rgba(56,189,248,0.13);
  color: var(--primary);
}

.main {
  padding: 30px;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 26px;
}

.topbar h1 {
  margin: 0;
  font-size: 32px;
  letter-spacing: -0.04em;
}

.topbar p {
  margin: 6px 0 0;
  color: var(--muted);
}

.grid {
  display: grid;
  gap: 20px;
}

.grid-4 {
  grid-template-columns: repeat(4, 1fr);
}

.grid-2 {
  grid-template-columns: 1.1fr 0.9fr;
}

.card {
  background: rgba(15,23,42,0.84);
  border: 1px solid rgba(148,163,184,0.16);
  border-radius: 24px;
  padding: 22px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.22);
}

.metric-label {
  color: var(--muted);
  font-size: 13px;
}

.metric-value {
  font-size: 34px;
  font-weight: 900;
  margin-top: 8px;
  letter-spacing: -0.04em;
}

.metric-foot {
  margin-top: 8px;
  font-size: 13px;
  color: var(--muted);
}

.status-dot {
  display: inline-flex;
  width: 9px;
  height: 9px;
  border-radius: 99px;
  background: var(--success);
  margin-right: 8px;
}

.device-list {
  display: grid;
  gap: 12px;
  max-height: 430px;
  overflow: auto;
}

.device-card {
  border: 1px solid rgba(148,163,184,0.14);
  background: #020617;
  padding: 16px;
  border-radius: 18px;
  cursor: pointer;
}

.device-card.active {
  border-color: var(--primary);
  box-shadow: 0 0 0 4px rgba(56,189,248,0.12);
}

.device-card strong {
  display: block;
  margin-bottom: 5px;
}

.device-card span {
  color: var(--muted);
  font-size: 13px;
}

.chart-box {
  height: 320px;
}

.chart-box canvas {
  width: 100% !important;
  height: 100% !important;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
}

.section-head h2 {
  margin: 0;
  letter-spacing: -0.03em;
}

.empty {
  border: 1px dashed rgba(148,163,184,0.32);
  border-radius: 20px;
  padding: 30px;
  text-align: center;
  color: var(--muted);
}

.modal-bg {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.72);
  display: grid;
  place-items: center;
  z-index: 9999;
  padding: 18px;
}

.modal {
  width: 100%;
  max-width: 520px;
  background: #0f172a;
  border: 1px solid rgba(148,163,184,0.2);
  border-radius: 26px;
  padding: 26px;
  box-shadow: 0 28px 90px rgba(0,0,0,0.6);
}

.modal h2 {
  margin: 0 0 8px;
}

.modal p {
  color: var(--muted);
}

.key-box {
  background: #020617;
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 16px;
  margin: 16px 0;
  font-size: 28px;
  text-align: center;
  letter-spacing: 0.16em;
  font-weight: 900;
  color: var(--primary);
}

.toast {
  position: fixed;
  right: 22px;
  bottom: 22px;
  background: #0f172a;
  border: 1px solid rgba(148,163,184,0.22);
  padding: 15px 18px;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.38);
  z-index: 10000;
}

.toast.success {
  border-color: rgba(34,197,94,0.4);
}

.toast.error {
  border-color: rgba(239,68,68,0.4);
}

.row {
  display: flex;
  gap: 12px;
}

.row .btn {
  flex: 1;
}

@media (max-width: 960px) {
  .auth-page {
    grid-template-columns: 1fr;
  }

  .hero {
    padding: 34px 24px 0;
  }

  .hero-metrics {
    grid-template-columns: 1fr;
  }

  .app {
    grid-template-columns: 1fr;
  }

  .sidebar {
    height: auto;
    position: relative;
  }

  .grid-4, .grid-2 {
    grid-template-columns: 1fr;
  }

  .main {
    padding: 18px;
  }

  .topbar {
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }
}
</style>
</head>

<body>

<div id="authPage" class="auth-page">
  <section class="hero">
    <div class="logo">
      <div class="logo-icon">A</div>
      <strong>AquaSense IoT</strong>
    </div>

    <h1>Monitoramento inteligente para sensores em campo.</h1>
    <p>Conecte ESP32s, acompanhe temperatura e pH em tempo real, visualize histórico e evolua seu produto para uma plataforma IoT completa.</p>

    <div class="hero-metrics">
      <div class="hero-metric"><strong>24/7</strong><span>Coleta contínua</span></div>
      <div class="hero-metric"><strong>IoT</strong><span>Multi-dispositivo</span></div>
      <div class="hero-metric"><strong>SaaS</strong><span>Dashboard web</span></div>
    </div>
  </section>

  <section class="auth-panel">
    <div id="loginCard" class="auth-card">
      <h2>Entrar</h2>
      <p>Acesse sua central de monitoramento.</p>

      <div class="field">
        <label>Email</label>
        <input class="input" id="email" placeholder="voce@email.com">
      </div>

      <div class="field">
        <label>Senha</label>
        <input class="input" id="senha" type="password" placeholder="Sua senha">
      </div>

      <button class="btn btn-primary" onclick="login()">Entrar</button>

      <div class="switch-auth">
        Não tem conta?
        <button onclick="showRegister()">Criar conta</button>
      </div>
    </div>

    <div id="registerCard" class="auth-card hidden">
      <h2>Criar conta</h2>
      <p>Comece a monitorar seus dispositivos.</p>

      <div class="field">
        <label>Nome</label>
        <input class="input" id="nomeC" placeholder="Seu nome">
      </div>

      <div class="field">
        <label>Email</label>
        <input class="input" id="emailC" placeholder="voce@email.com">
      </div>

      <div class="field">
        <label>Senha</label>
        <input class="input" id="senhaC" type="password" placeholder="Crie uma senha">
      </div>

      <button class="btn btn-primary" onclick="registerUser()">Criar conta</button>

      <div class="switch-auth">
        Já tem conta?
        <button onclick="showLogin()">Entrar</button>
      </div>
    </div>
  </section>
</div>

<div id="app" class="app hidden">
  <aside class="sidebar">
    <div class="logo">
      <div class="logo-icon">A</div>
      <strong>AquaSense</strong>
    </div>

    <div class="nav-title">Menu</div>
    <div class="nav-item active">📊 Dashboard</div>
    <div class="nav-item">🛰️ Dispositivos</div>
    <div class="nav-item">⚙️ Configurações</div>

    <div style="position:absolute;bottom:24px;left:24px;right:24px;">
      <button class="btn btn-danger" style="width:100%;" onclick="logout()">Sair</button>
    </div>
  </aside>

  <main class="main">
    <div class="topbar">
      <div>
        <h1>Dashboard</h1>
        <p>Visão geral dos seus dispositivos ESP32.</p>
      </div>

      <button class="btn btn-primary" style="width:auto;" onclick="openDeviceModal()">+ Novo dispositivo</button>
    </div>

    <section class="grid grid-4" style="margin-bottom:20px;">
      <div class="card">
        <div class="metric-label">Temperatura atual</div>
        <div id="temp" class="metric-value">-- °C</div>
        <div class="metric-foot">Última leitura recebida</div>
      </div>

      <div class="card">
        <div class="metric-label">pH atual</div>
        <div id="ph" class="metric-value">--</div>
        <div class="metric-foot">Escala 0 a 14</div>
      </div>

      <div class="card">
        <div class="metric-label">Status</div>
        <div id="status" class="metric-value" style="font-size:24px;"><span class="status-dot"></span>--</div>
        <div class="metric-foot">Baseado no último envio</div>
      </div>

      <div class="card">
        <div class="metric-label">Dispositivos</div>
        <div id="totalDevices" class="metric-value">0</div>
        <div class="metric-foot">Cadastrados na conta</div>
      </div>
    </section>

    <section class="grid grid-2">
      <div class="card">
        <div class="section-head">
          <h2>Telemetria</h2>
          <select class="input" id="devices" onchange="loadData()" style="width:auto;min-width:220px;"></select>
        </div>

        <div class="chart-box">
          <canvas id="tempChart"></canvas>
        </div>

        <div style="height:18px;"></div>

        <div class="chart-box">
          <canvas id="phChart"></canvas>
        </div>
      </div>

      <div class="card">
        <div class="section-head">
          <h2>Meus dispositivos</h2>
        </div>

        <div id="deviceList" class="device-list">
          <div class="empty">Nenhum dispositivo cadastrado ainda.</div>
        </div>
      </div>
    </section>
  </main>
</div>

<div id="deviceModal" class="modal-bg hidden">
  <div class="modal">
    <h2>Novo dispositivo</h2>
    <p>Crie um dispositivo e copie a API Key para configurar o ESP32.</p>

    <div class="field">
      <label>Nome do dispositivo</label>
      <input class="input" id="nomeD" placeholder="Ex: Caixa d'água 01">
    </div>

    <div class="field">
      <label>Device ID</label>
      <input class="input" id="deviceId" placeholder="Ex: esp32_001">
    </div>

    <div class="row">
      <button class="btn btn-secondary" onclick="closeDeviceModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="createDevice()">Criar dispositivo</button>
    </div>
  </div>
</div>

<div id="apiModal" class="modal-bg hidden">
  <div class="modal">
    <h2>Dispositivo criado</h2>
    <p>Use esta API Key no portal de configuração do ESP32.</p>

    <div id="apiKeyBox" class="key-box"></div>

    <div class="row">
      <button class="btn btn-secondary" onclick="closeApiModal()">Fechar</button>
      <button class="btn btn-primary" onclick="copyApiKey()">Copiar API Key</button>
    </div>
  </div>
</div>

<script>
let token = localStorage.getItem("token");
let tempChart;
let phChart;
let currentApiKey = "";
let selectedDevice = "";

if (token) showApp();

function toast(message, type = "success") {
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

function showRegister() {
  loginCard.classList.add("hidden");
  registerCard.classList.remove("hidden");
}

function showLogin() {
  registerCard.classList.add("hidden");
  loginCard.classList.remove("hidden");
}

function logout() {
  localStorage.removeItem("token");
  location.reload();
}

async function registerUser() {
  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        name: nomeC.value,
        email: emailC.value,
        password: senhaC.value
      })
    });

    const data = await res.json();

    if (!res.ok) {
      toast(data.erro || "Erro ao criar conta", "error");
      return;
    }

    toast("Conta criada com sucesso");
    showLogin();
  } catch {
    toast("Erro de conexão", "error");
  }
}

async function login() {
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        email: email.value,
        password: senha.value
      })
    });

    const data = await res.json();

    if (!data.token) {
      toast(data.erro || "Login inválido", "error");
      return;
    }

    token = data.token;
    localStorage.setItem("token", token);
    showApp();
  } catch {
    toast("Erro de conexão", "error");
  }
}

function setupCharts() {
  if (tempChart || phChart) return;

  tempChart = new Chart(document.getElementById("tempChart"), {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "Temperatura °C",
        data: [],
        tension: 0.35,
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });

  phChart = new Chart(document.getElementById("phChart"), {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "pH",
        data: [],
        tension: 0.35,
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          suggestedMin: 0,
          suggestedMax: 14
        }
      }
    }
  });
}

async function showApp() {
  authPage.classList.add("hidden");
  app.classList.remove("hidden");
  setupCharts();
  await loadDevices();
  setInterval(loadData, 3000);
}

function openDeviceModal() {
  deviceModal.classList.remove("hidden");
}

function closeDeviceModal() {
  deviceModal.classList.add("hidden");
}

function closeApiModal() {
  apiModal.classList.add("hidden");
}

async function createDevice() {
  try {
    const res = await fetch("/api/devices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({
        name: nomeD.value,
        deviceId: deviceId.value
      })
    });

    const data = await res.json();

    if (!res.ok) {
      toast(data.erro || "Erro ao criar dispositivo", "error");
      return;
    }

    currentApiKey = data.apiKey;
    apiKeyBox.textContent = data.apiKey;
    closeDeviceModal();
    apiModal.classList.remove("hidden");

    nomeD.value = "";
    deviceId.value = "";

    toast("Dispositivo criado");
    await loadDevices();
  } catch {
    toast("Erro de conexão", "error");
  }
}

async function copyApiKey() {
  try {
    await navigator.clipboard.writeText(currentApiKey);
    toast("API Key copiada");
  } catch {
    toast("Não foi possível copiar", "error");
  }
}

async function loadDevices() {
  const res = await fetch("/api/devices", {
    headers: {"Authorization": "Bearer " + token}
  });

  const data = await res.json();

  if (!Array.isArray(data)) {
    toast("Sessão expirada. Faça login novamente.", "error");
    logout();
    return;
  }

  totalDevices.textContent = data.length;
  devices.innerHTML = "";
  deviceList.innerHTML = "";

  if (data.length === 0) {
    deviceList.innerHTML = '<div class="empty">Nenhum dispositivo cadastrado ainda. Clique em “Novo dispositivo” para começar.</div>';
    temp.textContent = "-- °C";
    ph.textContent = "--";
    status.innerHTML = "--";
    return;
  }

  data.forEach((d, index) => {
    const option = document.createElement("option");
    option.value = d.deviceId;
    option.textContent = d.name + " · " + d.deviceId;
    devices.appendChild(option);

    const div = document.createElement("div");
    div.className = "device-card" + (index === 0 ? " active" : "");
    div.onclick = () => {
      selectedDevice = d.deviceId;
      devices.value = d.deviceId;
      document.querySelectorAll(".device-card").forEach(x => x.classList.remove("active"));
      div.classList.add("active");
      loadData();
    };
    div.innerHTML = "<strong>" + d.name + "</strong><span>" + d.deviceId + "</span>";
    deviceList.appendChild(div);
  });

  selectedDevice = data[0].deviceId;
  devices.value = selectedDevice;
  await loadData();
}

async function loadData() {
  const id = devices.value || selectedDevice;
  if (!id) return;

  const res = await fetch("/api/telemetry/" + id, {
    headers: {"Authorization": "Bearer " + token}
  });

  const data = await res.json();

  if (!Array.isArray(data) || data.length === 0) {
    temp.textContent = "-- °C";
    ph.textContent = "--";
    status.innerHTML = '<span style="color:var(--warning)">Aguardando dados</span>';

    tempChart.data.labels = [];
    tempChart.data.datasets[0].data = [];
    tempChart.update();

    phChart.data.labels = [];
    phChart.data.datasets[0].data = [];
    phChart.update();
    return;
  }

  const last = data[data.length - 1];

  temp.textContent = last.temperatura + " °C";
  ph.textContent = last.ph;

  const lastDate = new Date(last.createdAt);
  const diffSeconds = Math.floor((Date.now() - lastDate.getTime()) / 1000);

  if (diffSeconds < 30) {
    status.innerHTML = '<span class="status-dot"></span>Online';
  } else {
    status.innerHTML = '<span style="color:var(--warning)">Offline</span>';
  }

  const labels = data.map(d => d.horario || new Date(d.createdAt).toLocaleTimeString());

  tempChart.data.labels = labels;
  tempChart.data.datasets[0].data = data.map(d => d.temperatura);
  tempChart.update();

  phChart.data.labels = labels;
  phChart.data.datasets[0].data = data.map(d => d.ph);
  phChart.update();
}
</script>

</body>
</html>
`);
});

app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ erro: "Preencha todos os campos" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash });

    res.json({ status: "ok", userId: user._id });
  } catch (err) {
    res.status(400).json({
      erro: "Erro ao cadastrar usuário",
      detalhe: err.message,
    });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ erro: "Usuário não encontrado" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ erro: "Senha inválida" });

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao fazer login" });
  }
});

app.post("/api/devices", authUser, async (req, res) => {
  try {
    const { name, deviceId } = req.body;

    if (!name || !deviceId) {
      return res.status(400).json({ erro: "Nome e Device ID são obrigatórios" });
    }

    const apiKey = gerarApiKey();

    const device = await Device.create({
      userId: req.user.userId,
      name,
      deviceId,
      apiKey,
    });

    res.json({
      status: "ok",
      deviceId: device.deviceId,
      apiKey: device.apiKey,
    });
  } catch (err) {
    res.status(400).json({
      erro: "Erro ao criar dispositivo",
      detalhe: err.message,
    });
  }
});

app.get("/api/devices", authUser, async (req, res) => {
  const devices = await Device.find({ userId: req.user.userId }).select("-apiKey");
  res.json(devices);
});

app.post("/dados", async (req, res) => {
  try {
    const { deviceId, apiKey, temperatura, ph, data, horario } = req.body;

    const device = await Device.findOne({ deviceId, apiKey });
    if (!device) return res.status(401).json({ erro: "Dispositivo não autorizado" });

    await Telemetry.create({
      userId: device.userId,
      deviceId,
      temperatura,
      ph,
      data,
      horario,
    });

    res.json({ status: "ok" });
  } catch (err) {
    res.status(400).json({
      erro: "Erro ao receber dados",
      detalhe: err.message,
    });
  }
});

app.get("/api/telemetry/:deviceId", authUser, async (req, res) => {
  const device = await Device.findOne({
    userId: req.user.userId,
    deviceId: req.params.deviceId,
  });

  if (!device) return res.status(403).json({ erro: "Acesso negado" });

  const data = await Telemetry.find({
    userId: req.user.userId,
    deviceId: req.params.deviceId,
  })
    .sort({ createdAt: -1 })
    .limit(50);

  res.json(data.reverse());
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Servidor rodando na porta " + (process.env.PORT || 3000));
});

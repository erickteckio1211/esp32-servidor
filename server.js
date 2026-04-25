const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;

mongoose.connect(MONGODB_URI)
  .then(() => console.log("MongoDB conectado"))
  .catch(err => console.error("Erro MongoDB:", err));

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  passwordHash: String
});

const DeviceSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  name: String,
  deviceId: { type: String, unique: true },
  apiKey: String,
  createdAt: { type: Date, default: Date.now }
});

const TelemetrySchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  deviceId: String,
  temperatura: Number,
  ph: Number,
  data: String,
  horario: String,
  mensagem: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", UserSchema);
const Device = mongoose.model("Device", DeviceSchema);
const Telemetry = mongoose.model("Telemetry", TelemetrySchema);

function authUser(req, res, next) {
  const header = req.headers.authorization;

  if (!header) return res.status(401).json({ erro: "Token ausente" });

  const token = header.replace("Bearer ", "");

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ erro: "Token inválido" });
  }
}

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>ESP32 Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: #0f172a;
      color: #e5e7eb;
    }

    .container {
      max-width: 1100px;
      margin: auto;
      padding: 30px;
    }

    .box {
      background: #1e293b;
      padding: 25px;
      border-radius: 18px;
      margin-bottom: 25px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.25);
    }

    input, button, select {
      padding: 12px;
      margin: 6px;
      border-radius: 8px;
      border: none;
    }

    input, select {
      background: #334155;
      color: white;
    }

    button {
      background: #38bdf8;
      color: #020617;
      font-weight: bold;
      cursor: pointer;
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 20px;
    }

    .card {
      background: #020617;
      padding: 20px;
      border-radius: 16px;
    }

    .valor {
      font-size: 32px;
      font-weight: bold;
      color: #38bdf8;
    }

    canvas {
      background: white;
      border-radius: 12px;
      padding: 12px;
    }

    pre {
      background: #020617;
      padding: 15px;
      border-radius: 12px;
      overflow: auto;
    }

    .hidden {
      display: none;
    }
  </style>
</head>
<body>
<div class="container">
  <h1>Dashboard ESP32</h1>

  <div id="authBox" class="box">
    <h2>Login</h2>
    <input id="email" placeholder="Email">
    <input id="senha" type="password" placeholder="Senha">
    <button onclick="login()">Entrar</button>

    <h3>Criar conta</h3>
    <input id="nomeCadastro" placeholder="Nome">
    <input id="emailCadastro" placeholder="Email">
    <input id="senhaCadastro" type="password" placeholder="Senha">
    <button onclick="cadastrar()">Cadastrar</button>
  </div>

  <div id="dashboardBox" class="hidden">
    <div class="box">
      <button onclick="logout()">Sair</button>
      <h2>Cadastrar ESP32</h2>
      <input id="nomeDevice" placeholder="Nome do ESP32">
      <input id="deviceId" placeholder="Device ID. Ex: esp32_001">
      <button onclick="criarDevice()">Cadastrar dispositivo</button>
    </div>

    <div class="box">
      <h2>Meus dispositivos</h2>
      <select id="devices" onchange="carregarDados()"></select>
      <pre id="deviceInfo"></pre>
    </div>

    <div class="cards">
      <div class="card">
        <h3>Temperatura</h3>
        <div id="tempAtual" class="valor">-- °C</div>
      </div>
      <div class="card">
        <h3>pH</h3>
        <div id="phAtual" class="valor">--</div>
      </div>
      <div class="card">
        <h3>Última leitura</h3>
        <div id="ultimaLeitura" class="valor">--</div>
      </div>
    </div>

    <div class="box">
      <h2>Temperatura</h2>
      <canvas id="graficoTemp"></canvas>
    </div>

    <div class="box">
      <h2>pH</h2>
      <canvas id="graficoPh"></canvas>
    </div>
  </div>
</div>

<script>
let token = localStorage.getItem("token");
let tempChart;
let phChart;

if (token) mostrarDashboard();

async function cadastrar() {
  const res = await fetch("/api/register", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      name: document.getElementById("nomeCadastro").value,
      email: document.getElementById("emailCadastro").value,
      password: document.getElementById("senhaCadastro").value
    })
  });

  alert(JSON.stringify(await res.json()));
}

async function login() {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      email: document.getElementById("email").value,
      password: document.getElementById("senha").value
    })
  });

  const data = await res.json();

  if (data.token) {
    token = data.token;
    localStorage.setItem("token", token);
    mostrarDashboard();
  } else {
    alert(JSON.stringify(data));
  }
}

function logout() {
  localStorage.removeItem("token");
  location.reload();
}

async function mostrarDashboard() {
  document.getElementById("authBox").classList.add("hidden");
  document.getElementById("dashboardBox").classList.remove("hidden");

  iniciarGraficos();
  await carregarDevices();
  setInterval(carregarDados, 3000);
}

function iniciarGraficos() {
  tempChart = new Chart(document.getElementById("graficoTemp"), {
    type: "line",
    data: { labels: [], datasets: [{ label: "Temperatura °C", data: [], borderWidth: 3, tension: 0.3 }] }
  });

  phChart = new Chart(document.getElementById("graficoPh"), {
    type: "line",
    data: { labels: [], datasets: [{ label: "pH", data: [], borderWidth: 3, tension: 0.3 }] },
    options: { scales: { y: { suggestedMin: 0, suggestedMax: 14 } } }
  });
}

async function criarDevice() {
  const res = await fetch("/api/devices", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify({
      name: document.getElementById("nomeDevice").value,
      deviceId: document.getElementById("deviceId").value
    })
  });

  const data = await res.json();

  if (!data.apiKey) {
    alert("Erro ao criar dispositivo");
    return;
  }

  // cria modal simples
  const modal = document.createElement("div");
  modal.innerHTML = `
    <div style="
      position:fixed;
      top:0; left:0;
      width:100%;
      height:100%;
      background:rgba(0,0,0,0.7);
      display:flex;
      align-items:center;
      justify-content:center;
      z-index:9999;
    ">
      <div style="
        background:#1e293b;
        padding:25px;
        border-radius:16px;
        width:90%;
        max-width:500px;
        text-align:center;
      ">
        <h2>API Key do dispositivo</h2>

        <textarea id="apiKeyBox" style="
          width:100%;
          height:100px;
          margin:15px 0;
          padding:10px;
          border-radius:8px;
          background:#020617;
          color:#38bdf8;
        ">${data.apiKey}</textarea>

        <button onclick="copiarApiKey()">Copiar</button>
        <button onclick="fecharModal()">Fechar</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function copiarApiKey() {
  const box = document.getElementById("apiKeyBox");
  box.select();
  document.execCommand("copy");
  alert("API Key copiada!");
}

function fecharModal() {
  document.body.removeChild(document.body.lastChild);
}

async function carregarDevices() {
  const res = await fetch("/api/devices", {
    headers: { "Authorization": "Bearer " + token }
  });

  const devices = await res.json();
  const select = document.getElementById("devices");
  select.innerHTML = "";

  devices.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.deviceId;
    opt.textContent = d.name + " - " + d.deviceId;
    select.appendChild(opt);
  });

  if (devices.length > 0) {
    document.getElementById("deviceInfo").textContent =
      "Dispositivo selecionado: " + devices[0].deviceId;
    carregarDados();
  }
}

async function carregarDados() {
  const deviceId = document.getElementById("devices").value;
  if (!deviceId) return;

  const res = await fetch("/api/telemetry/" + deviceId, {
    headers: { "Authorization": "Bearer " + token }
  });

  const dados = await res.json();

  if (!Array.isArray(dados) || dados.length === 0) return;

  const ultimo = dados[dados.length - 1];

  document.getElementById("tempAtual").textContent = ultimo.temperatura + " °C";
  document.getElementById("phAtual").textContent = ultimo.ph;
  document.getElementById("ultimaLeitura").textContent = ultimo.horario || "--";

  const labels = dados.map(d => d.horario || new Date(d.createdAt).toLocaleTimeString());
  const temps = dados.map(d => d.temperatura);
  const phs = dados.map(d => d.ph);

  tempChart.data.labels = labels;
  tempChart.data.datasets[0].data = temps;
  tempChart.update();

  phChart.data.labels = labels;
  phChart.data.datasets[0].data = phs;
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

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      passwordHash
    });

    res.json({ status: "ok", userId: user._id });
  } catch (err) {
    res.status(400).json({ erro: "Erro ao cadastrar usuário", detalhe: err.message });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(401).json({ erro: "Usuário não encontrado" });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);

  if (!ok) {
    return res.status(401).json({ erro: "Senha inválida" });
  }

  const token = jwt.sign(
    { userId: user._id, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token });
});

app.post("/api/devices", authUser, async (req, res) => {
  try {
    const { name, deviceId } = req.body;

    const apiKey = crypto.randomBytes(32).toString("hex");

    const device = await Device.create({
      userId: req.user.userId,
      name,
      deviceId,
      apiKey
    });

    res.json({
      status: "ok",
      deviceId: device.deviceId,
      apiKey: device.apiKey
    });
  } catch (err) {
    res.status(400).json({ erro: "Erro ao criar dispositivo", detalhe: err.message });
  }
});

app.get("/api/devices", authUser, async (req, res) => {
  const devices = await Device.find({ userId: req.user.userId }).select("-apiKey");
  res.json(devices);
});

app.post("/dados", async (req, res) => {
  try {
    const { deviceId, apiKey, temperatura, ph, data, horario, mensagem } = req.body;

    const device = await Device.findOne({ deviceId, apiKey });

    if (!device) {
      return res.status(401).json({ erro: "Dispositivo não autorizado" });
    }

    const registro = await Telemetry.create({
      userId: device.userId,
      deviceId,
      temperatura,
      ph,
      data,
      horario,
      mensagem
    });

    res.json({
      status: "ok",
      id: registro._id
    });
  } catch (err) {
    res.status(400).json({ erro: "Erro ao receber dados", detalhe: err.message });
  }
});

app.get("/api/telemetry/:deviceId", authUser, async (req, res) => {
  const deviceId = req.params.deviceId;

  const device = await Device.findOne({
    userId: req.user.userId,
    deviceId
  });

  if (!device) {
    return res.status(403).json({ erro: "Acesso negado" });
  }

  const dados = await Telemetry.find({
    userId: req.user.userId,
    deviceId
  })
    .sort({ createdAt: -1 })
    .limit(50);

  res.json(dados.reverse());
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});

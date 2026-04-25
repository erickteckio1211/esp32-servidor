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

/* ===================== MODELS ===================== */

const User = mongoose.model("User", {
  name: String,
  email: { type: String, unique: true },
  passwordHash: String
});

const Device = mongoose.model("Device", {
  userId: mongoose.Schema.Types.ObjectId,
  name: String,
  deviceId: { type: String, unique: true },
  apiKey: String
});

const Telemetry = mongoose.model("Telemetry", {
  userId: mongoose.Schema.Types.ObjectId,
  deviceId: String,
  temperatura: Number,
  ph: Number,
  data: String,
  horario: String,
  createdAt: { type: Date, default: Date.now }
});

/* ===================== AUTH ===================== */

function authUser(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ erro: "Token ausente" });

  try {
    req.user = jwt.verify(header.replace("Bearer ", ""), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ erro: "Token inválido" });
  }
}

/* ===================== FRONT ===================== */

app.get("/", (req, res) => {
res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ESP32 Monitor</title>

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<style>
body {
  margin:0;
  font-family: system-ui;
  background:#0f172a;
  color:white;
}

.container {
  max-width:420px;
  margin:auto;
  padding:20px;
}

.card {
  background:#1e293b;
  padding:20px;
  border-radius:16px;
  margin-bottom:20px;
}

input, button {
  width:100%;
  padding:14px;
  margin-top:10px;
  border:none;
  border-radius:10px;
}

input {
  background:#334155;
  color:white;
}

button {
  background:#38bdf8;
  font-weight:bold;
  cursor:pointer;
}

.small {
  text-align:center;
  margin-top:10px;
  color:#94a3b8;
  cursor:pointer;
}

.device {
  padding:15px;
  background:#020617;
  border-radius:12px;
  margin-top:10px;
}

.badge {
  font-size:12px;
  color:#22c55e;
}

.value {
  font-size:28px;
  font-weight:bold;
}

.hidden { display:none; }
</style>
</head>

<body>

<div class="container">

<!-- LOGIN -->
<div id="login">
  <h2>Entrar</h2>
  <div class="card">
    <input id="email" placeholder="Email">
    <input id="senha" type="password" placeholder="Senha">
    <button onclick="login()">Entrar</button>
    <div class="small" onclick="showRegister()">Criar conta</div>
  </div>
</div>

<!-- REGISTER -->
<div id="register" class="hidden">
  <h2>Criar conta</h2>
  <div class="card">
    <input id="nomeC" placeholder="Nome">
    <input id="emailC" placeholder="Email">
    <input id="senhaC" type="password" placeholder="Senha">
    <button onclick="register()">Criar</button>
    <div class="small" onclick="showLogin()">Já tenho conta</div>
  </div>
</div>

<!-- DASHBOARD -->
<div id="dash" class="hidden">

  <h2>Meus dispositivos</h2>

  <div class="card">
    <input id="nomeD" placeholder="Nome do dispositivo">
    <input id="deviceId" placeholder="deviceId">
    <button onclick="createDevice()">Adicionar dispositivo</button>
  </div>

  <div id="deviceList"></div>

  <div class="card">
    <select id="devices" onchange="loadData()"></select>
  </div>

  <div class="card">
    <div>Temperatura</div>
    <div id="temp" class="value">--</div>

    <div>pH</div>
    <div id="ph" class="value">--</div>
  </div>

  <div class="card">
    <canvas id="chart"></canvas>
  </div>

</div>

</div>

<script>

let token = localStorage.getItem("token");
let chart;

if(token) showDash();

function showRegister(){
  login.style.display="none";
  register.style.display="block";
}

function showLogin(){
  register.style.display="none";
  login.style.display="block";
}

async function register(){
  await fetch("/api/register",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      name:nomeC.value,
      email:emailC.value,
      password:senhaC.value
    })
  });
  alert("Conta criada!");
  showLogin();
}

async function login(){
  const res = await fetch("/api/login",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      email:email.value,
      password:senha.value
    })
  });

  const data = await res.json();
  token = data.token;
  localStorage.setItem("token",token);

  showDash();
}

async function showDash(){
  login.style.display="none";
  register.style.display="none";
  dash.style.display="block";

  chart = new Chart(document.getElementById("chart"),{
    type:"line",
    data:{labels:[],datasets:[{label:"Temperatura",data:[]}]}
  });

  loadDevices();
  setInterval(loadData,3000);
}

async function createDevice(){
  const res = await fetch("/api/devices",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":"Bearer "+token
    },
    body:JSON.stringify({
      name:nomeD.value,
      deviceId:deviceId.value
    })
  });

  const data = await res.json();

  alert("API Key:\n"+data.apiKey);
  loadDevices();
}

async function loadDevices(){
  const res = await fetch("/api/devices",{
    headers:{Authorization:"Bearer "+token}
  });

  const data = await res.json();

  devices.innerHTML="";
  deviceList.innerHTML="";

  data.forEach(d=>{
    const o=document.createElement("option");
    o.value=d.deviceId;
    o.textContent=d.name;
    devices.appendChild(o);

    const div=document.createElement("div");
    div.className="device";
    div.innerHTML=\`
      <b>\${d.name}</b><br>
      <span class="badge">Ativo</span>
    \`;
    deviceList.appendChild(div);
  });

  loadData();
}

async function loadData(){
  const id = devices.value;
  if(!id) return;

  const res = await fetch("/api/telemetry/"+id,{
    headers:{Authorization:"Bearer "+token}
  });

  const data = await res.json();
  if(!data.length) return;

  const last = data[data.length-1];

  temp.textContent = last.temperatura+" °C";
  ph.textContent = last.ph;

  chart.data.labels = data.map(d=>d.horario);
  chart.data.datasets[0].data = data.map(d=>d.temperatura);
  chart.update();
}

</script>

</body>
</html>
`);
});

/* ===================== API ===================== */

app.post("/api/register", async (req,res)=>{
  const {name,email,password} = req.body;
  const hash = await bcrypt.hash(password,10);
  const user = await User.create({name,email,passwordHash:hash});
  res.json({status:"ok",userId:user._id});
});

app.post("/api/login", async (req,res)=>{
  const {email,password} = req.body;
  const user = await User.findOne({email});
  if(!user) return res.status(401).json({erro:"Usuário não encontrado"});

  const ok = await bcrypt.compare(password,user.passwordHash);
  if(!ok) return res.status(401).json({erro:"Senha inválida"});

  const token = jwt.sign({userId:user._id},JWT_SECRET,{expiresIn:"7d"});
  res.json({token});
});

app.post("/api/devices", authUser, async (req,res)=>{
  const apiKey = crypto.randomBytes(6).toString("hex"); // 12 caracteres

  const device = await Device.create({
    userId:req.user.userId,
    name:req.body.name,
    deviceId:req.body.deviceId,
    apiKey
  });

  res.json({apiKey});
});

app.get("/api/devices", authUser, async (req,res)=>{
  const devices = await Device.find({userId:req.user.userId}).select("-apiKey");
  res.json(devices);
});

app.post("/dados", async (req,res)=>{
  const {deviceId,apiKey,temperatura,ph,data,horario} = req.body;

  const device = await Device.findOne({deviceId,apiKey});
  if(!device) return res.status(401).json({erro:"não autorizado"});

  await Telemetry.create({
    userId:device.userId,
    deviceId,
    temperatura,
    ph,
    data,
    horario
  });

  res.json({status:"ok"});
});

app.get("/api/telemetry/:deviceId", authUser, async (req,res)=>{
  const data = await Telemetry.find({
    userId:req.user.userId,
    deviceId:req.params.deviceId
  }).sort({createdAt:-1}).limit(50);

  res.json(data.reverse());
});

/* ===================== START ===================== */

app.listen(process.env.PORT || 3000,()=>{
  console.log("Servidor rodando");
});

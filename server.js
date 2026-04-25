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
<meta charset="UTF-8">
<title>Dashboard ESP32</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
body { font-family: Arial; background:#0f172a; color:white; padding:20px; }
.box { background:#1e293b; padding:20px; border-radius:10px; margin-bottom:20px; }
input, button, select { padding:10px; margin:5px; border-radius:6px; border:none; }
button { background:#38bdf8; cursor:pointer; }
.hidden { display:none; }
textarea { width:100%; height:80px; }
</style>
</head>
<body>

<h1>ESP32 Dashboard</h1>

<div id="auth">
  <div class="box">
    <h2>Login</h2>
    <input id="email" placeholder="Email">
    <input id="senha" type="password" placeholder="Senha">
    <button onclick="login()">Entrar</button>
  </div>

  <div class="box">
    <h2>Criar conta</h2>
    <input id="nomeC" placeholder="Nome">
    <input id="emailC" placeholder="Email">
    <input id="senhaC" type="password" placeholder="Senha">
    <button onclick="cadastrar()">Cadastrar</button>
  </div>
</div>

<div id="dash" class="hidden">

  <button onclick="logout()">Sair</button>

  <div class="box">
    <h2>Novo dispositivo</h2>
    <input id="nomeD" placeholder="Nome">
    <input id="deviceId" placeholder="deviceId">
    <button onclick="criarDevice()">Criar</button>
  </div>

  <div class="box">
    <h2>Dispositivos</h2>
    <select id="devices" onchange="loadData()"></select>
  </div>

  <div class="box">
    <h3>Temperatura: <span id="temp">--</span></h3>
    <h3>pH: <span id="ph">--</span></h3>
  </div>

  <div class="box">
    <canvas id="chart"></canvas>
  </div>

</div>

<script>
let token = localStorage.getItem("token");
let chart;

if(token) showDash();

async function cadastrar(){
  await fetch("/api/register",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      name:nomeC.value,
      email:emailC.value,
      password:senhaC.value
    })
  });
  alert("Usuário criado");
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

function logout(){
  localStorage.removeItem("token");
  location.reload();
}

async function showDash(){
  auth.classList.add("hidden");
  dash.classList.remove("hidden");

  chart = new Chart(document.getElementById("chart"),{
    type:"line",
    data:{labels:[],datasets:[{label:"Temp",data:[]}]}
  });

  await loadDevices();
  setInterval(loadData,3000);
}

async function criarDevice(){
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

  const modal = document.createElement("div");
  modal.innerHTML = \`
    <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:#000a;display:flex;align-items:center;justify-content:center;">
      <div style="background:#1e293b;padding:20px;border-radius:10px;">
        <h2>API KEY</h2>
        <textarea id="box">\${data.apiKey}</textarea>
        <button onclick="copy()">Copiar</button>
        <button onclick="closeModal()">Fechar</button>
      </div>
    </div>
  \`;
  document.body.appendChild(modal);

  await loadDevices();
}

function copy(){
  const b=document.getElementById("box");
  b.select();
  document.execCommand("copy");
  alert("Copiado!");
}

function closeModal(){
  document.body.removeChild(document.body.lastChild);
}

async function loadDevices(){
  const res = await fetch("/api/devices",{
    headers:{"Authorization":"Bearer "+token}
  });
  const data = await res.json();

  devices.innerHTML="";
  data.forEach(d=>{
    const o=document.createElement("option");
    o.value=d.deviceId;
    o.textContent=d.name;
    devices.appendChild(o);
  });

  loadData();
}

async function loadData(){
  const id = devices.value;
  if(!id) return;

  const res = await fetch("/api/telemetry/"+id,{
    headers:{"Authorization":"Bearer "+token}
  });

  const data = await res.json();
  if(!data.length) return;

  const last = data[data.length-1];
  temp.textContent = last.temperatura;
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
  const apiKey = crypto.randomBytes(32).toString("hex");

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

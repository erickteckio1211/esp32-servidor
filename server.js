const express = require("express");
const app = express();

app.use(express.json());

let dadosRecebidos = [];

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Dashboard ESP32</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: #0f172a;
      color: #e5e7eb;
    }

    header {
      padding: 24px;
      text-align: center;
      background: #111827;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }

    h1 {
      margin: 0;
      color: #38bdf8;
    }

    .container {
      max-width: 1100px;
      margin: 30px auto;
      padding: 20px;
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .card {
      background: #1e293b;
      border-radius: 18px;
      padding: 24px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.25);
    }

    .card h2 {
      margin: 0 0 10px;
      font-size: 16px;
      color: #94a3b8;
    }

    .valor {
      font-size: 34px;
      font-weight: bold;
      color: #f8fafc;
    }

    .graficos {
      display: grid;
      grid-template-columns: 1fr;
      gap: 25px;
    }

    .grafico-box {
      background: #1e293b;
      border-radius: 18px;
      padding: 24px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.25);
    }

    .status {
      margin-top: 20px;
      text-align: center;
      color: #22c55e;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <header>
    <h1>Dashboard ESP32</h1>
    <p>Temperatura e pH em tempo real</p>
  </header>

  <div class="container">
    <div class="cards">
      <div class="card">
        <h2>Temperatura</h2>
        <div class="valor" id="temperatura">-- °C</div>
      </div>

      <div class="card">
        <h2>pH</h2>
        <div class="valor" id="ph">--</div>
      </div>

      <div class="card">
        <h2>Última data</h2>
        <div class="valor" id="data">--</div>
      </div>

      <div class="card">
        <h2>Último horário</h2>
        <div class="valor" id="horario">--</div>
      </div>
    </div>

    <div class="graficos">
      <div class="grafico-box">
        <canvas id="graficoTemperatura"></canvas>
      </div>

      <div class="grafico-box">
        <canvas id="graficoPh"></canvas>
      </div>
    </div>

    <div class="status" id="status">Aguardando dados...</div>
  </div>

  <script>
    const ctxTemp = document.getElementById("graficoTemperatura");
    const ctxPh = document.getElementById("graficoPh");

    const graficoTemperatura = new Chart(ctxTemp, {
      type: "line",
      data: {
        labels: [],
        datasets: [{
          label: "Temperatura °C",
          data: [],
          borderWidth: 3,
          tension: 0.35
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: false }
        }
      }
    });

    const graficoPh = new Chart(ctxPh, {
      type: "line",
      data: {
        labels: [],
        datasets: [{
          label: "pH",
          data: [],
          borderWidth: 3,
          tension: 0.35
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            suggestedMin: 0,
            suggestedMax: 14
          }
        }
      }
    });

    async function atualizarDashboard() {
      try {
        const resposta = await fetch("/api/dados");
        const dados = await resposta.json();

        if (dados.length === 0) {
          document.getElementById("status").innerText = "Aguardando dados do ESP32...";
          return;
        }

        const ultimo = dados[dados.length - 1];

        document.getElementById("temperatura").innerText = ultimo.temperatura + " °C";
        document.getElementById("ph").innerText = ultimo.ph;
        document.getElementById("data").innerText = ultimo.data;
        document.getElementById("horario").innerText = ultimo.horario;

        const labels = dados.map(item => item.horario);
        const temperaturas = dados.map(item => item.temperatura);
        const phs = dados.map(item => item.ph);

        graficoTemperatura.data.labels = labels;
        graficoTemperatura.data.datasets[0].data = temperaturas;
        graficoTemperatura.update();

        graficoPh.data.labels = labels;
        graficoPh.data.datasets[0].data = phs;
        graficoPh.update();

        document.getElementById("status").innerText = "Dados atualizados automaticamente";
      } catch (erro) {
        document.getElementById("status").innerText = "Erro ao buscar dados";
        console.error(erro);
      }
    }

    setInterval(atualizarDashboard, 2000);
    atualizarDashboard();
  </script>
</body>
</html>
  `);
});

app.get("/api/dados", (req, res) => {
  res.json(dadosRecebidos);
});

app.post("/dados", (req, res) => {
  const dados = req.body;

  console.log("Dados recebidos:", dados);

  dadosRecebidos.push(dados);

  if (dadosRecebidos.length > 50) {
    dadosRecebidos.shift();
  }

  res.json({
    status: "ok",
    recebido: dados
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});

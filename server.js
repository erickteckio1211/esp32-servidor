const express = require("express");
const app = express();

app.use(express.json());

let ultimosDados = [];

app.get("/", (req, res) => {
  let html = `
    <h1>Dados recebidos do ESP32</h1>
    <p>Total recebido: ${ultimosDados.length}</p>
    <pre>${JSON.stringify(ultimosDados, null, 2)}</pre>
  `;

  res.send(html);
});

app.post("/dados", (req, res) => {
  const dados = req.body;

  console.log("Dados recebidos:", dados);

  ultimosDados.push(dados);

  if (ultimosDados.length > 20) {
    ultimosDados.shift();
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

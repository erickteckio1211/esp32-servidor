const express = require("express");
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Servidor ESP32 funcionando 🚀");
});

app.post("/dados", (req, res) => {
  console.log("📩 Dados recebidos:");
  console.log(req.body);

  res.json({
    status: "ok"
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});

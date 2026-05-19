const express = require("express")

const app = express()

// PUERTO
const PORT = 3000

// RUTA PRINCIPAL
app.get("/", (req, res) => {
  res.send("Backend funcionando 🚀")
})

// LEVANTAR SERVIDOR
app.listen(PORT, () => {
  console.log(
    `Servidor corriendo en puerto ${PORT}`
  )
})
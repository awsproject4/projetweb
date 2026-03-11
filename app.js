const express = require("express");

const app = express();
PORT = 3000;
app.get("/", (req, res) => {
    res.send("Serveur fonctionne");
});

app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
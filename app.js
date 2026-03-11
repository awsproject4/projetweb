const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./database.db");

const app = express();
PORT = 3000;
app.get("/", (req, res) => {
    res.send("Serveur fonctionne");
});

app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});



// Création des tables
db.serialize(() => {

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      texte TEXT,
      date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
      x INTEGER,
      y INTEGER,
      auteur_id INTEGER,
      FOREIGN KEY (auteur_id) REFERENCES users(id)
    )
  `);

});
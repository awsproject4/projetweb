const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./database.db");

const app = express();
PORT = 3000;



// Création des tables
//La table messages contient une clé étrangère vers users pour relier chaque post-it à son auteur.
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

app.get("/", (req, res) => {
    res.send("Serveur fonctionne");
});

const path = require("path");

app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "views/signup.html"));
});

const bcrypt = require("bcrypt");
app.use(express.urlencoded({ extended: true }));

//Les mots de passe sont hachés avec bcrypt avant stockage pour éviter qu’ils soient enregistrés en clair.
app.post("/signup", async (req, res) => {

  const { username, password } = req.body;

  const hash = await bcrypt.hash(password, 10);

  db.run(
    "INSERT INTO users (username, password) VALUES (?, ?)",
    [username, hash],
    (err) => {
      if (err) return res.send("Utilisateur déjà existant");
      res.redirect("/");
    }
  );
});

app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});

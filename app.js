const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./database.db");
//J’utilise express-session pour gérer l’authentification côté serveur.
const session = require("express-session");
const app = express();
PORT = 3000;

app.use(
  session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: false,
  })
);


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
    //res.send("Serveur fonctionne");
    res.sendFile(path.join(__dirname, "views/index.html"));
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

app.post("/login", (req, res) => {
  //Récupérer les données du formulaire
  const { username, password } = req.body;
    //chercher l'utilisateur dans la base
  db.get(
    "SELECT * FROM users WHERE username = ?",
    [username],
    async (err, user) => {
       //si lutilisateur n'existe pas
      if (!user) return res.send("Utilisateur introuvable");

      const match = await bcrypt.compare(password, user.password);
      //verifier le mot de passe
      if (!match) return res.send("Mot de passe incorrect");
        //stocker l'utilisateur dans la session
      req.session.user = user;
        //Rediriger vers la page principale
      res.redirect("/");
    }
  );
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});

// =============================
// IMPORT DES MODULES
// =============================
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
//J’utilise express-session pour gérer l’authentification côté serveur.
const bcrypt = require("bcrypt");
const session = require("express-session");
const path = require("path");
// =============================
// INITIALISATION
// =============================
const app = express();
PORT = 3000;
const db = new sqlite3.Database("./database.db");
// =============================
// MIDDLEWARES
// =============================

// Permet de lire le JSON envoyé par AJAX
app.use(express.json());

// Permet de lire les formulaires HTML
app.use(express.urlencoded({ extended: true }));

// Permet de servir les fichiers CSS et JS
app.use(express.static("public"));
// Gestion des sessions (authentification)
app.use(
session({
secret: "secret-key",
resave: false,
saveUninitialized: false,
cookie: {
httpOnly: true,
sameSite: "strict"
}
})
);


// =============================
// CREATION DES TABLES SQL
// =============================
//La table messages contient une clé étrangère vers users pour relier chaque post-it à son auteur.
db.serialize(() => {
  // Table utilisateurs
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    )
  `);
    // Table messages (post-it)
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

// =============================
// ROUTES HTML
// =============================
// Page principale
app.get("/", (req, res) => {
    //res.send("Serveur fonctionne");
    res.sendFile(path.join(__dirname, "views/index.html"));
});

// Page inscription
app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "views/signup.html"));
});

// =============================
// AUTHENTIFICATION
// =============================

//Les mots de passe sont hachés avec bcrypt avant stockage pour éviter qu’ils soient enregistrés en clair.
// Inscription
app.post("/signup", async (req, res) => {

  const { username, password } = req.body;
  if(!username || !password){
  return res.send("Champs invalides");
  }

  if(username.length > 50 || password.length > 100){
    return res.send("Données trop longues");
}

  // Hachage du mot de passe
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


// Connexion
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
// Déconnexion
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// =============================
// ROUTES API (AJAX)
// =============================
// Ajouter un post-it
app.post("/ajouter", (req, res) => {

  //Vérifie que l'utilisateur est connecté
  if (!req.session.user)
    return res.status(401).json({ success: false });

  const { texte, x, y } = req.body;
  if(!texte || texte.length > 500){
  return res.json({success:false});
  }
  db.run(
    "INSERT INTO messages (texte, x, y, auteur_id) VALUES (?, ?, ?, ?)",
    [texte, x, y, req.session.user.id],
    function (err) {
      if (err) return res.json({ success: false });
      // Réponse pour AJAX
      res.json({ success: true });
    }
  );
});

// Supprimer un post-it
app.post("/effacer", (req, res) => {

  if (!req.session.user)
    return res.status(401).json({ success: false });

  const { id } = req.body;

  // Vérifie que le post-it appartient à l'utilisateur
  db.run(
    "DELETE FROM messages WHERE id = ? AND auteur_id = ?",
    [id, req.session.user.id],
    function () {
      res.json({ success: this.changes > 0 });
    }
  );
});

// Liste des post-it
app.get("/liste", (req, res) => {

  db.all(
    `SELECT messages.*, users.username
     FROM messages
     JOIN users ON messages.auteur_id = users.id
     ORDER BY date_creation DESC`,
    [],
    (err, rows) => {
      res.json({
        user: req.session.user || null,
        messages: rows
      });
    }
  );
});

// =============================
// Modules supplémentaires
// =============================
// =============================
// MODIFIER UN POST-IT
// =============================
app.post("/modifier", (req, res) => {

  // Vérifie que l'utilisateur est connecté (sécurité session)
  if (!req.session.user) {
    return res.status(401).json({ success: false });
  }

  // Récupération des données envoyées en AJAX
  const { id, texte } = req.body;

  // Validation des données (évite bugs + abus)
  if (!texte || texte.length > 500) {
    return res.json({ success: false });
  }

  // Requête SQL sécurisée :
  // - On met à jour le texte
  // - MAIS seulement si l'utilisateur est le propriétaire du post-it
  db.run(
    `UPDATE messages 
     SET texte = ? 
     WHERE id = ? AND auteur_id = ?`,
    [texte, id, req.session.user.id],
    function (err) {

      // En cas d'erreur SQL
      if (err) {
        return res.json({ success: false });
      }

      // this.changes = nombre de lignes modifiées
      // → 0 = refus (pas propriétaire)
      // → 1 = succès
      res.json({ success: this.changes > 0 });
    }
  );

});

// =============================
// LANCEMENT SERVEUR
// =============================
app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});

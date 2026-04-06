// =============================
// IMPORT DES MODULES
// =============================
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
//J’utilise express-session pour gérer l’authentification côté serveur.
const bcrypt = require("bcrypt");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const path = require("path");

// =============================
// INITIALISATION
// =============================
const app = express();
PORT = process.env.PORT || 3000;
const db = new sqlite3.Database("./database.db", (err) => {
  if (err) {
    console.error("Erreur DB :", err);
  } else {
    console.log("DB connectée");
  }
});

// =============================
// SOCKET.IO
// =============================
// On importe le module HTTP (non sécurisé)
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
//=====AVEC HTTPS
//const https = require("https");
//const fs = require("fs");

// certificat SSL
//const options = {
//  key: fs.readFileSync("key.pem"),
//  cert: fs.readFileSync("cert.pem")
//};

// serveur HTTPS
//const httpsServer = https.createServer(options, app);

// Socket.IO sur HTTPS
//const { Server } = require("socket.io");
//const io = new Server(httpsServer);

// connexion client
io.on("connection", (socket) => {
  console.log("Un utilisateur connecté");

  // rejoindre un tableau spécifique
  socket.on("joinBoard", (boardId) => {
    socket.join(boardId);
  });
});

// =============================
// MIDDLEWARES
// =============================

// Permet de lire le JSON envoyé par AJAX
app.use(express.json({ limit: "10kb" }));

//limitation des tentatives de connexion (rate limiting)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: "Trop de tentatives, réessaie plus tard"
});

// Permet de lire les formulaires HTML
app.use(express.urlencoded({ extended: true }));

// Permet de servir les fichiers CSS et JS
app.use(express.static("public"));
// Gestion des sessions (authentification)
app.set("trust proxy", 1);
app.use(
  session({
  secret: process.env.SESSION_SECRET || "dev-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: true
    }
  })
);

// =============================
// MIDDLEWARE AVANCE
// =============================

// Vérifie connexion
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ success: false });
  }
  next();
}

// Cette fonction permet de vérifier dynamiquement une permission
function requirePermission(permission) {
  return (req, res, next) => {

    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ success: false });
    }

    // admin → accès total
    if (user.role === "admin") return next();

    // sinon vérifier permission(Si la permission est absente → accès refusé)
    if (!user[permission]) {
      return res.status(403).json({ success: false });
    }

    next();
  };
}

// Vérifie que l'utilisateur est admin
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).send("Accès refusé");
  }
  next();
}

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
      password TEXT,
      role TEXT DEFAULT 'user',
      can_create INTEGER DEFAULT 1,
      can_edit INTEGER DEFAULT 1,
      can_delete INTEGER DEFAULT 1
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
      board_id TEXT DEFAULT 'default',
      FOREIGN KEY (auteur_id) REFERENCES users(id)
    )
  `);

});

// =============================
// ROUTES HTML
// =============================
// Page principale
//app.get("/", (req, res) => {
    //res.send("Serveur fonctionne");
    //res.sendFile(path.join(__dirname, "views/index.html"));
//});

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

  const { username, password, board } = req.body;

  if (!username || !password) {
    return res.send("Champs invalides");
  }

  if (username.length > 50 || password.length > 100) {
    return res.send("Données trop longues");
  }

  // hash mot de passe
  const hash = await bcrypt.hash(password, 10);

  // vérifier nombre d'utilisateurs
  db.get("SELECT COUNT(*) as count FROM users", [], (err, row) => {

    if (err) return res.send("Erreur serveur");

    // premier user = admin
    const role = row.count === 0 ? "admin" : "user";

    db.run(
      "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
      [username, hash, role],
      (err) => {
        if (err) return res.send("Utilisateur déjà existant");

        res.redirect("/" + (board || "default"));
      }
    );

  });

});

// Connexion
app.post("/login", loginLimiter, (req, res) => {
  //Récupérer les données du formulaire
  const { username, password, board } = req.body;
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
      res.redirect("/" + (board || "default"));
    }
  );
});
// Déconnexion
app.get("/logout", (req, res) => {
  const board = req.query.board;
  req.session.destroy(() => {
    res.redirect("/" + (board || "default"));
  });
});

// =============================
// ROUTES API (AJAX)
// =============================
// Ajouter un post-it
app.post("/ajouter",requireAuth,//Sécurité : empêche les utilisateurs non connectés d'agir
  requirePermission("can_create"),//Vérifie que l'utilisateur a le droit de creer
  (req, res) => {

  const { texte, x, y, board_id } = req.body;

  if (typeof x !== "number" || typeof y !== "number") {
    return res.json({ success: false });
  }
  

  if(!texte || texte.length > 500){
  return res.json({success:false});
  }
  db.run(
    "INSERT INTO messages (texte, x, y, auteur_id, board_id) VALUES (?, ?, ?, ?, ?)",
    [texte, x, y, req.session.user.id, board_id],
    function (err) {
      if (err) return res.json({ success: false });
      // MPORTANT : après insertion
      io.to(board_id).emit("updateBoard");
      // Réponse pour AJAX
      res.json({ success: true });
    }
  );
});

// Supprimer un post-it
app.post("/effacer", requireAuth,//Sécurité : empêche les utilisateurs non connectés d'agir
  requirePermission("can_delete"),//Vérifie que l'utilisateur a le droit de supprimer
  (req, res) => {
  const { id } = req.body;
  const user = req.session.user;
  // CAS ADMIN
  // Un administrateur peut supprimer n'importe quel post-it
  // 1. récupérer le board_id
  db.get("SELECT board_id FROM messages WHERE id = ?", [id], (err, row) => {
    if (!row) return res.json({ success: false });

    const board_id = row.board_id;
    if (user.role === "admin") {
      db.run("DELETE FROM messages WHERE id = ?", [id],function() {
        // après suppression
        io.to(board_id).emit("updateBoard");
        res.json({ success: true })}
      );
    } else {

    // Vérifie que le post-it appartient à l'utilisateur
      db.run(
        "DELETE FROM messages WHERE id = ? AND auteur_id = ?",
        [id, req.session.user.id],
        function () {
          // seulement si suppression réussie
          if (this.changes > 0) {
            io.to(board_id).emit("updateBoard");
          }
          res.json({ success: this.changes > 0 });
        }
      );
    }
  });
});

// Liste des post-it
app.get("/liste/:board", (req, res) => {
  const board = req.params.board;

  db.all(
    `SELECT messages.*, users.username
     FROM messages
     JOIN users ON messages.auteur_id = users.id
     WHERE board_id = ?
     ORDER BY date_creation DESC`,
    [board],
    (err, rows) => {
      if (err) {
        console.error("ERREUR SQL :", err); // IMPORTANT
        return res.status(500).json({ error: err.message });
      }
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
app.post("/modifier",requireAuth,//Sécurité : empêche les utilisateurs non connectés d'agir
  requirePermission("can_edit"),//Vérifie que l'utilisateur a le droit de modifier
  (req, res) => {

  

  // Récupération des données envoyées en AJAX
  const { id, texte } = req.body;
  const user = req.session.user;

  // Validation des données (évite bugs + abus)
  if (!texte || texte.length > 500) {
    return res.json({ success: false });
  }

  // Requête SQL sécurisée :
  // - On met à jour le texte
  // - MAIS seulement si l'utilisateur est le propriétaire du post-it et ADMIN : peut modifier tous les post-it
  // 1. récupérer le board_id
  db.get("SELECT board_id FROM messages WHERE id = ?", [id], (err, row) => {
    if (!row) return res.json({ success: false });

    const board_id = row.board_id;
    if (user.role === "admin") {
        db.run(
          "UPDATE messages SET texte = ? WHERE id = ?",
          [texte, id],
          function() {
            // prévenir les autres
            io.to(board_id).emit("updateBoard");
            res.json({ success: true })}
        );
    } else {
      // USER → seulement ses posts
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
        //seulement si modification réussie
        if (this.changes > 0) {
          io.to(board_id).emit("updateBoard");}

        // this.changes = nombre de lignes modifiées
        // → 0 = refus (pas propriétaire)
        // → 1 = succès
        res.json({ success: this.changes > 0 });}
      );  
    }
  });

});

// =============================
// PAGE ADMIN (PROTEGEE)
// =============================
app.get("/admin", requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "views/admin.html"));
});

// =============================
// LISTE UTILISATEURS (ADMIN)
// =============================
app.get("/admin/users", requireAdmin, (req, res) => {

  db.all("SELECT id, username, role, can_create, can_edit, can_delete FROM users", [], (err, rows) => {
    res.json(rows);
  });

});

// =============================
// MODIFICATION DES DROITS UTILISATEUR
// =============================
app.post("/admin/permission", requireAdmin, (req, res) => {

  const { id, perm, value } = req.body;

  // securité: On limite les permissions modifiables pour éviter une injection SQL
  const allowed = ["can_create", "can_edit", "can_delete"];

  if (!allowed.includes(perm)) {
    return res.json({ success: false });
  }

  // Mise à jour sécurisée
  db.run(
    `UPDATE users SET ${perm} = ? WHERE id = ?`,
    [value ? 1 : 0, id],
    () => res.json({ success: true })
  );

});

app.post("/admin/role", requireAdmin, (req, res) => {

  const { id, role } = req.body;

  if (!["user", "admin"].includes(role)) {
    return res.json({ success: false });
  }

  db.run(
    "UPDATE users SET role = ? WHERE id = ?",
    [role, id],
    () => res.json({ success: true })
  );

});

// =============================
// PAGE TABLEAU DYNAMIQUE
// =============================
app.get("/:board", (req, res) => {

  res.sendFile(path.join(__dirname, "views/index.html"));

});
app.get("/", (req, res) => {
  res.redirect("/default");
});
// =============================
// DEPLACER UN POST-IT
// =============================
app.post("/deplacer",
  requireAuth,
  requirePermission("can_edit"),
  (req, res) => {

    const { id, x, y } = req.body;

    if (typeof x !== "number" || typeof y !== "number") {
      return res.json({ success: false });
    }

    const user = req.session.user;

    // Validation simple
    if (x == null || y == null) {
      return res.json({ success: false });
    }

    // ADMIN  peut déplacer tous les post-it
    if (user.role === "admin") {

      db.run(
        "UPDATE messages SET x = ?, y = ? WHERE id = ?",
        [x, y, id],
        () => res.json({ success: true })
      );

    } else {

      // USER uniquement ses post-it
      db.run(
        `UPDATE messages 
         SET x = ?, y = ? 
         WHERE id = ? AND auteur_id = ?`,
        [x, y, id, user.id],
        function (err) {

          if (err) {
            return res.json({ success: false });
          }

          res.json({ success: this.changes > 0 });
        }
      );

    }

});

// =============================
// LANCEMENT SERVEUR
// =============================

server.listen(PORT, () => {
  console.log("Serveur lancé sur port " + PORT);
});


// ======================
// RECUPERATION ELEMENTS HTML
// ======================

// zone où les post-it seront affichés
const board = document.getElementById("board");

// zone login / logout
const authDiv = document.getElementById("auth");


// ======================
// CHARGER LES DONNEES
// ======================

async function loadData() {

  try {

    // appel AJAX vers le serveur
    const res = await fetch("/liste");
    const data = await res.json();

    // vide la zone des post-it avant réaffichage
    board.innerHTML = "";

    // ======================
    // LOGIN OU LOGOUT
    // ======================

    if (!data.user) {

      authDiv.innerHTML = `
        <form method="POST" action="/login">
          <p>Nom :
            <input name="username" placeholder="Username" required>
          </p>

          <p>Mot de passe :
            <input name="password" type="password" required>
          </p>

          <button>Login</button>
        </form>

        <a href="/signup">S'inscrire</a>
      `;

    } else {

      authDiv.innerHTML = `
        Bienvenue ${data.user.username}
        <a href="/logout">Logout</a>
      `;

    }

    // ======================
    // AFFICHAGE DES POST-IT
    // ======================

    data.messages.forEach(msg => {

      const div = document.createElement("div");
      div.className = "postit";

      // position du post-it
      div.style.left = msg.x + "px";
      div.style.top = msg.y + "px";

      // création du texte (évite XSS)
      const p = document.createElement("p");
      p.textContent = msg.texte;

      // auteur + date
      const info = document.createElement("small");
      info.textContent = msg.username + " - " + msg.date_creation;

      div.appendChild(p);
      div.appendChild(info);

      // ======================
      // BOUTON SUPPRIMER
      // ======================

      if (data.user && data.user.id === msg.auteur_id) {

        const btn = document.createElement("button");
        btn.textContent = "X";
        btn.className = "delete";

        btn.onclick = () => deletePost(msg.id);

        div.appendChild(btn);

      }

      board.appendChild(div);

    });

  } catch (err) {

    console.error("Erreur chargement données :", err);

  }

}


// ======================
// DOUBLE CLIC CREATION
// ======================

board.addEventListener("dblclick", async (e) => {

  const texte = prompt("Texte du post-it");

  if (!texte || texte.trim() === "") return;

  try {

    const res = await fetch("/ajouter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        texte,
        x: e.pageX,
        y: e.pageY
      })
    });

    const data = await res.json();

    // si utilisateur non connecté
    if (!data.success) {
      alert("Vous devez être connecté pour créer un post-it");
      return;
    }

    loadData();

  } catch (err) {

    console.error("Erreur création post-it :", err);

  }

});


// ======================
// SUPPRESSION POST-IT
// ======================

async function deletePost(id) {

  if (!confirm("Supprimer ce post-it ?")) return;

  try {

    await fetch("/effacer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });

    loadData();

  } catch (err) {

    console.error("Erreur suppression :", err);

  }

}


// ======================
// CHARGEMENT INITIAL
// ======================

loadData();
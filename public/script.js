window.addEventListener("DOMContentLoaded", () => {
  // ======================
  // RECUPERATION ELEMENTS HTML
  // ======================

  // ======================
  // IDENTIFIANT DU TABLEAU
  // ======================

  // récupère le nom du tableau dans l'URL
  const boardId = window.location.pathname.substring(1) || "default";

  // affiche le nom du tableau
  document.getElementById("boardTitle").textContent = "Tableau : " + boardId;

  // zone où les post-it seront affichés
  const board = document.getElementById("board");

  // zone login / logout
  const authDiv = document.getElementById("auth");

  //csurf = protège contre les actions faites "à mon insu"
  let csrfToken = "";
  let currentUser = null;
  // ======================
  // CHARGER LES DONNEES
  // ======================

  async function loadData() {

    try {

      // appel AJAX vers le serveur
      const res = await fetch("/liste/" + boardId);
      const data = await res.json();
      csrfToken = data.csrfToken;
      currentUser = data.user;

      // vide la zone des post-it avant réaffichage
      board.innerHTML = "";

      // ======================
      // LOGIN OU LOGOUT
      // ======================

      if (currentUser.role === "guest") {

        authDiv.innerHTML = `
          <form method="POST" action="/login">
            <input type="hidden" name="board" value="${boardId}">
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
          <a href="/logout?board=${boardId}">Logout</a>
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

        if (currentUser.role !== "guest" && (currentUser.id === msg.auteur_id ||currentUser.role === "admin")) {

          const btn = document.createElement("button");
          btn.textContent = "X";
          btn.className = "delete";

          btn.onclick = () => deletePost(msg.id);

          div.appendChild(btn);

        }

        // ======================
        // BOUTON MODIFIER POST-IT
        // ======================
        if (currentUser.role !== "guest" && (currentUser.id === msg.auteur_id ||currentUser.role === "admin")) {

          const editBtn = document.createElement("button");
          editBtn.textContent = "✏️";
          editBtn.className = "edit";

          editBtn.onclick = async () => {

            // Demande à l'utilisateur le nouveau texte
            const nouveauTexte = prompt("Modifier le post-it :", msg.texte);

            // Vérifie que le texte n'est pas vide
            if (!nouveauTexte || nouveauTexte.trim() === "") return;

            // Envoi de la requête AJAX au serveur
            await fetch("/modifier", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "CSRF-Token": csrfToken
              },
              body: JSON.stringify({
                id: msg.id,
                texte: nouveauTexte
              })
            });

            // Recharge les post-it pour afficher la modification
            loadData();
          };

          div.appendChild(editBtn);
        }

        board.appendChild(div);

        // ======================
        // DRAG & DROP
        // ======================

        let isDragging = false;

        div.addEventListener("mousedown", (e) => {
          // pas connecté interdit
          if (currentUser.role === "guest") return;

          //  pas propriétaire ET pas admin  interdit
          if (currentUser.id !== msg.auteur_id && currentUser.role !== "admin") return;


          // Empêche le drag si on clique sur bouton (delete/edit)
          if (e.target.tagName === "BUTTON") return;

          isDragging = true;

          // Décalage pour garder la souris au bon endroit sur le post-it
          const offsetX = e.clientX - div.offsetLeft;
          const offsetY = e.clientY - div.offsetTop;

          // Met le post-it au premier plan
          div.style.zIndex = Date.now();

          function onMouseMove(e) {
            if (!isDragging) return;

            // Nouvelle position
            div.style.left = (e.pageX - offsetX) + "px";
            div.style.top = (e.pageY - offsetY) + "px";
          }

          async function onMouseUp() {
            isDragging = false;

            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);

            // ======================
            // SAUVEGARDE POSITION
            // ======================

            await fetch("/deplacer", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "CSRF-Token": csrfToken
              },
              body: JSON.stringify({
                id: msg.id,
                x: parseInt(div.style.left),
                y: parseInt(div.style.top)
              })
            });

          }

          document.addEventListener("mousemove", onMouseMove);
          document.addEventListener("mouseup", onMouseUp);

        });
        // ======================
        // DRAG MOBILE (TOUCH)
        // ======================

        div.addEventListener("touchstart", (e) => {
           //  pas connecté → interdit
          if (currentUser.role === "guest") return;

            // pas propriétaire ET pas admin → interdit
          if (currentUser.id !== msg.auteur_id && currentUser.role !== "admin") return;

          const touch = e.touches[0];

          let offsetX = touch.clientX - div.offsetLeft;
          let offsetY = touch.clientY - div.offsetTop;

          div.style.zIndex = Date.now();

          function onTouchMove(e) {
            const touch = e.touches[0];

            div.style.left = (touch.pageX - offsetX) + "px";
            div.style.top = (touch.pageY - offsetY) + "px";
          }

          async function onTouchEnd() {

            document.removeEventListener("touchmove", onTouchMove);
            document.removeEventListener("touchend", onTouchEnd);

            // sauvegarde position
            await fetch("/deplacer", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "CSRF-Token": csrfToken
              },
              body: JSON.stringify({
                id: msg.id,
                x: parseInt(div.style.left),
                y: parseInt(div.style.top)
              })
            });

          }

          document.addEventListener("touchmove", onTouchMove);
          document.addEventListener("touchend", onTouchEnd);

        });

      });

    } catch (err) {

      console.error("Erreur chargement données :", err);

    }

  }


  // ======================
  // DOUBLE CLIC CREATION
  // ======================

  board.addEventListener("dblclick", async (e) => {
    if (!currentUser || currentUser.role === "guest") {
      alert("Vous devez être connecté pour créer un post-it");
      return;
    }

    const texte = prompt("Texte du post-it");

    if (!texte || texte.trim() === "") return;

    try {

      const res = await fetch("/ajouter", {
        method: "POST",
        headers: { "Content-Type": "application/json", "CSRF-Token": csrfToken },
        body: JSON.stringify({
          texte,
          x: parseInt(e.pageX),
          y: parseInt(e.pageY),
          board_id: boardId
        })
      });

      const data = await res.json();

      // si utilisateur non connecté
      if (!data.success) {
        alert("Action refusée");
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
        headers: { "Content-Type": "application/json", "CSRF-Token": csrfToken },
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

  // ======================
  // SOCKET.IO (TEMPS RÉEL)
  // ======================

  // connexion au serveur
  const socket = io();

  // rejoindre le bon tableau
  socket.emit("joinBoard", boardId);

  // écouter les mises à jour
  socket.on("updateBoard", () => {
   loadData(); // recharge automatiquement
  });

});
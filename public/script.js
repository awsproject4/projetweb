const board = document.getElementById("board");
const authDiv = document.getElementById("auth");

// Charger les données
async function loadData() {

  const res = await fetch("/liste");
  const data = await res.json();

  board.innerHTML = "";

  // Affichage login/logout
  if (!data.user) {
    authDiv.innerHTML = `
      <form method="POST" action="/login">
      <p>Nom:
            <input name="username" placeholder="Username" required>
        </p>
        <p>Mot de passe
            <input name="password" type="password" placeholder="Password" required>
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

  // Affichage post-it
  data.messages.forEach(msg => {

    const div = document.createElement("div");
    div.className = "postit";
    div.style.left = msg.x + "px";
    div.style.top = msg.y + "px";

    div.innerHTML = `
      <p>${msg.texte}</p>
      <small>${msg.username} - ${msg.date_creation}</small>
    `;

    // Bouton suppression si auteur
    if (data.user && data.user.id === msg.auteur_id) {
      const btn = document.createElement("button");
      btn.textContent = "X";
      btn.className = "delete";
      btn.onclick = () => deletePost(msg.id);
      div.appendChild(btn);
    }

    board.appendChild(div);
  });
}

// Double clic pour créer
board.addEventListener("dblclick", async (e) => {

  const texte = prompt("Texte du post-it");
  if (!texte) return;

  await fetch("/ajouter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      texte,
      x: e.pageX,
      y: e.pageY
    })
  });

  loadData();
});

// Supprimer
async function deletePost(id) {

  if (!confirm("Supprimer ?")) return;

  await fetch("/effacer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  });

  loadData();
}

loadData();
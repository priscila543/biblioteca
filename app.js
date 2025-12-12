const express = require("express");
const path = require("path");
const session = require("express-session");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const db = new sqlite3.Database(path.join(__dirname, "database", "biblioteca.db"));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: "biblioteca-secreta",
  resave: false,
  saveUninitialized: false
}));

// Middleware de autenticação
function auth(req, res, next) {
  if (!req.session.user) return res.redirect("/");
  next();
}

app.get("/", (req, res) => {
  const erro = req.session.erro;
  req.session.erro = null;
  res.render("login", { erro });
});

app.post("/login", (req, res) => {
  const { usuario, senha } = req.body;

  if (usuario === "administrador@gmail.com" && senha === "1") {
    req.session.user = {
      id: 0,
      nome: "Super Administrador",
      email: usuario,
      tipo: "admin"
    };
    return res.redirect("/livros");
  }

  db.get(
    "SELECT * FROM usuarios WHERE email = ? AND senha = ?",
    [usuario, senha],
    (err, row) => {
      if (!row) {
        req.session.erro = "E-mail ou senha incorretos!";
        return res.redirect("/");
      }

      row.tipo = "usuario";
      req.session.user = row;
      res.redirect("/inicio");
    }
  );
});

app.get("/cadastro", (req, res) => {
  const erro = req.session.erro;
  req.session.erro = null;
  res.render("cadastro", { erro });
});

app.post("/cadastro", (req, res) => {
  const { nome, email, senha } = req.body;

  db.run(
    "INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)",
    [nome, email, senha],
    err => {
      if (err) {
        req.session.erro = "Erro ao cadastrar.";
        return res.redirect("/cadastro");
      }

      req.session.erro = "Usuário cadastrado!";
      res.redirect("/");
    }
  );
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

app.get("/inicio", auth, (req, res) => {
  db.all("SELECT * FROM livros ORDER BY id DESC LIMIT 8", (err, rows) => {
    res.render("index", { usuario: req.session.user, ultimos: rows });
  });
});

app.get("/buscar", auth, (req, res) => {
  const termo = (req.query.q || "").trim();
  if (!termo) return res.redirect("/inicio");

  const q = "%" + termo + "%";

  db.all(
    "SELECT * FROM livros WHERE nome LIKE ? OR autor LIKE ? OR categoria LIKE ?",
    [q, q, q],
    (err, rows) => {
      res.render("categoria", {
        livros: rows,
        categoria: "Resultado da Busca"
      });
    }
  );
});

app.get("/livros", auth, (req, res) => {
  if (req.session.user.tipo !== "admin") return res.send("Acesso negado.");

  db.all("SELECT * FROM livros ORDER BY id DESC", (err, rows) => {
    res.render("livros", { livros: rows });
  });
});

app.post("/livros", auth, (req, res) => {
  const { nome, autor, capa, categoria } = req.body;

  db.run(
    "INSERT INTO livros (nome, autor, capa, categoria) VALUES (?, ?, ?, ?)",
    [nome, autor, capa, categoria],
    () => res.redirect("/livros")
  );
});

app.get("/livros/:id", auth, (req, res) => {
  db.get("SELECT * FROM livros WHERE id = ?", [req.params.id], (err, row) => {
    res.render("detalhe", { livro: row });
  });
});

app.get("/livros/editar/:id", auth, (req, res) => {
  if (req.session.user.tipo !== "admin") return res.send("Acesso negado.");

  db.get("SELECT * FROM livros WHERE id = ?", [req.params.id], (err, row) => {
    if (!row) return res.send("Livro não encontrado.");
    res.render("editar", { livro: row });
  });
});

app.post("/livros/editar/:id", auth, (req, res) => {
  if (req.session.user.tipo !== "admin") return res.send("Acesso negado.");

  const { nome, autor, capa, categoria } = req.body;

  db.run(
    `UPDATE livros SET nome=?, autor=?, capa=?, categoria=? WHERE id=?`,
    [nome, autor, capa, categoria, req.params.id],
    () => res.redirect("/livros")
  );
});

app.get("/livros/excluir/:id", auth, (req, res) => {
  if (req.session.user.tipo !== "admin") return res.send("Acesso negado.");

  db.run("DELETE FROM livros WHERE id = ?", [req.params.id], () => {
    res.redirect("/livros");
  });
});

app.get("/romance", auth, (req, res) => {
  db.all("SELECT * FROM livros WHERE categoria = 'romance'", (err, rows) => {
    res.render("categoria", { livros: rows, categoria: "Romance" });
  });
});

app.get("/ficcao", auth, (req, res) => {
  db.all("SELECT * FROM livros WHERE categoria = 'ficcao'", (err, rows) => {
    res.render("categoria", { livros: rows, categoria: "Ficção Científica" });
  });
});

app.get("/infantil", auth, (req, res) => {
  db.all("SELECT * FROM livros WHERE categoria = 'infantil'", (err, rows) => {
    res.render("categoria", { livros: rows, categoria: "Infantil" });
  });
});

app.post("/alugar/:id", auth, (req, res) => {
  const id = req.params.id;
  const dias = parseInt(req.body.dias);

  if (!dias || dias <= 0) return res.send("Dias inválidos.");

  db.get("SELECT alugado FROM livros WHERE id = ?", [id], (err, row) => {
    if (row.alugado === 1) {
      return res.send("Este livro já está alugado por outro usuário.");
    }

    const data = new Date();
    data.setDate(data.getDate() + dias);
    const devolucao = data.toLocaleDateString("pt-BR");

    db.run(
      `UPDATE livros 
       SET alugado = 1, usuarioAlugou = ?, dataDevolucao = ?
       WHERE id = ? AND alugado = 0`,
      [req.session.user.nome, devolucao, id],
      function (err) {
        if (err) return res.send("Erro ao alugar.");

        if (this.changes === 0) {
          return res.send("Este livro já está alugado.");
        }

        res.redirect("/livros/" + id);
      }
    );
  });
});

app.post("/devolver/:id", auth, (req, res) => {
  const id = req.params.id;

  db.run(
    `UPDATE livros 
     SET alugado = 0, usuarioAlugou = null, dataDevolucao = null
     WHERE id = ?`,
    [id],
    () => res.redirect("/alugados")
  );
});

app.get("/alugados", auth, (req, res) => {
  db.all(
    "SELECT * FROM livros WHERE alugado = 1 AND usuarioAlugou = ?",
    [req.session.user.nome],
    (err, rows) => {
      res.render("alugados", { livros: rows });
    }
  );
});

app.get("/admin/usuarios", auth, (req, res) => {
  if (req.session.user.tipo !== "admin") return res.send("Acesso negado.");

  const sql = `
    SELECT u.id AS usuarioId, u.nome AS usuarioNome, u.email,
           l.nome AS livroNome, l.autor, l.dataDevolucao
    FROM usuarios u
    LEFT JOIN livros l ON l.usuarioAlugou = u.nome
    ORDER BY u.id ASC
  `;

  db.all(sql, [], (err, rows) => {
    res.render("usuariosAdmin", { dados: rows });
  });
});

app.listen(3000, () => console.log("Servidor rodando na porta 3000"));

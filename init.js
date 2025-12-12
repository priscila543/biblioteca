const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const db = new sqlite3.Database(path.join(__dirname, "database", "biblioteca.db"));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS livros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      autor TEXT NOT NULL,
      capa TEXT,
      categoria TEXT,
      alugado INTEGER DEFAULT 0,
      usuarioAlugou TEXT,
      dataDevolucao TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT,
      email TEXT UNIQUE,
      senha TEXT
    )
  `);

  db.run(
    `INSERT OR IGNORE INTO usuarios (nome, email, senha)
     VALUES ('priscila','priscilamirandahol@gmail.com','123')`
  );

  db.run(
    `INSERT OR IGNORE INTO usuarios (nome, email, senha)
     VALUES ('raquel','aleatoriofofis6@gmail.com','0909')`
  );

  console.log("Banco inicializado corretamente!");
});

db.close(err => {
  if (err) console.error("Erro ao fechar banco:", err);
  else console.log("Banco fechado com sucesso!");
});

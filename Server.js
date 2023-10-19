// Constante pour les modules
const mysql = require('mysql2');
const express = require("express");
const httpServer = require("http");
const SHA512 = require("crypto-js/sha512");


// préparation Express
const app = express();
const server = httpServer.Server(app);

// Initialisation de la connexion à la base de donnée MySQL
const connection = mysql.createConnection({
  host: 'localhost', // L'hôte de votre base de données MySQL
  user: 'root', // Le nom d'utilisateur MySQL
  password: '21467ETok!', // Le mot de passe MySQL
  database: 'duelpunch', // Le nom de la base de données
});

// Connexion à la base de donnée
connection.connect((err) => {
  if (err) {
   console.error('Erreur de connexion à la base de données : ' + err.stack);
   return;
 }
 console.log('Connecté à la base de données MySQL');
});

// Partie obligatoire pour récupérer des données via des ejs
app.set("view engine", "ejs"); 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Envoie la page "connexion.ejs" quand l'utilisateur se connecte sur la page d'entrée
app.get("/", function (req, res) {
  res.render(__dirname + "/views/connexion.ejs", {Erreur: "0"}); // pour envoyer une page ejs on utilise "res.render", pour la transcrire en html à la fin
});

// Envoie la feuille de style au client, elle est utilisée sur toutes les pages du site
app.get("/style.css", function (req, res) {
  res.sendFile(__dirname + "/style.css");
}); 

function generateSHA512Hash(data) {
  const hash = SHA512(data);
  return hash.toString();
}

/* 
Partie pour Se connecter en tant que joueur sur le site

*/
app.post("/login", async (req, res) => {
  let pseudo = req.body.pseudo;
  let password = req.body.motdepasse;

  const passwordHash = generateSHA512Hash(password); // genere le hash du mdp

  let check = [];
  MdpResult = false;

  await checkLogin(pseudo, passwordHash).then((rows) => check = rows);
  
  if (check.length > 0) {
    if (check[0].CompteVerifJoueur === 1) {
      res.render("Principal", {data: pseudo})
    } else {
      res.render("VerifInscription", {number: check[0].TokenJoueur, Erreur: 1})
    }
  } else {
    res.render("Connexion", {Erreur: 1})
  }

});

function checkLogin(pseudo, password) {
  return new Promise((resolve, reject) => {
    const sql = "SELECT PseudoJoueur, TokenJoueur, CompteVerifJoueur FROM joueur WHERE PseudoJoueur = ? AND MotDePasseJoueur = ?;";
      connection.query(sql, [pseudo, password], (err, rows, fields) => {
        if (err) {
          resolve(null);
        } else {
          resolve(rows)
        }
      })
  })
}

/* 
Partie inscription
*/

app.post("/inscription", async (req, res) => {
  res.render("Inscrire", {Erreur: "0"});
});

app.post("/inscrire", async (req, res) => {
  
  let pass = true; // permet d'évaluer si les informations donner sont sous un bon format
  let check = []; // va regarder si l'email est déjà utilisé dans la bdd
  
  let email = req.body.email; // récupère l'email 
  if (email.length > 80) { //test si l'email est plus grand que 80
    pass = false;
    res.render("Inscrire", {Erreur: "1"}); // on renvoie sur la page avec l'erreur rencontrée
  }
  let pseudo = req.body.pseudo; // récupère le pseudo
  if (pseudo.length > 20) { // test s'il est plus grand que 20
    pass = false;
    res.render("Inscrire", {Erreur: "2"}); // on renvoie sur la page avec l'erreur rencontrée
  }
  let motDePasse = req.body.motdepasse; // recupère le mdp
  if (motDePasse.length < 8) { // test s'il est plus petit que 8
    pass = false;
    res.render("Inscrire", {Erreur: "3"}); // on renvoie sur la page avec l'erreur rencontrée
  }

  await checkDoublon(pseudo, email).then((rows) => check = rows); // On va chercher si l'email est déjà utilisé
  
  if (check.length > 0) { // si on récupère quelque chose c'est que l'email est déjà utilisé
    pass = false;
    res.render("Inscrire", {Erreur: "4"}); // on renvoie sur la page avec l'erreur rencontrée
  }

  if (pass === true) { // si on passe tout les tests
    const motDePasseHash = generateSHA512Hash(motDePasse); // genere le hash du mdp

    const randomNumber = Math.floor(Math.random() * (999999 - 0 + 1)); // genere un code
    const formattedNumber = randomNumber.toString().padStart(6, '0'); // et le formate pour avoir bien 6 chiffres
    
    await envoieInscription(pseudo, motDePasseHash, email, formattedNumber); // envoie la requete à la bdd avec le mdp hashé mais le compte non verifié
    // la requete prends le code pour à la fois le mettre dans la bdd en tant que joueur et sur le site 

    res.render("VerifInscription", {number: formattedNumber, Erreur: 0}); // On envoie sur la page verif le numéro à retaper par l'utilisateur
  }
});

function checkDoublon(pseudo, email) {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM joueur WHERE PseudoJoueur = ? OR EmailJoueur = ?;"; // Requete pour voir si l'email est déjà utilisé
      connection.query(sql, [pseudo, email], (err, rows, fields) => {
        if (err) {
          resolve(null);
        } else {
          resolve(rows)
        }
      })
  })
}

function envoieInscription(pseudo, motDePasseHash, email, token) { // Requete pour inscrire le joueur dans la bdd
  return new Promise((resolve, reject) => {
    const sql = "INSERT INTO joueur (PseudoJoueur, MotDePasseJoueur, EmailJoueur, NiveauJoueur, ExperienceJoueur, RankJoueur, CompteVerifJoueur, TokenJoueur, ChangeMdpJoueur) VALUES (?, ?, ?, 1, 0, 0, false, ?, false);";
      connection.query(sql, [pseudo, motDePasseHash, email, token], (err, rows, fields) => {
        if (err) {
          resolve(null);
        } else {
          resolve(rows)
        }
      })
  })
}

/*
Verification compte joueur
*/ 
app.post("/verification", async (req, res) => {

  let code = req.body.code; // code donné par l'utilisateur sur la page VerifInscription
  let check = []; // stock le résultat de la requete

  await checkCode(code).then((rows) => check = rows); // check si le code donné est bon

  if (check.length > 0) {
    
    await modifVerifJoueur(check[0].TokenJoueur); // modifie le statut du joueur en joueur vérifié.
    
    res.render("Connexion", {Erreur: 0});
  }

});

function checkCode(code) {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM joueur WHERE TokenJoueur = ?;";
      connection.query(sql, [code], (err, rows, fields) => {
        if (err) {
          resolve(null);
        } else {
          resolve(rows)
        }
      })
  })
}

function modifVerifJoueur(code) {
  return new Promise((resolve, reject) => {
    const sql = "UPDATE joueur SET TokenJoueur = 0, CompteVerifJoueur = 1 WHERE TokenJoueur = ?;";
    connection.query(sql, [code], (err, rows, fields) => {
      if (err) {
        resolve(null);
      } else {
        resolve(rows);
      }
    });
  });
}


// INSERT INTO joueur (PseudoJoueur, MotDePasseJoueur, EmailJoueur, NiveauJoueur, ExperienceJoueur, RankJoueur, CompteVerifJoueur, TokenJoueur, ChangeMdpJoueur) VALUES ('Soulsy', '83aba1b56130b5040cbe1417ad1b64cfc5a85355a7060a3ea493d8c825130ba859d4654339f4678cdb39415f53c1069d7c35ee30f073d511b7f87557f28f015a', 'druarttanguypro@gmail.com', 1, 0, 0, false, 0, false);




//allumage du serveur
server.listen(8080);
console.log("ecoute");

const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { setGlobalOptions } = require("firebase-functions/v2");
setGlobalOptions({ maxInstances: 10 });
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const express = require("express");

const cors = require("cors");

const app = express();

//PUT YOUR OWN SECRET KEY HERE
const SECRET_KEY =""

app.use(cors({ origin: true }));
app.use((req, res, next) => {
  // Set the allowed origin here, or use a wildcard '*' to allow any origin (not recommended for production)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Set the Access-Control-Expose-Headers header to include Authorization
  res.setHeader('Access-Control-Expose-Headers', 'Authorization');

  // Call the next middleware
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Middleware
const checkToken = (req, res, next) => {
  try {
    console.log(req.headers, req.headers.authorization);
    if (req && req.headers.authorization) {
      jwt.verify(req.headers.authorization.split(" ")[1], SECRET_KEY);
      return next();
    } else {
      throw new Error("Unauthorized,Please Sign in First");
    }
  } catch (err) {
    return res.status(403).json(err.message);
  }
};

app.get("/", (req, res) => {
  return res.status(200).json("Hello Firebase");
});

app.get("/api/categories", async (req, res) => {
  try {
    const query = db.collection("categories");

    const data = await query.get();

    const docs = data.docs;

    const response = docs.map((doc) => {
      return {
        category_name: doc.data().category_name,
        category_id: doc.data().category_id,
        image_path: doc.data().image_path
      };
    });

    return res.status(200).json(response);
  } catch (error) {
    return res.status(400).json(error.message);
  }
});

app.get("/api/words", checkToken, async (req, res) => {
  try {
    const { categoryId } = req.query;

    const wordsRef = db.collection("words");
    const data = await wordsRef.where("category_id", "==", categoryId).get();
    const docs = data.docs;

    const response = docs.map((doc) => {
      return {
        word: doc.data().word,
        audio_path: doc.data().audio_path,
        image_path: doc.data().image_path,
        category_id: doc.data().category_id,
      };
    });
    res.status(200).json(response);
  } catch (error) {
    return res.status(400).json(error.message);
  }
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const userRef = db.collection("users");
    const data = await userRef.where("email", "==", email).get();

    if (!data.empty) {
      return res.status(404).json("User Already Exists, Please Sign in");
    }

    // TODO: hash the password first before storing it in the database.
    await db.collection("users").doc().create({
      email,
      user_name: username,
      password,
    });

    const payload = {
      username,
      email,
    };
    const token = jwt.sign(payload, SECRET_KEY, {
      expiresIn: "14 days",
    });
    /*res.cookie("token",token,{
        maxAge:
    })*/
    res.setHeader("Authorization", "Bearer " + token);

    return res.status(200).json("User Succesfully Created");
  } catch (error) {
    res.status(500).json(error.message);
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(email, password);
    const userRef = db.collection("users");

    const data = await userRef
      .where("email", "==", email)
      .where("password", "==", password)
      .get();

    if (data.empty) {
      return res.status(404).json("User Not Found");
    }

    const docs = data.docs;
    const response = docs.map((doc) => {
      return {
        name: doc.data().user_name,
        password: doc.data().password,
        email: doc.data().email,
      };
    });

    const payload = {
      username: response[0].name,
      email,
    };

    const token = jwt.sign(payload, SECRET_KEY, {
      expiresIn: "14 days",
    });

    res.setHeader("Authorization", "Bearer " + token);

    return res.status(200).json("You Logged In Succesfully");
  } catch (error) {
    return res.status(500).json(error.message);
  }
});

app.get("/users", async (req, res) => {
  const query = db.collection("users");

  const data = await query.get();

  const docs = data.docs;

  const response = docs.map((doc) => {
    return {
      name: doc.data().user_name,
      password: doc.data().password,
      email: doc.data().email,
    };
  });
  
  res.status(200).json(response);
});

app.get("/api/me", (req, res) => {
  try {
    if (!req.headers.authorization) {
      return res
        .status(404)
        .json("You need to have a JWT token first to access this page");
    }
    const token = req.headers.authorization.split(" ")[1];
    console.log("token: " + token);
    console.log("req header auth : " + req.headers.authorization);

    const verifiedToken = jwt.verify(token, SECRET_KEY);
    res.status(200).json(verifiedToken);
  } catch (error) {
    res.status(500).json(error.message);
  }
});

app.get("/api/logout", checkToken, (req, res) => {
  req.headers.authorization = "";
  res.end();
});

exports.app = onRequest(app);

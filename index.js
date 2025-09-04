const express = require("express");
const admin = require("firebase-admin");
require("dotenv").config();

const app = express();
app.use(express.json());

// Firebase Admin
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

// นำ router เข้ามา
const songRouter = require("./routes/songs");

// **สำคัญ**: ต้องใช้ prefix /songs
app.use("/songs", songRouter);


// รัน server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

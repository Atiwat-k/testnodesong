// firebaseConfig.js
import admin from "firebase-admin";

// แปลง JSON จาก Environment Variable (string → object)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export const db = admin.firestore();

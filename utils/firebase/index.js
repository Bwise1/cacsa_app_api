const admin = require("firebase-admin");
const myConfig = require("../../config");
const serviceAccount = require("../../firebase.json");

/** Default GCS bucket for Firebase Storage (required for admin.storage().bucket()). */
const defaultStorageBucket =
  process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
  `${serviceAccount.project_id}.appspot.com`;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL:
    process.env.FIREBASE_DATABASE_URL ||
    myConfig.firebaseConfig?.databaseURL ||
    undefined,
  storageBucket: defaultStorageBucket,
});

const db = admin.firestore();
const subscriptionsCollection = db.collection("subscriptions");

module.exports = {
  admin,
  db,
  subscriptionsCollection,
};

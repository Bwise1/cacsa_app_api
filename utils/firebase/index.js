const admin = require("firebase-admin");
const myConfig = require("../../config");
const serviceAccount = require("../../firebase.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: myConfig.databaseURL,
});

const db = admin.firestore();
const subscriptionsCollection = db.collection("subscriptions");

module.exports = {
  db,
  subscriptionsCollection,
};

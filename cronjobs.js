if (require.main === module) {
  const cron = require("node-cron");
  const { subscriptionsCollection } = require("./utils/firebase/index");
  const SubscriptionModel = require("./models/SubscriptionModel");

  async function expireSubscriptions() {
    try {
      const rows = await SubscriptionModel.getExpiredSubscriptions();
      console.log("Rows:", rows);

      if (rows.length === 0) {
        console.log("No expired subscriptions");
        return;
      }

      await SubscriptionModel.updateExpiredSubscriptions();

      for (const row of rows) {
        const docRef = subscriptionsCollection.doc(row.uid);
        try {
          await docRef.delete();
        } catch (error) {
          console.error(`Error deleting document with uid ${row.uid}:`, error);
        }
      }

      console.log(
        "Subscriptions updated to expired and removed from Firestore"
      );
    } catch (error) {
      console.error(
        "Error updating subscriptions to expired and removing them from Firestore",
        error
      );
    }
  }

  async function deleteActiveSubscriptions() {
    try {
      const rows = await SubscriptionModel.getAllActiveSubscriptions();
      console.log("Rows:", rows);

      if (rows.length === 0) {
        console.log("No expired subscriptions");
        return;
      }

      for (const row of rows) {
        const docRef = subscriptionsCollection.doc(row.uid);
        try {
          await docRef.delete();
        } catch (error) {
          console.error(`Error deleting document with uid ${row.uid}:`, error);
        }
      }

      console.log(
        "Subscriptions updated to expired and removed from Firestore"
      );
    } catch (error) {
      console.error(
        "Error updating subscriptions to expired and removing them from Firestore",
        error
      );
    }
  }

  // Execute both tasks sequentially when called
  (async () => {
    await expireSubscriptions();
  })();
}

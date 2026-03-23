if (require.main === module) {
  const { subscriptionsCollection } = require("./utils/firebase/index");
  const SubscriptionModel = require("./models/SubscriptionModel");
  const FamilyModel = require("./models/FamilyModel");
  const db = require("./db/db");
  const {
    syncSubscriptionToFirestore,
  } = require("./services/subscriptionFirestoreSyncService");

  async function expireSubscriptions() {
    try {
      const rows = await SubscriptionModel.getExpiredSubscriptionRows();
      console.log("Expired subscription rows:", rows);

      if (rows.length === 0) {
        console.log("No expired subscriptions");
        return;
      }

      const uidsToSync = new Set();

      for (const row of rows) {
        const fam = await FamilyModel.getFamilyBySubscriptionId(row.id);
        if (fam) {
          await db.query(
            `UPDATE family_groups SET status = 'inactive' WHERE id = ?`,
            [fam.id]
          );
          const memberUids = await FamilyModel.getFamilyMemberUids(fam.id);
          for (const u of [...memberUids, fam.owner_uid]) {
            uidsToSync.add(u);
          }
        } else {
          uidsToSync.add(row.uid);
        }
      }

      await SubscriptionModel.updateExpiredSubscriptions();

      for (const uid of uidsToSync) {
        try {
          await syncSubscriptionToFirestore(uid);
        } catch (error) {
          console.error(`expireSubscriptions sync ${uid}:`, error);
        }
      }

      console.log("Subscriptions updated to expired; Firestore synced");
    } catch (error) {
      console.error(
        "Error updating subscriptions to expired and syncing Firestore",
        error
      );
    }
  }

  /** Destructive: removes Firestore subscription docs for users still active in MySQL (maintenance). */
  async function deleteActiveSubscriptions() {
    try {
      const rows = await SubscriptionModel.getAllActiveSubscriptions();
      console.log("Rows", rows);

      if (rows.length === 0) {
        console.log("No active subscriptions");
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

      console.log("Active subscription Firestore docs deleted");
    } catch (error) {
      console.error(
        "Error deleting active subscription documents from Firestore",
        error
      );
    }
  }

  (async () => {
    await expireSubscriptions();
  })();
}

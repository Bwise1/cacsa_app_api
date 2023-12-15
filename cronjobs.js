const cron = require("node-cron");
const { subscriptionsCollection } = require("./utils/firebase/index");
const SubscriptionModel = require("./models/SubscriptionModel");

async function expireSubscriptions() {
  try {
    // Get the uids of the subscriptions that are set to 'expired'
    const rows = await SubscriptionModel.getExpiredSubscriptions();

    // Update the status of these subscriptions to 'expired'
    await SubscriptionModel.updateExpiredSubscriptions();

    // Delete the corresponding documents from Firestore
    for (const row of rows) {
      const docRef = subscriptionsCollection.doc(row.uid);
      await docRef.delete();
    }

    console.log("Subscriptions updated to expired and removed from Firestore");
  } catch (error) {
    console.error(
      "Error updating subscriptions to expired and removing them from Firestore",
      error
    );
  }
}

// Schedule the function to run every day at 00:00
cron.schedule("* * * * *", expireSubscriptions);

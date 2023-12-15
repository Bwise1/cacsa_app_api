class StateService {
  constructor(admin) {
    this.admin = admin;
  }

  // async getAllUsers() {
  //   try {
  //     const users = await admin.auth().listUsers();
  //     //   console.log(users);
  //     return users;
  //     //   return users.map((user) => ({
  //     //     uid: user.uid,
  //     //     email: user.email,
  //     //     // Add other user properties you want to include
  //     //   }));
  //   } catch (error) {
  //     console.error("Error fetching users", error);
  //     throw new Error("Error fetching users");
  //   }
  // }

  //   // Add more functions as needed for your application
  //   async updateSubscriptionStatus() {
  //     console.log("here");
  //     const db = admin.firestore();
  //     const subscriptionsCollection = db.collection("subscriptions");

  //     try {
  //       // Retrieve all documents from the 'subscriptions' collection
  //       const subscriptionsSnapshot = await subscriptionsCollection.get();

  //       // Loop through each document and update the 'status' field
  //       subscriptionsSnapshot.forEach(async (doc) => {
  //         const subscriptionId = doc.id;

  //         // Update the 'status' field to 'active'
  //         await subscriptionsCollection.doc(subscriptionId).update({
  //           status: "active",
  //         });

  //         console.log(`Subscription ${subscriptionId} updated successfully`);
  //       });

  //       console.log("All subscriptions updated successfully");
  //     } catch (error) {
  //       console.error("Error updating subscriptions:", error);
  //     }
  //   }
}

module.exports = StateService;

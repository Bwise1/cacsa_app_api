const UserModel = require("../models/UserModel");
const AudioModel = require("../models/AudioModel");
const { subscriptionsCollection } = require("../utils/firebase/index");
const appUsersAdminService = require("./appUsersAdminService");
const {
  getActiveUserMetricsCached,
  isGa4Configured,
} = require("./analyticsGa4Service");

const userModel = new UserModel();
const audioModel = new AudioModel();

/**
 * Active Firestore subscription docs (app gate). Matches chargeActivationService / cron.
 * Only documents where `status` is exactly the string "active" (lowercase).
 */
async function countActiveFirestoreSubscriptions() {
  const q = subscriptionsCollection.where("status", "==", "active");
  const snapshot = await q.count().get();
  return Number(snapshot.data().count ?? 0);
}

/** All documents in `subscriptions` (any fields). Use to reconcile with Console “collection size”. */
async function countAllSubscriptionDocuments() {
  const snapshot = await subscriptionsCollection.count().get();
  return Number(snapshot.data().count ?? 0);
}

async function getOverviewMetrics() {
  const [
    adminUserCount,
    activeSubscribers,
    subscriptionDocumentsTotal,
    totalAudioTracks,
    firebaseReg,
    ga4,
  ] = await Promise.all([
    userModel.countAdminUsers(),
    countActiveFirestoreSubscriptions(),
    countAllSubscriptionDocuments().catch(() => null),
    audioModel.getTotalAudioCount(),
    appUsersAdminService.countRegisteredUsersApprox().catch(() => ({
      registeredUsers: 0,
      registeredUsersApproximate: false,
    })),
    getActiveUserMetricsCached().catch(() => ({
      activeUsersMonth: null,
      activeUsersToday: null,
      activeUsersLast30Min: null,
      ga4Error: "unavailable",
    })),
  ]);

  return {
    adminUserCount,
    activeSubscribers,
    subscriptionDocumentsTotal,
    totalAudioTracks,
    firebaseRegisteredUsers: firebaseReg.registeredUsers,
    firebaseRegisteredApproximate: firebaseReg.registeredUsersApproximate,
    ga4Configured: isGa4Configured(),
    activeUsersMonth: ga4.activeUsersMonth,
    activeUsersToday: ga4.activeUsersToday,
    activeUsersLast30Min: ga4.activeUsersLast30Min,
    ga4Error: ga4.ga4Error,
  };
}

module.exports = {
  getOverviewMetrics,
  countActiveFirestoreSubscriptions,
  countAllSubscriptionDocuments,
};

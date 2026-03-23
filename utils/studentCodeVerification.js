const { db } = require("../utils/firebase/index");

/**
 * Validates student code against Firestore students_code/{planCode} (same semantics as Flutter isStudent).
 */
async function verifyStudentCode(planCode, enteredCode) {
  if (!planCode || enteredCode == null || String(enteredCode).trim() === "") {
    return false;
  }
  try {
    const snap = await db.collection("students_code").doc(planCode).get();
    if (!snap.exists) return false;
    const stored = snap.data()?.code;
    return stored != null && String(stored) === String(enteredCode).trim();
  } catch (e) {
    console.error("verifyStudentCode:", e);
    return false;
  }
}

module.exports = { verifyStudentCode };

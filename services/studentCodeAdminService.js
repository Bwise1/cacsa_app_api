const admin = require("firebase-admin");
const { db } = require("../utils/firebase/index");

const STUDENT_VERIFICATION_KINDS = new Set([
  "individual_student",
  "family_student",
]);

function isStudentVerificationKind(planKind) {
  return STUDENT_VERIFICATION_KINDS.has(String(planKind || "").trim());
}

/**
 * True if Firestore doc exists and has a non-empty `code` field.
 */
async function isConfigured(planCode) {
  if (!planCode || String(planCode).trim() === "") return false;
  try {
    const snap = await db.collection("students_code").doc(String(planCode).trim()).get();
    if (!snap.exists) return false;
    const c = snap.data()?.code;
    return c != null && String(c).trim() !== "";
  } catch (e) {
    console.error("studentCodeAdminService.isConfigured:", e);
    throw e;
  }
}

/**
 * @param {string[]} planCodes
 * @returns {Promise<Record<string, boolean>>}
 */
async function batchConfigured(planCodes) {
  const unique = [...new Set((planCodes || []).map((c) => String(c || "").trim()).filter(Boolean))];
  const out = {};
  await Promise.all(
    unique.map(async (pc) => {
      out[pc] = await isConfigured(pc);
    })
  );
  return out;
}

async function upsertCode(planCode, code) {
  const pc = String(planCode || "").trim();
  const trimmed = String(code || "").trim();
  if (!pc) throw new Error("plan_code is required");
  if (!trimmed) throw new Error("code is required");
  await db.collection("students_code").doc(pc).set(
    {
      code: trimmed,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function deleteCode(planCode) {
  const pc = String(planCode || "").trim();
  if (!pc) throw new Error("plan_code is required");
  await db.collection("students_code").doc(pc).delete();
}

/**
 * @returns {Promise<string|null>} Trimmed code or null if missing / empty.
 */
async function getCode(planCode) {
  const pc = String(planCode || "").trim();
  if (!pc) return null;
  try {
    const snap = await db.collection("students_code").doc(pc).get();
    if (!snap.exists) return null;
    const c = snap.data()?.code;
    if (c == null) return null;
    const s = String(c).trim();
    return s === "" ? null : s;
  } catch (e) {
    console.error("studentCodeAdminService.getCode:", e);
    throw e;
  }
}

module.exports = {
  STUDENT_VERIFICATION_KINDS,
  isStudentVerificationKind,
  isConfigured,
  batchConfigured,
  getCode,
  upsertCode,
  deleteCode,
};

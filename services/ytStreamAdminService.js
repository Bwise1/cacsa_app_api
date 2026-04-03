const { db } = require("../utils/firebase");

/**
 * List all docs in `yt_stream` (YouTube / Facebook live links for the app).
 * Flutter reads each doc by id and uses field `link`.
 */
async function listYtStreams() {
  const snap = await db.collection("yt_stream").get();
  const channels = [];
  snap.forEach((doc) => {
    const d = doc.data() || {};
    channels.push({
      id: doc.id,
      link: typeof d.link === "string" ? d.link : "",
      name: typeof d.name === "string" ? d.name : "",
      section: d.section === "other" ? "other" : "primary",
    });
  });
  channels.sort((a, b) => {
    const ka = (a.name || a.id).toLowerCase();
    const kb = (b.name || b.id).toLowerCase();
    return ka.localeCompare(kb);
  });
  return channels;
}

/**
 * @param {string} docId
 * @param {{ link?: string, name?: string, section?: 'primary'|'other' }} fields
 */
async function updateYtStream(docId, fields) {
  const id = String(docId || "").trim();
  if (!id) throw new Error("doc id is required");

  const payload = {};
  if (fields.link !== undefined) {
    payload.link = String(fields.link).trim();
  }
  if (fields.name !== undefined) {
    payload.name = String(fields.name).trim();
  }
  if (fields.section !== undefined) {
    const s = String(fields.section).trim();
    if (s === "primary" || s === "other") payload.section = s;
  }

  if (Object.keys(payload).length === 0) {
    throw new Error("Nothing to update");
  }

  await db.collection("yt_stream").doc(id).set(payload, { merge: true });
}

module.exports = {
  listYtStreams,
  updateYtStream,
};

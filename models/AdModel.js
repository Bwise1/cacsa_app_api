const db = require("../db/db");
const { randomUUID } = require("crypto");

function mapRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    public_id: r.public_id,
    brand_name: r.brand_name,
    contact: r.contact,
    state: r.state,
    asset_url: r.asset_url,
    link_url: r.link_url,
    ad_type: r.ad_type,
    slot: r.slot,
    sort_order: r.sort_order,
    is_active: Boolean(r.is_active),
    starts_at: r.starts_at,
    ends_at: r.ends_at,
    impression_count: Number(r.impression_count ?? 0),
    click_count: Number(r.click_count ?? 0),
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

class AdModel {
  async create(row) {
    const publicId = row.public_id || randomUUID();
    const [result] = await db.query(
      `INSERT INTO ads (
        public_id, brand_name, contact, state, asset_url, link_url, ad_type,
        slot, sort_order, is_active, starts_at, ends_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        publicId,
        row.brand_name ?? null,
        row.contact ?? null,
        row.state ?? null,
        row.asset_url,
        row.link_url ?? null,
        row.ad_type || "image_banner",
        row.slot ?? null,
        row.sort_order != null ? Number(row.sort_order) : 0,
        row.is_active === false ? 0 : 1,
        row.starts_at ?? null,
        row.ends_at ?? null,
      ]
    );
    return { insertId: result.insertId, publicId };
  }

  async getById(id) {
    const [rows] = await db.query("SELECT * FROM ads WHERE id = ? LIMIT 1", [
      id,
    ]);
    return mapRow(rows[0]);
  }

  async getByPublicId(publicId) {
    const [rows] = await db.query(
      "SELECT * FROM ads WHERE public_id = ? LIMIT 1",
      [publicId]
    );
    return mapRow(rows[0]);
  }

  /**
   * Active ads for the mobile app: is_active, within optional date window.
   * @param {{ state?: string }} opts If state is set, include rows where ads.state IS NULL OR '' OR matches.
   */
  async listActiveForApp(opts = {}) {
    const state = opts.state != null ? String(opts.state).trim() : "";
    let sql = `
      SELECT id, public_id, brand_name, contact, state, asset_url, link_url, ad_type,
             slot, sort_order, starts_at, ends_at
      FROM ads
      WHERE is_active = 1
        AND (starts_at IS NULL OR starts_at <= CURDATE())
        AND (ends_at IS NULL OR ends_at >= CURDATE())
    `;
    const params = [];
    if (state) {
      sql += ` AND (state IS NULL OR TRIM(state) = '' OR state = ?)`;
      params.push(state);
    }
    sql += ` ORDER BY sort_order ASC, id ASC`;
    const [rows] = await db.query(sql, params);
    return rows.map((r) => ({
      public_id: r.public_id,
      brand_name: r.brand_name,
      contact: r.contact,
      state: r.state,
      asset_url: r.asset_url,
      link_url: r.link_url,
      ad_type: r.ad_type,
      slot: r.slot,
      sort_order: r.sort_order,
      starts_at: r.starts_at,
      ends_at: r.ends_at,
    }));
  }

  async listAllForAdmin() {
    const [rows] = await db.query(
      `SELECT id, public_id, brand_name, contact, state, asset_url, link_url, ad_type,
              slot, sort_order, is_active, starts_at, ends_at,
              impression_count, click_count, created_at, updated_at
       FROM ads ORDER BY sort_order ASC, id DESC`
    );
    return rows.map(mapRow);
  }

  async update(id, fields) {
    const allowed = [
      "brand_name",
      "contact",
      "state",
      "asset_url",
      "link_url",
      "ad_type",
      "slot",
      "sort_order",
      "is_active",
      "starts_at",
      "ends_at",
    ];
    const sets = [];
    const vals = [];
    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(fields, k)) {
        let v = fields[k];
        if (k === "is_active") v = v ? 1 : 0;
        if (k === "sort_order") v = Number(v);
        sets.push(`${k} = ?`);
        vals.push(v);
      }
    }
    if (sets.length === 0) return false;
    vals.push(id);
    const [r] = await db.query(`UPDATE ads SET ${sets.join(", ")} WHERE id = ?`, vals);
    return r.affectedRows > 0;
  }

  async delete(id) {
    const [r] = await db.query("DELETE FROM ads WHERE id = ?", [id]);
    return r.affectedRows > 0;
  }

  async insertEngagementEvent({
    adId,
    eventType,
    firebaseUid,
    sessionId,
  }) {
    await db.query(
      `INSERT INTO ad_engagement_events (ad_id, event_type, firebase_uid, session_id)
       VALUES (?, ?, ?, ?)`,
      [adId, eventType, firebaseUid, sessionId]
    );
  }

  /**
   * @returns {Promise<boolean>} true if an impression already exists today for this ad/session/user.
   */
  async hasImpressionToday(adId, firebaseUid, sessionId) {
    const [rows] = await db.query(
      `SELECT 1 FROM ad_engagement_events
       WHERE ad_id = ? AND firebase_uid = ? AND session_id = ? AND event_type = 'impression'
         AND DATE(created_at) = CURDATE()
       LIMIT 1`,
      [adId, firebaseUid, sessionId]
    );
    return rows.length > 0;
  }

  /**
   * @returns {Promise<boolean>} true if a click already recorded for this ad+session.
   */
  async hasClickForSession(adId, sessionId) {
    const [rows] = await db.query(
      `SELECT 1 FROM ad_engagement_events
       WHERE ad_id = ? AND session_id = ? AND event_type = 'click'
       LIMIT 1`,
      [adId, sessionId]
    );
    return rows.length > 0;
  }

  async incrementCounts(adId, { impression = 0, click = 0 }) {
    if (impression <= 0 && click <= 0) return;
    await db.query(
      `UPDATE ads SET
        impression_count = impression_count + ?,
        click_count = click_count + ?
       WHERE id = ?`,
      [impression, click, adId]
    );
  }

  /**
   * Daily series for one ad.
   * @param {{ days?: number }} opts days=0 means all time
   */
  async getStatsByAdId(adId, opts = {}) {
    const days = opts.days;
    const allTime = days === undefined || days === null || Number(days) === 0;
    const d = allTime ? 0 : Math.max(1, Math.min(366 * 5, Number(days)));

    const rangeSql = allTime
      ? ""
      : "AND created_at >= CONCAT(DATE_SUB(CURDATE(), INTERVAL ? DAY), ' 00:00:00')";
    const rangeParam = allTime ? [] : [d - 1];

    const [byDay] = await db.query(
      `SELECT DATE_FORMAT(DATE(created_at), '%Y-%m-%d') AS date,
              SUM(CASE WHEN event_type = 'impression' THEN 1 ELSE 0 END) AS impressions,
              SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) AS clicks
       FROM ad_engagement_events
       WHERE ad_id = ?
       ${rangeSql}
       GROUP BY DATE_FORMAT(DATE(created_at), '%Y-%m-%d')
       ORDER BY date ASC`,
      [adId, ...rangeParam]
    );

    const [totRows] = await db.query(
      `SELECT
        SUM(CASE WHEN event_type = 'impression' THEN 1 ELSE 0 END) AS impressions,
        SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) AS clicks
       FROM ad_engagement_events WHERE ad_id = ? ${rangeSql}`,
      [adId, ...rangeParam]
    );

    return {
      adId,
      days: allTime ? 0 : d,
      allTime,
      totalImpressions: Number(totRows[0]?.impressions ?? 0),
      totalClicks: Number(totRows[0]?.clicks ?? 0),
      byDay: byDay.map((r) => ({
        date: String(r.date),
        impressions: Number(r.impressions ?? 0),
        clicks: Number(r.clicks ?? 0),
      })),
    };
  }
}

module.exports = AdModel;

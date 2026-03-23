const db = require("../db/db");

const MAX_SEGMENT_SECONDS = 43200;

function assertAudioExists(rows) {
  if (!rows.length) {
    const err = new Error("Audio not found");
    err.code = "NOT_FOUND";
    throw err;
  }
}

class AudioPlayModel {
  async _ensureAudio(audioId) {
    const [rows] = await db.query("SELECT id FROM audio_files WHERE id = ? LIMIT 1", [
      audioId,
    ]);
    assertAudioExists(rows);
  }

  /**
   * @param {{ audioId: number, firebaseUid: string, sessionId: string }} p
   */
  async insertPlayStart({ audioId, firebaseUid, sessionId }) {
    await this._ensureAudio(audioId);
    await db.query(
      `INSERT INTO audio_listen_events (audio_id, firebase_uid, session_id, event_type, listen_seconds, ended_at)
       VALUES (?, ?, ?, 'play_start', 0, UTC_TIMESTAMP(3))`,
      [audioId, firebaseUid, sessionId]
    );
  }

  /**
   * @param {{ audioId: number, firebaseUid: string, sessionId: string, seconds: number }} p
   */
  async insertListenSegment({ audioId, firebaseUid, sessionId, seconds }) {
    const s = Math.max(0, Math.min(Math.floor(Number(seconds) || 0), MAX_SEGMENT_SECONDS));
    if (s === 0) return;
    await this._ensureAudio(audioId);
    await db.query(
      `INSERT INTO audio_listen_events (audio_id, firebase_uid, session_id, event_type, listen_seconds, ended_at)
       VALUES (?, ?, ?, 'listen_segment', ?, UTC_TIMESTAMP(3))`,
      [audioId, firebaseUid, sessionId, s]
    );
  }

  /**
   * @param {{ days?: number }} opts days=0 or undefined means all time; else last N calendar days including today.
   */
  async getStats(opts = {}) {
    const days = opts.days;
    const allTime = days === undefined || days === null || Number(days) === 0;
    const d = allTime ? 0 : Math.max(1, Math.min(366 * 5, Number(days)));

    const rangeFilter = allTime
      ? ""
      : "WHERE ended_at >= CONCAT(DATE_SUB(CURDATE(), INTERVAL ? DAY), ' 00:00:00')";
    const rangeParams = allTime ? [] : [d - 1];

    const [totalPlayRows] = await db.query(
      `SELECT COUNT(*) AS c FROM audio_listen_events
       ${allTime ? "WHERE event_type = 'play_start'" : `${rangeFilter} AND event_type = 'play_start'`}`,
      rangeParams
    );
    const totalPlays = Number(totalPlayRows[0]?.c ?? 0);

    const [totalListenRows] = await db.query(
      `SELECT COALESCE(SUM(listen_seconds), 0) AS total FROM audio_listen_events
       ${allTime ? "WHERE event_type = 'listen_segment'" : `${rangeFilter} AND event_type = 'listen_segment'`}`,
      rangeParams
    );
    const totalListenSeconds = Number(totalListenRows[0]?.total ?? 0);

    const [byDay] = await db.query(
      `SELECT DATE_FORMAT(DATE(ended_at), '%Y-%m-%d') AS date,
              SUM(CASE WHEN event_type = 'play_start' THEN 1 ELSE 0 END) AS plays,
              SUM(CASE WHEN event_type = 'listen_segment' THEN listen_seconds ELSE 0 END) AS listen_seconds
       FROM audio_listen_events
       ${rangeFilter}
       GROUP BY DATE_FORMAT(DATE(ended_at), '%Y-%m-%d')
       ORDER BY date ASC`,
      rangeParams
    );

    const trackRange = allTime
      ? ""
      : "WHERE e.ended_at >= CONCAT(DATE_SUB(CURDATE(), INTERVAL ? DAY), ' 00:00:00')";

    const [byTrack] = await db.query(
      `SELECT e.audio_id, af.title, af.artist,
              SUM(CASE WHEN e.event_type = 'play_start' THEN 1 ELSE 0 END) AS plays,
              SUM(CASE WHEN e.event_type = 'listen_segment' THEN e.listen_seconds ELSE 0 END) AS listen_seconds
       FROM audio_listen_events e
       INNER JOIN audio_files af ON af.id = e.audio_id
       ${trackRange}
       GROUP BY e.audio_id, af.title, af.artist
       HAVING SUM(CASE WHEN e.event_type = 'play_start' THEN 1 ELSE 0 END) > 0
           OR SUM(CASE WHEN e.event_type = 'listen_segment' THEN e.listen_seconds ELSE 0 END) > 0
       ORDER BY plays DESC, listen_seconds DESC`,
      rangeParams
    );

    return {
      totalPlays,
      totalListenSeconds,
      days: allTime ? 0 : d,
      allTime,
      byDay: byDay.map((r) => ({
        date: String(r.date),
        plays: Number(r.plays),
        listen_seconds: Number(r.listen_seconds ?? 0),
      })),
      byTrack: byTrack.map((r) => ({
        audio_id: r.audio_id,
        title: r.title,
        artist: r.artist,
        plays: Number(r.plays),
        listen_seconds: Number(r.listen_seconds ?? 0),
      })),
    };
  }
}

module.exports = AudioPlayModel;

const db = require("../db/db");

class AudioModel {
  constructor() {
    // You can add any initialization or configuration here
  }

  async storeAudio(
    title,
    description,
    artist,
    date,
    category_id,
    audio_url,
    thumbnail_url,
    duration
  ) {
    try {
      const insertQuery = `
        INSERT INTO audio_files (title, description, artist, date, category_id, audio_url, thumbnail_url,duration)
        VALUES (?, ?, ?, ?, ?, ?, ?,?)
      `;
      const result = await db.query(insertQuery, [
        title,
        description,
        artist,
        date,
        category_id,
        audio_url,
        thumbnail_url,
        duration,
      ]);

      console.log("Audio info stored:", result);
      return result.insertId;
    } catch (error) {
      console.log("Error storing audio info:", error);
      throw error;
    }
  }

  async getAllAudio() {
    try {
      const query = "SELECT * FROM audio_files";
      const [rows] = await db.query(query);
      return rows;
    } catch (error) {
      console.error("Error fetching all audio:", error);
      throw error;
    }
  }

  async getAudioById(audioId) {
    try {
      const query = "SELECT * FROM audio_files WHERE id = ?";
      const [rows] = await db.query(query, [audioId]);

      if (rows.length === 0) {
        throw new Error("Audio not found");
      }

      return rows[0];
    } catch (error) {
      console.error("Error fetching audio by ID:", error);
      throw error;
    }
  }

  async getTotalAudioCount() {
    try {
      const query = "SELECT COUNT(*) AS total FROM audio_files";
      const [result] = await db.query(query);
      return result[0].total;
    } catch (error) {
      console.error("Error fetching total audio count:", error);
      throw error;
    }
  }

  async getAudioCountByCategory() {
    try {
      const query = `
        SELECT category_id, COUNT(*) AS count
        FROM audio_files
        GROUP BY category_id
      `;
      const [rows] = await db.query(query);
      return rows;
    } catch (error) {
      console.error("Error fetching audio count by category:", error);
      throw error;
    }
  }
}

module.exports = AudioModel;

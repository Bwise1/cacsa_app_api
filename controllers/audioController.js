const db = require("../db/db"); // Update the path and import the database connection

exports.storeAudio = async (req, res) => {
  try {
    const {
      title,
      description,
      artist,
      date,
      category_id,
      audio_url,
      thumbnail_url,
    } = req.body;

    // Check for empty fields
    if (!title || !date || !category_id || !audio_url) {
      return res
        .status(400)
        .send({ status: "error", message: "Missing required fields." });
    }

    // Insert the audio URL into the database
    const insertQuery = `
      INSERT INTO audio_files (title, description, artist, date, category_id, audio_url, thumbnail_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await db.query(insertQuery, [
      title,
      description,
      artist,
      date,
      category_id,
      audio_url,
      thumbnail_url,
    ]);

    console.log("Audio info stored:", result);
    res.status(201).send({ status: "success", audioId: result.insertId });
  } catch (error) {
    console.log("Error storing audio info:", error);
    res.status(500).send({ status: "error" });
  }
};

exports.getAllAudio = async (req, res) => {
  try {
    const query = "SELECT * FROM audio_files";
    const [rows] = await db.query(query);

    // console.log("Fetched all audio:", rows);
    res.status(200).send({ status: "success", audios: rows });
  } catch (error) {
    console.log("Error fetching all audio:", error);
    res.status(500).send({ status: "error" });
  }
};

exports.getAudioById = async (req, res) => {
  const audioId = req.params.id;

  try {
    const query = "SELECT * FROM audio_files WHERE id = ?";
    const [rows] = await db.query(query, [audioId]);

    if (rows.length === 0) {
      return res
        .status(404)
        .send({ status: "error", message: "Audio not found." });
    }

    // console.log("Fetched audio by ID:", rows[0]);
    res.status(200).send({ status: "success", audio: rows[0] });
  } catch (error) {
    console.log("Error fetching audio by ID:", error);
    res.status(500).send({ status: "error" });
  }
};

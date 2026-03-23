const express = require("express");
const router = express.Router();
const AudioService = require("../services/AudioService");
const AudioModel = require("../models/AudioModel");
const AudioPlayModel = require("../models/AudioPlayModel");
const { firebaseAuthMiddleware } = require("../middlewares/firebaseAuthMiddleware");
const { upload } = require("../utils/aws");
const {
  getAudioDurationFromUrl,
  formatDuration,
} = require("../utils/audioProbe");
const { normalizeDateForMysql } = require("../utils/mysqlDate");
require("dotenv").config();

const audioModelInstance = new AudioModel();
const audioPlayModel = new AudioPlayModel();
const audioService = new AudioService(
  process.env.S3_BUCKET_BUCKET_NAME,
  audioModelInstance
);

function isUuidSessionId(s) {
  return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

router.post("/", async (req, res) => {
  try {
    const {
      title,
      description,
      artist,
      date,
      category_id,
      audio_url,
      thumbnail_url,
      duration,
    } = req.body;

    // Check for empty fields
    if (!title || !date || !category_id || !audio_url) {
      return res
        .status(400)
        .send({ status: "error", message: "Missing required fields." });
    }

    const normalizedDate = normalizeDateForMysql(date);
    if (!normalizedDate) {
      return res.status(400).send({
        status: "error",
        message: "Invalid date. Use YYYY-MM-DD or a valid date string.",
      });
    }

    let resolvedDuration = null;
    try {
      const seconds = await getAudioDurationFromUrl(audio_url);
      if (seconds != null && Number.isFinite(seconds) && seconds > 0) {
        resolvedDuration = formatDuration(seconds);
      }
    } catch (e) {
      console.warn("Auto duration failed:", e.message || e);
    }

    if (!resolvedDuration) {
      const manual =
        duration != null && String(duration).trim() !== ""
          ? String(duration).trim()
          : null;
      if (manual) {
        resolvedDuration = manual;
      } else {
        return res.status(400).send({
          status: "error",
          message:
            "Could not detect audio duration from the file. Enter duration (HH:MM:SS) or check the URL.",
        });
      }
    }

    const audioId = await audioService.storeAudioInfo(
      title,
      description,
      artist,
      normalizedDate,
      category_id,
      audio_url,
      thumbnail_url,
      resolvedDuration
    );

    res.status(201).send({ status: "success", audioId });
  } catch (error) {
    console.log("Error storing audio info:", error);
    res.status(500).send({ status: "error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const audios = await audioService.getAllAudio();
    res.status(200).send({ status: "success", audios });
  } catch (error) {
    console.error("Error fetching all audio:", error);
    res.status(500).send({ status: "error" });
  }
});

router.get("/stats/all", async (req, res) => {
  try {
    const { totalAudioCount, audioCountByCategory, totalPlayStarts } =
      await audioService.getAggregate(audioPlayModel);
    res.send({
      status: "success",
      data: {
        total: totalAudioCount,
        stats: audioCountByCategory,
        totalStreams: totalPlayStarts,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ status: "error" });
  }
});

/** Firebase auth required. Body: { "session_id": "<uuid>" } */
router.post("/play/:id", firebaseAuthMiddleware, async (req, res) => {
  const audioId = Number(req.params.id);
  if (!Number.isFinite(audioId) || audioId <= 0) {
    return res.status(400).json({ status: "error", message: "Invalid audio id" });
  }
  const sessionId = req.body?.session_id;
  if (!isUuidSessionId(sessionId)) {
    return res.status(400).json({
      status: "error",
      message: "session_id must be a UUID string",
    });
  }
  const firebaseUid = req.firebaseUser.uid;
  try {
    await audioPlayModel.insertPlayStart({
      audioId,
      firebaseUid,
      sessionId,
    });
    return res.status(204).send();
  } catch (error) {
    if (error.code === "NOT_FOUND") {
      return res.status(404).json({ status: "error", message: error.message });
    }
    console.error("insertPlayStart:", error);
    return res.status(500).json({ status: "error", message: "Could not record play" });
  }
});

/** Firebase auth required. Body: { "seconds": number, "session_id": "<uuid>" } */
router.post("/listen/:id", firebaseAuthMiddleware, async (req, res) => {
  const audioId = Number(req.params.id);
  if (!Number.isFinite(audioId) || audioId <= 0) {
    return res.status(400).json({ status: "error", message: "Invalid audio id" });
  }
  const sessionId = req.body?.session_id;
  if (!isUuidSessionId(sessionId)) {
    return res.status(400).json({
      status: "error",
      message: "session_id must be a UUID string",
    });
  }
  const seconds = Number(req.body?.seconds);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return res.status(400).json({ status: "error", message: "seconds must be a positive number" });
  }
  const firebaseUid = req.firebaseUser.uid;
  try {
    await audioPlayModel.insertListenSegment({
      audioId,
      firebaseUid,
      sessionId,
      seconds,
    });
    return res.status(204).send();
  } catch (error) {
    if (error.code === "NOT_FOUND") {
      return res.status(404).json({ status: "error", message: error.message });
    }
    console.error("insertListenSegment:", error);
    return res.status(500).json({ status: "error", message: "Could not record listen time" });
  }
});

router.get("/:id", async (req, res) => {
  const audioId = req.params.id;

  try {
    const audio = await audioService.getAudioById(audioId);
    res.status(200).send({ status: "success", audio });
  } catch (error) {
    console.error("Error fetching audio by ID:", error);
    res.status(500).send({ status: "error" });
  }
});

router.put("/:id", async (req, res) => {
  const audioId = Number(req.params.id);
  if (!Number.isFinite(audioId) || audioId <= 0) {
    return res.status(400).json({ status: "error", message: "Invalid audio id" });
  }
  const {
    title,
    description,
    artist,
    date,
    category_id,
    audio_url,
    thumbnail_url,
    duration,
  } = req.body;

  if (!title || !date || !category_id || !audio_url) {
    return res.status(400).send({ status: "error", message: "Missing required fields." });
  }

  const normalizedDate = normalizeDateForMysql(date);
  if (!normalizedDate) {
    return res.status(400).send({
      status: "error",
      message: "Invalid date. Use YYYY-MM-DD or a valid date string.",
    });
  }

  try {
    await audioService.updateAudio(audioId, {
      title,
      description,
      artist,
      date: normalizedDate,
      category_id,
      audio_url,
      thumbnail_url,
      duration,
    });
    return res.status(200).json({ status: "success" });
  } catch (error) {
    if (error.message === "Audio not found") {
      return res.status(404).json({ status: "error", message: error.message });
    }
    if (error.code === "DURATION_REQUIRED") {
      return res.status(400).json({ status: "error", message: error.message });
    }
    console.error("updateAudio:", error);
    return res.status(500).json({ status: "error", message: "Could not update audio" });
  }
});

router.delete("/:id", async (req, res) => {
  const audioId = Number(req.params.id);
  if (!Number.isFinite(audioId) || audioId <= 0) {
    return res.status(400).json({ status: "error", message: "Invalid audio id" });
  }
  try {
    const deleted = await audioService.deleteAudio(audioId);
    if (!deleted) {
      return res.status(404).json({ status: "error", message: "Audio not found" });
    }
    return res.status(200).json({ status: "success" });
  } catch (error) {
    console.error("deleteAudio:", error);
    return res.status(500).json({ status: "error", message: "Could not delete audio" });
  }
});

router.post("/upload", upload.single("audiofile"), async (req, res) => {
  try {
    const filename = req.file.originalname;
    const file = req.file.buffer;
    const contentType = req.file.mimetype;

    const link = await audioService.uploadAudio(filename, file, contentType);
    let duration = null;
    try {
      const seconds = await getAudioDurationFromUrl(link);
      if (seconds != null && Number.isFinite(seconds) && seconds > 0) {
        duration = formatDuration(seconds);
      }
    } catch (e) {
      console.warn("Duration probe after upload:", e.message || e);
    }
    console.log({ status: "success", link, duration });
    res.send({ status: "success", link, duration });
  } catch (error) {
    console.log("Error uploading file:", error);
    res.status(500).send({ status: "error" });
  }
});

router.post("/thumb/upload", upload.single("thumbfile"), async (req, res) => {
  try {
    const thumbFilename = req.file.originalname;
    const thumbFile = req.file.buffer;
    const thumbContentType = req.file.mimetype;

    const thumbLink = await audioService.uploadThumbnail(
      thumbFilename,
      thumbFile,
      thumbContentType
    );
    console.log({ status: "success", thumbLink });
    res.send({ status: "success", thumbLink });
  } catch (error) {
    console.log("Error uploading thumb:", error);
    res.status(500).send({ status: "error" });
  }
});

module.exports = router;

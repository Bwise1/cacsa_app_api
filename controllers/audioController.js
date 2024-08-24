const express = require("express");
const router = express.Router();
const AudioService = require("../services/AudioService");
const AudioModel = require("../models/AudioModel");
const { upload } = require("../utils/aws");
const {
  getAudioDurationFromUrl,
  formatDuration,
} = require("../utils/audioProbe");
require("dotenv").config();

const audioModelInstance = new AudioModel();
const audioService = new AudioService(
  process.env.S3_BUCKET_BUCKET_NAME,
  audioModelInstance
);

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
    // const durationS = await getAudioDurationFromUrl(audio_url);
    // const duration = formatDuration(durationS);
    // console.log(duration);
    const audioId = await audioService.storeAudioInfo(
      title,
      description,
      artist,
      date,
      category_id,
      audio_url,
      thumbnail_url,
      duration
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

router.post("/upload", upload.single("audiofile"), async (req, res) => {
  try {
    const filename = req.file.originalname;
    const file = req.file.buffer;
    const contentType = req.file.mimetype;

    const link = await audioService.uploadAudio(filename, file, contentType);
    console.log({ status: "success", link });
    res.send({ status: "success", link });
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

router.get("/stats/all", async (req, res) => {
  try {
    const { totalAudioCount, audioCountByCategory } =
      await audioService.getAggregate();
    res.send({
      status: "success",
      data: { total: totalAudioCount, stats: audioCountByCategory },
    });
  } catch (error) {
    console.error(error);
  }
});

module.exports = router;

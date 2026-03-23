const axios = require("axios");
const mm = require("music-metadata");
const jsmediatags = require("jsmediatags");

/**
 * Duration in seconds from a remote audio URL (no ffmpeg).
 * Uses music-metadata streaming parse; falls back to jsmediatags ID3 TLEN if needed.
 */
async function getAudioDurationFromUrl(fileUrl) {
  if (!fileUrl || typeof fileUrl !== "string") {
    throw new Error("Invalid audio URL");
  }

  const response = await axios({
    method: "GET",
    url: fileUrl,
    responseType: "stream",
    timeout: 120000,
    maxRedirects: 5,
    validateStatus: (s) => s >= 200 && s < 300,
  });

  const mime =
    response.headers["content-type"]?.split(";")[0]?.trim() || "audio/mpeg";

  try {
    const metadata = await mm.parseStream(
      response.data,
      { mimeType: mime },
      { duration: true }
    );
    const d = metadata.format.duration;
    if (d != null && Number.isFinite(d) && d > 0) {
      return d;
    }
  } catch (e) {
    console.warn("music-metadata probe failed:", e.message);
  } finally {
    if (response.data && typeof response.data.destroy === "function") {
      response.data.destroy();
    }
  }

  return getDurationFromJsMediaTags(fileUrl);
}

function getDurationFromJsMediaTags(fileUrl) {
  return new Promise((resolve, reject) => {
    jsmediatags.read(fileUrl, {
      onSuccess: (tag) => {
        const raw = tag?.tags?.TLEN ?? tag?.tags?.duration;
        let seconds = null;
        if (typeof raw === "number" && Number.isFinite(raw)) {
          seconds = raw > 10000 ? raw / 1000 : raw;
        } else if (typeof raw === "string" && raw.trim() !== "") {
          const n = parseFloat(raw);
          if (Number.isFinite(n)) {
            seconds = n > 10000 ? n / 1000 : n;
          }
        }
        if (seconds != null && seconds > 0) {
          resolve(seconds);
        } else {
          reject(new Error("Audio duration not found in tags"));
        }
      },
      onError: (error) => reject(error),
    });
  });
}

const formatDuration = (totalSeconds) => {
  const s = Number(totalSeconds);
  if (!Number.isFinite(s) || s < 0) {
    return "0:00:00";
  }
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = Math.round(s % 60);

  const formattedDuration = `${hours}:${minutes
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  return formattedDuration;
};

module.exports = {
  getAudioDurationFromUrl,
  formatDuration,
};

const ffmpeg = require("fluent-ffmpeg");

const getAudioDurationFromUrl = (fileUrl) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(fileUrl, (err, metadata) => {
      if (err) {
        console.error("Error probing audio file:", err);
        reject(err);
      } else {
        const audioDuration = metadata.format.duration;
        resolve(audioDuration);
      }
    });
  });
};

const formatDuration = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.round(totalSeconds % 60);

  const formattedDuration = `${hours}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  return formattedDuration;
};

module.exports = {
  getAudioDurationFromUrl,
  formatDuration,
};

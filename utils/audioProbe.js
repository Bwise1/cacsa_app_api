// const ffmpeg = require("fluent-ffmpeg");

// const getAudioDurationFromUrl = (fileUrl) => {
//   return new Promise((resolve, reject) => {
//     ffmpeg.ffprobe(fileUrl, (err, metadata) => {
//       if (err) {
//         console.error("Error probing audio file:", err);
//         reject(err);
//       } else {
//         const audioDuration = metadata.format.duration;
//         resolve(audioDuration);
//       }
//     });
//   });
// };

const jsmediatags = require("jsmediatags");

const getAudioDurationFromUrl = (fileUrl) => {
  return new Promise((resolve, reject) => {
    jsmediatags.read(fileUrl, {
      onSuccess: (tag) => {
        if (tag && tag.tags) {
          const audioDuration = tag.tags.duration;
          console.log("DURATION", tag.tags);
          resolve(audioDuration);
        } else {
          reject(new Error("Audio file metadata not found"));
        }
      },
      onError: (error) => {
        console.error("Error reading audio file:", error);
        reject(error);
      },
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

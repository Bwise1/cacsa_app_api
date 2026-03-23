const { uploadFile, deleteObjectFromUrl } = require("../utils/aws");
const categoryModel = require("../models/CategoryModel");
const {
  getAudioDurationFromUrl,
  formatDuration,
} = require("../utils/audioProbe");

function urlsEquivalent(a, b) {
  if (!a || !b) return false;
  const x = String(a).trim();
  const y = String(b).trim();
  if (x === y) return true;
  try {
    return new URL(x).href === new URL(y).href;
  } catch {
    return false;
  }
}

class AudioService {
  constructor(bucketName, audioModel) {
    this.bucketName = bucketName;
    this.audioModel = audioModel;
  }

  async uploadFile(filename, folder, file, contentType) {
    const link = await uploadFile(
      filename,
      this.bucketName,
      folder,
      file,
      contentType
    );
    console.log("Link from service:", link);
    return link;
  }

  async storeAudioInfo(
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
      const audioId = await this.audioModel.storeAudio(
        title,
        description,
        artist,
        date,
        category_id,
        audio_url,
        thumbnail_url,
        duration
      );
      return audioId;
    } catch (error) {
      throw error;
    }
  }

  async getAllAudio() {
    try {
      const audios = await this.audioModel.getAllAudio();
      return audios;
    } catch (error) {
      throw error;
    }
  }

  async getAudioById(audioId) {
    try {
      const audio = await this.audioModel.getAudioById(audioId);
      return audio;
    } catch (error) {
      throw error;
    }
  }

  async deleteAudio(audioId) {
    let row;
    try {
      row = await this.audioModel.getAudioById(audioId);
    } catch {
      return false;
    }
    await this.deleteAudioFilesFromS3(row);
    return this.audioModel.deleteAudio(audioId);
  }

  /**
   * @param {number} audioId
   * @param {object} fields same shape as POST body
   */
  async updateAudio(audioId, fields) {
    const existing = await this.audioModel.getAudioById(audioId);
    const {
      title,
      description,
      artist,
      date,
      category_id,
      audio_url,
      thumbnail_url,
      duration: clientDuration,
    } = fields;

    const urlChanged = !urlsEquivalent(
      String(existing.audio_url || ""),
      String(audio_url || "")
    );

    let resolvedDuration = existing.duration;

    if (urlChanged) {
      if (existing.audio_url) {
        try {
          await deleteObjectFromUrl(existing.audio_url, this.bucketName);
        } catch (e) {
          console.warn("S3 delete previous audio:", e.message || e);
        }
      }
      resolvedDuration = null;
      try {
        const seconds = await getAudioDurationFromUrl(audio_url);
        if (seconds != null && Number.isFinite(seconds) && seconds > 0) {
          resolvedDuration = formatDuration(seconds);
        }
      } catch (e) {
        console.warn("Auto duration on update:", e.message || e);
      }
      if (!resolvedDuration) {
        const manual =
          clientDuration != null && String(clientDuration).trim() !== ""
            ? String(clientDuration).trim()
            : null;
        if (manual) resolvedDuration = manual;
        else {
          const err = new Error(
            "Could not detect audio duration from the new file."
          );
          err.code = "DURATION_REQUIRED";
          throw err;
        }
      }
    }

    const ok = await this.audioModel.updateAudio(
      audioId,
      title,
      description,
      artist,
      date,
      category_id,
      audio_url,
      thumbnail_url,
      resolvedDuration
    );
    return ok;
  }

  /**
   * Removes audio object from S3. Deletes thumbnail only if it is not the category default image.
   */
  async deleteAudioFilesFromS3(row) {
    const bucket = this.bucketName;
    if (!bucket) return;

    if (row.audio_url) {
      try {
        await deleteObjectFromUrl(row.audio_url, bucket);
      } catch (e) {
        console.warn("S3 delete audio object:", e.message || e);
      }
    }

    const thumb = row.thumbnail_url ? String(row.thumbnail_url).trim() : "";
    if (!thumb) return;

    let defaultThumb = "";
    if (row.category_id != null) {
      try {
        const cat = await categoryModel.getCategoryById(row.category_id);
        if (cat?.thumbnail) defaultThumb = String(cat.thumbnail).trim();
      } catch (e) {
        console.warn("Category lookup for thumbnail:", e.message || e);
      }
    }

    if (defaultThumb && urlsEquivalent(thumb, defaultThumb)) return;

    try {
      await deleteObjectFromUrl(thumb, bucket);
    } catch (e) {
      console.warn("S3 delete thumbnail object:", e.message || e);
    }
  }

  async uploadAudio(filename, file, contentType) {
    const folder = "audio";
    return this.uploadFile(filename, folder, file, contentType);
  }

  async uploadThumbnail(filename, file, contentType) {
    const folder = "thumbs";
    return this.uploadFile(filename, folder, file, contentType);
  }

  async getAggregate(audioPlayModel) {
    const totalAudioCount = await this.audioModel.getTotalAudioCount();
    console.log("Total Audio Count:", totalAudioCount);

    const audioCountByCategory =
      await this.audioModel.getAudioCountByCategory();
    console.log("Audio Count by Category:", audioCountByCategory);

    let totalPlayStarts = 0;
    if (audioPlayModel && typeof audioPlayModel.getStats === "function") {
      const playStats = await audioPlayModel.getStats({ days: 0 });
      totalPlayStarts = Number(playStats.totalPlays ?? 0);
    }

    return { totalAudioCount, audioCountByCategory, totalPlayStarts };
  }
}

module.exports = AudioService;

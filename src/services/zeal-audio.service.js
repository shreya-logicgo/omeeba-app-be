import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import fs from "fs";
import crypto from "node:crypto";
import path from "path";
import axios from "axios";
import os from "os";
import { uploadBufferToStorage, generateStorageKey } from "./storage.service.js";
import logger from "../utils/logger.js";
import Music from "../models/music/Music.js";
import config from "../config/env.js";

// Set ffmpeg paths
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

/**
 * Generate ACRCloud Signature
 */
const generateACRSignature = (data, accessSecret) => {
  return crypto
    .createHmac("sha1", accessSecret)
    .update(data)
    .digest("base64");
};

/**
 * Identify Audio using ACRCloud REST API
 * @param {Buffer} audioBuffer - Audio sample buffer
 * @returns {Promise<Object>} ACRCloud response
 */
const identifyAudio = async (audioBuffer) => {
  const host = config.acrcloud.host;
  const accessKey = config.acrcloud.accessKey;
  const accessSecret = config.acrcloud.accessSecret;

  if (!host || !accessKey || !accessSecret) {
    logger.warn("ACRCloud credentials missing. Skipping identification.");
    return { status: { code: 1001, msg: "Credentials missing" } };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const endpoint = "/v1/identify";
  const signatureVersion = "1";
  const dataType = "audio";

  const stringToSign = [
    "POST",
    endpoint,
    accessKey,
    dataType,
    signatureVersion,
    timestamp,
  ].join("\n");

  const signature = generateACRSignature(stringToSign, accessSecret);

  const formData = new URLSearchParams();
  formData.append("access_key", accessKey);
  formData.append("data_type", dataType);
  formData.append("signature_version", signatureVersion);
  formData.append("signature", signature);
  formData.append("sample_bytes", audioBuffer.length.toString());
  formData.append("timestamp", timestamp.toString());

  // Use axios for multipart/form-data (ACRCloud prefers this)
  const BodyFormData = new FormData();
  BodyFormData.append("sample", new Blob([audioBuffer]));
  BodyFormData.append("access_key", accessKey);
  BodyFormData.append("data_type", dataType);
  BodyFormData.append("signature_version", signatureVersion);
  BodyFormData.append("signature", signature);
  BodyFormData.append("sample_bytes", audioBuffer.length.toString());
  BodyFormData.append("timestamp", timestamp.toString());

  try {
    const response = await fetch(`https://${host}${endpoint}`, {
      method: "POST",
      body: BodyFormData,
    });
    return await response.json();
  } catch (error) {
    logger.error("ACRCloud API request failed:", error);
    throw error;
  }
};

/**
 * Detect audio copyright using ACRCloud
 * @param {string} videoUrl - URL of the video
 * @returns {Promise<Object>} Detection result { isFlagged: boolean, reason: string }
 */
export const detectAudioCopyright = async (videoUrl) => {
  let videoPath = null;
  let audioPath = null;

  try {
    const accessKey = process.env.ACR_ACCESS_KEY;
    if (!accessKey || accessKey.startsWith("your-")) {
      logger.warn("ACRCloud credentials not configured. Flagging everything for testing.");
      return { isFlagged: true, reason: "ACRCloud credentials missing (Testing Mode)" };
    }

    // 1. Download video
    videoPath = await downloadToTemp(videoUrl);
    audioPath = videoPath.replace(".mp4", "_sample.mp3");

    // 2. Extract 10-20 second audio sample
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .setStartTime(0)
        .setDuration(12) // ACRCloud recommends 10-20s
        .outputOptions([
          "-vn",
          "-acodec libmp3lame",
          "-ab 64k",
          "-ar 8000", // Quality can be low for identification
        ])
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .save(audioPath);
    });

    // 3. Identify
    const audioBuffer = await fs.promises.readFile(audioPath);
    const result = await identifyAudio(audioBuffer);

    // 4. Process result
    // ACRCloud Code 0 = Success (matches found)
    const isFlagged = result.status && result.status.code === 0;

    let reason = null;
    if (isFlagged && result.metadata && result.metadata.music) {
      const music = result.metadata.music[0];
      reason = `Copyrighted music detected: "${music.title}" by ${music.artists?.[0]?.name || "Unknown Artist"}`;
    }

    return {
      isFlagged,
      reason
    };
  } catch (error) {
    logger.error("Error in detectAudioCopyright:", error);
    // Generic fallback for safety during dev
    return { isFlagged: false, reason: null };
  } finally {
    // Cleanup
    if (videoPath && fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
    if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
  }
};

/**
 * Download a file from URL to a local temporary path
 * @param {string} url - File URL
 * @returns {Promise<string>} Local file path
 */
const downloadToTemp = async (url) => {
  const tempDir = os.tmpdir();
  // Sanitise URL to remove query parameters and hashes from the filename/extension
  const cleanUrl = url.split("?")[0].split("#")[0];
  const fileName = `zeal_${Date.now()}_${Math.random().toString(36).substring(7)}${path.extname(cleanUrl) || ".mp4"}`;
  const localPath = path.join(tempDir, fileName);

  // 1. Mock Fallback for Development (prevents ENOTFOUND example.com)
  if (url.includes("example.com")) {
    logger.info(`Detected dummy URL (${url}), generating silent mock audio...`);
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input("anullsrc=r=44100:cl=stereo")
        .inputFormat("lavfi")
        .setDuration(60)
        .audioCodec("libmp3lame")
        .on("end", () => resolve(localPath))
        .on("error", (err) => reject(err))
        .save(localPath);
    });
    return localPath;
  }

  // 2. Real Download
  const response = await axios({
    method: "GET",
    url: url,
    responseType: "stream",
  });

  const writer = fs.createWriteStream(localPath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", () => resolve(localPath));
    writer.on("error", reject);
  });
};

/**
 * Mute a video (remove all audio tracks)
 * @param {string} videoUrl - Original video URL
 * @param {string} userId - User ID for storage key generation
 * @returns {Promise<string>} New video URL (muted)
 */
export const muteVideo = async (videoUrl, userId) => {
  let inputPath = null;
  let outputPath = null;

  try {
    inputPath = await downloadToTemp(videoUrl);
    outputPath = inputPath.replace(".mp4", "_muted.mp4");

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .noAudio() // Explicitly remove audio
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .save(outputPath);
    });

    const buffer = await fs.promises.readFile(outputPath);
    const storageKey = generateStorageKey(userId, "video", "video/mp4", "zeals/processed");
    const newUrl = await uploadBufferToStorage(storageKey, buffer, "video/mp4");

    return newUrl;
  } catch (error) {
    logger.error("Error in muteVideo:", error);
    throw error;
  } finally {
    // Cleanup
    if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  }
};

/**
 * Get video duration using ffprobe
 * @param {string} localPath - Local file path
 * @returns {Promise<number>} Duration in seconds
 */
const getVideoDuration = (localPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(localPath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });
};

/**
 * Replace audio in a video with a music track
 * @param {string} videoUrl - Original video URL
 * @param {string} musicId - Music track ID from library
 * @param {string} userId - User ID
 * @param {number} musicStartTime - Start time in seconds (optional)
 * @param {number} musicEndTime - End time in seconds (optional)
 * @returns {Promise<string>} New video URL (audio replaced)
 */
export const replaceVideoAudio = async (
  videoUrl,
  musicId,
  userId,
  musicStartTime = null,
  musicEndTime = null
) => {
  let videoLocalPath = null;
  let musicLocalPath = null;
  let outputPath = null;

  try {
    const musicTrack = await Music.findById(musicId);
    if (!musicTrack) throw new Error("Music track not found");

    videoLocalPath = await downloadToTemp(videoUrl);
    musicLocalPath = await downloadToTemp(musicTrack.audioUrl);
    outputPath = videoLocalPath.replace(".mp4", "_replaced.mp4");

    // 🎯 Get video duration
    const videoDuration = await getVideoDuration(videoLocalPath);

    // 🎯 Setup start/end
    const musicDuration = musicTrack.duration || 0;
    const start = musicStartTime ?? 0;
    const end = musicEndTime ?? musicDuration;

    if (end <= start) {
      throw new Error("Invalid music time range");
    }

    const audioDuration = end - start;

    console.log("Video Duration:", videoDuration);
    console.log("Audio Start:", start);
    console.log("Audio End:", end);
    console.log("Audio Duration:", audioDuration);

    // 🎯 FIXED FILTER LOGIC
    let filterChain = "";

    if (audioDuration < videoDuration) {
      const silenceDuration = videoDuration - audioDuration;

      filterChain = `
        [1:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS[a1];
        anullsrc=r=44100:cl=stereo[silence];
        [silence]atrim=duration=${silenceDuration},asetpts=PTS-STARTPTS[s];
        [a1][s]concat=n=2:v=0:a=1[aout]
      `;
    } else {
      filterChain = `
        [1:a]atrim=start=${start}:end=${start + videoDuration},asetpts=PTS-STARTPTS[aout]
      `;
    }

    console.log("FILTER =>", filterChain);

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(videoLocalPath)
        .input(musicLocalPath)
        .complexFilter(filterChain.trim())
        .outputOptions([
          "-map 0:v:0",
          "-map [aout]",
          "-c:v copy",
          "-c:a aac",
          `-t ${videoDuration}`,
        ])
        .on("end", () => resolve())
        .on("error", (err) => {
          console.error("FFmpeg Error:", err);
          reject(err);
        })
        .save(outputPath);
    });

    const buffer = await fs.promises.readFile(outputPath);
    const storageKey = generateStorageKey(
      userId,
      "video",
      "video/mp4",
      "zeals/processed"
    );

    const newUrl = await uploadBufferToStorage(
      storageKey,
      buffer,
      "video/mp4"
    );

    return newUrl;
  } catch (error) {
    logger.error("Error in replaceVideoAudio:", error);
    throw error;
  } finally {
    // 🧹 Cleanup
    if (videoLocalPath && fs.existsSync(videoLocalPath))
      fs.unlinkSync(videoLocalPath);
    if (musicLocalPath && fs.existsSync(musicLocalPath))
      fs.unlinkSync(musicLocalPath);
    if (outputPath && fs.existsSync(outputPath))
      fs.unlinkSync(outputPath);
  }
};

/**
 * Extract audio from a video file and upload it
 * @param {string} videoUrl - Original video URL
 * @param {string} userId - User ID
 * @returns {Promise<string>} Uploaded audio URL
 */
export const extractAudioFromVideo = async (videoUrl, userId) => {
  let inputPath = null;
  let outputPath = null;

  try {
    inputPath = await downloadToTemp(videoUrl);
    outputPath = inputPath.replace(".mp4", "_extracted.mp3");

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          "-vn",          // Disable video
          "-acodec libmp3lame", // MP3 codec
          "-ab 128k",     // 128kbps bitrate
          "-ar 44100",    // 44.1kHz sampling rate
        ])
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .save(outputPath);
    });

    const buffer = await fs.promises.readFile(outputPath);
    const storageKey = generateStorageKey(userId, "audio", "audio/mpeg", "zeals/extracted");
    const audioUrl = await uploadBufferToStorage(storageKey, buffer, "audio/mpeg");

    return audioUrl;
  } catch (error) {
    logger.error("Error in extractAudioFromVideo:", error);
    throw error;
  } finally {
    // Cleanup
    if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  }
};

export default {
  detectAudioCopyright,
  muteVideo,
  replaceVideoAudio,
  extractAudioFromVideo
};

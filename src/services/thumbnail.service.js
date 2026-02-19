/**
 * Thumbnail Service
 * Generate thumbnails from videos using ffmpeg
 */

import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import fs from "fs";
import path from "path";
import os from "os";
import logger from "../utils/logger.js";

// Set ffmpeg path from installer
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Download file from URL to temporary file
 * @param {string} url - Video URL
 * @returns {Promise<string>} Temporary file path
 */
const downloadVideo = async (url) => {
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `zeal-video-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    await fs.promises.writeFile(tempFilePath, Buffer.from(buffer));

    return tempFilePath;
  } catch (error) {
    // Cleanup on error
    try {
      if (fs.existsSync(tempFilePath)) {
        await fs.promises.unlink(tempFilePath);
      }
    } catch (cleanupError) {
      logger.warn(`Failed to cleanup temp file: ${cleanupError.message}`);
    }
    throw error;
  }
};

/**
 * Generate thumbnail from video file
 * @param {string} videoPath - Path to video file
 * @param {number} timeOffset - Time offset in seconds (default: 1 second)
 * @param {number} width - Thumbnail width (default: 640)
 * @returns {Promise<Buffer>} Thumbnail image buffer (JPEG)
 */
const generateThumbnailFromFile = (videoPath, timeOffset = 1, width = 640) => {
  return new Promise((resolve, reject) => {
    const tempThumbnailPath = path.join(
      os.tmpdir(),
      `zeal-thumbnail-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
    );

    ffmpeg(videoPath)
      .seekInput(timeOffset)
      .frames(1)
      .size(`${width}x?`)
      .output(tempThumbnailPath)
      .on("end", async () => {
        try {
          const buffer = await fs.promises.readFile(tempThumbnailPath);
          // Cleanup temp thumbnail file
          try {
            await fs.promises.unlink(tempThumbnailPath);
          } catch (cleanupError) {
            logger.warn(`Failed to cleanup temp thumbnail: ${cleanupError.message}`);
          }
          resolve(buffer);
        } catch (readError) {
          reject(new Error(`Failed to read thumbnail: ${readError.message}`));
        }
      })
      .on("error", (error) => {
        // Cleanup on error
        if (fs.existsSync(tempThumbnailPath)) {
          fs.promises.unlink(tempThumbnailPath).catch(() => {});
        }
        reject(new Error(`FFmpeg error: ${error.message}`));
      })
      .run();
  });
};

/**
 * Generate thumbnail from video URL
 * Downloads video, generates thumbnail, cleans up temp file
 * @param {string} videoUrl - Public URL of the video
 * @param {Object} options - Options
 * @param {number} options.timeOffset - Time offset in seconds (default: 1)
 * @param {number} options.width - Thumbnail width (default: 640)
 * @returns {Promise<Buffer>} Thumbnail image buffer (JPEG)
 */
export const generateThumbnailFromUrl = async (videoUrl, options = {}) => {
  const { timeOffset = 1, width = 640 } = options;
  let tempFilePath = null;

  try {
    // Download video to temp file
    logger.info(`Downloading video for thumbnail generation: ${videoUrl}`);
    tempFilePath = await downloadVideo(videoUrl);

    // Generate thumbnail
    logger.info(`Generating thumbnail from video at ${timeOffset}s`);
    const thumbnailBuffer = await generateThumbnailFromFile(tempFilePath, timeOffset, width);

    logger.info(`Thumbnail generated successfully: ${thumbnailBuffer.length} bytes`);
    return thumbnailBuffer;
  } catch (error) {
    logger.error(`Error generating thumbnail from URL ${videoUrl}:`, error);
    throw error;
  } finally {
    // Cleanup temp file
    if (tempFilePath) {
      try {
        if (fs.existsSync(tempFilePath)) {
          await fs.promises.unlink(tempFilePath);
          logger.info(`Cleaned up temp video file: ${tempFilePath}`);
        }
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup temp file ${tempFilePath}: ${cleanupError.message}`);
      }
    }
  }
};

export default {
  generateThumbnailFromUrl,
};

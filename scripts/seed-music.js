/**
 * Seed Music Script
 * Populates the database with music data from musicSeeder.json.
 * 
 * Usage: node scripts/seed-music.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB, disconnectDB } from "../src/config/database.js";
import { Music } from "../src/models/index.js";
import logger from "../src/utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inputPath = path.resolve(__dirname, "../musicSeeder.json");

const seedMusic = async () => {
    try {
        // Connect to database
        await connectDB();
        logger.info("Connected to database");

        // Read music data from JSON
        if (!fs.existsSync(inputPath)) {
            throw new Error(`File not found: ${inputPath}`);
        }

        const rawData = fs.readFileSync(inputPath, "utf8");
        const musicArray = JSON.parse(rawData);

        if (!Array.isArray(musicArray)) {
            throw new Error("Input JSON must be an array");
        }

        logger.info(`Starting to seed ${musicArray.length} music entries...`);

        let createdCount = 0;
        let skippedCount = 0;

        for (const music of musicArray) {
            try {
                // Check if already exists (by title and artist)
                const exists = await Music.findOne({
                    title: music.title,
                    artist: music.artist
                });

                if (exists) {
                    logger.info(`Skipping duplicate: "${music.title}" by ${music.artist}`);
                    skippedCount++;
                    continue;
                }

                // Create new music record
                await Music.create(music);
                createdCount++;
                logger.info(`Inserted: "${music.title}" by ${music.artist}`);
            } catch (error) {
                logger.error(`Error inserting "${music.title}":`, error.message);
            }
        }

        logger.info(`✅ Successfully seeded music data!`);
        logger.info(`Summary: Created: ${createdCount}, Skipped (Duplicates): ${skippedCount}, Total: ${musicArray.length}`);

    } catch (error) {
        logger.error("Error in seed-music script:", error.message);
        process.exit(1);
    } finally {
        // Disconnect from database
        await disconnectDB();
        logger.info("Disconnected from database");
        process.exit(0);
    }
};

// Run the script
seedMusic();

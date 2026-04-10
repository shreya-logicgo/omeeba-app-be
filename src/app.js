import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import logger from "./utils/logger.js";
import config from "./config/env.js";

// Import routes
import apiRoutes from "./routes/index.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const wellKnownDir = path.resolve(__dirname, "..", ".well-known");

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: config.cors.origins,
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Body parser middleware (file uploads handled by multer)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Compression middleware
app.use(compression());

// Logging middleware
if (config.nodeEnv === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined", { stream: { write: (msg) => logger.info(msg) } }));
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Serve deep-link verification files for Android/iOS app links
app.get("/.well-known/assetlinks.json", (req, res) => {
  res.sendFile(path.join(wellKnownDir, "assetlinks.json"));
});

app.get("/omeeba.app/.well-known/assetlinks.json", (req, res) => {
  res.sendFile(path.join(wellKnownDir, "assetlinks.json"));
});

app.get("/.well-known/apple-app-site-association", (req, res) => {
  res.type("application/json");
  res.sendFile(path.join(wellKnownDir, "apple-app-site-association"));
});

// API routes
app.use("/api", apiRoutes);

// 404 handler
app.use(notFound);

// Error handler (must be last)
app.use(errorHandler);

export default app;

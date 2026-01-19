import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import logger from "./utils/logger.js";
import config from "./config/env.js";

// Import routes
import apiRoutes from "./routes/index.js";

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: config.cors.origins,
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Body parser middleware - skip webhook routes (they need raw body)
app.use((req, res, next) => {
  // Skip body parsing for webhook routes
  if (req.path.includes("/webhooks/")) {
    return next();
  }
  express.json({ limit: "10mb" })(req, res, next);
});

app.use((req, res, next) => {
  // Skip body parsing for webhook routes
  if (req.path.includes("/webhooks/")) {
    return next();
  }
  express.urlencoded({ extended: true, limit: "10mb" })(req, res, next);
});
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

// API routes
app.use("/api", apiRoutes);

// 404 handler
app.use(notFound);

// Error handler (must be last)
app.use(errorHandler);

export default app;

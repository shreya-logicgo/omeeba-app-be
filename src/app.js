import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import logger from "./utils/logger.js";
import { NODE_ENV, CORS_ORIGINS } from "./config/env.js";

// Import routes
import apiRoutes from "./routes/index.js";

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: CORS_ORIGINS,
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Body parser middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Compression middleware
app.use(compression());

// Logging middleware
if (NODE_ENV === "development") {
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


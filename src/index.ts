import express from "express";
import * as dotenv from "dotenv";
import apiRouter, { getVectorService } from "./routes/api.routes";
import cors from "cors";

dotenv.config();

// Check for required environment variables at startup
const requiredEnvVars = ["GEMINI_API_KEY", "HADITH_API_KEY", "MONGODB_URI"];
let missingVars = false;
const port = process.env.PORT || 2002;
const nodeEnv = process.env.NODE_ENV;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.warn(`WARNING: The environment variable "${envVar}" is not set.`);
    missingVars = true;
  }
}

if (missingVars) {
  console.warn(
    "One or more required environment variables are missing. This may cause the application to fail at runtime."
  );
  console.warn(
    "Please check your .env file or your hosting provider's environment variable settings."
  );
}

const app = express();
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  })
);
app.use(express.json());

// Track initialization state
let isReady = false;
let initializationError: Error | null = null;

// Singleton promise to ensure initialization runs only once
let initializationPromise: Promise<void> | null = null;

const initialize = async (): Promise<void> => {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      try {
        console.log("🚀 Initializing server...");
        const vectorService = getVectorService();

        console.log("📥 Loading vector index from MongoDB...");
        await vectorService.loadIndex();

        isReady = true;
        console.log("✅ Vector index loaded successfully. Server is ready!");
      } catch (error) {
        initializationError = error as Error;
        console.error("❌ Failed to initialize vector service:", error);
        throw error;
      }
    })();
  }
  return initializationPromise;
};

// Start initialization immediately
initialize().catch((error) => {
  console.error("💥 Critical initialization failure:", error);
  // Don't exit - let health check report the error
});

// Health check endpoint - always accessible
app.get("/", (req, res) => {
  if (isReady) {
    res.status(200).json({
      status: "ready",
      message: "Backend is working and vector index is loaded",
    });
  } else if (initializationError) {
    res.status(503).json({
      status: "error",
      message: "Failed to initialize",
      error: initializationError.message,
    });
  } else {
    res.status(503).json({
      status: "loading",
      message: "Server is initializing, please wait...",
    });
  }
});

// Health check endpoint (alternative)
app.get("/health", (req, res) => {
  if (isReady) {
    res.status(200).json({
      status: "ready",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } else if (initializationError) {
    res.status(503).json({
      status: "error",
      error: initializationError.message,
    });
  } else {
    res.status(503).json({
      status: "initializing",
      message: "Index is still loading...",
    });
  }
});

// API routes - wait for initialization
app.use("/api", async (req, res, next) => {
  // Check if ready
  if (isReady) {
    return apiRouter(req, res, next);
  }

  // Check if failed
  if (initializationError) {
    return res.status(503).json({
      error: "Service Unavailable",
      message: "Server failed to initialize",
      details: initializationError.message,
    });
  }

  // Still loading
  try {
    await initializationPromise;
    apiRouter(req, res, next);
  } catch (error) {
    console.error("API request failed due to initialization error:", error);
    res.status(503).json({
      error: "Service Unavailable",
      message: "The server is not ready to handle requests.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// Only start listening if not in serverless environment (Vercel)
// Vercel handles the server lifecycle
if (nodeEnv === "development" || !process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`🌐 Server is listening on port ${port}`);
    console.log(`📍 Health check: http://localhost:${port}/health`);
  });
}

// For Vercel serverless
export default app;

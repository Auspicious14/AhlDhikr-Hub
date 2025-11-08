import express from 'express';
import * as dotenv from 'dotenv';
import apiRouter, { getVectorService } from './routes/api.routes';
import cors from 'cors'

dotenv.config();

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
}))
app.use(express.json());

// Singleton promise to ensure initialization runs only once
let initializationPromise: Promise<void> | null = null;
const initialize = () => {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      try {
        const vectorService = getVectorService();
        console.log('Initializing and loading vector index...');
        await vectorService.loadIndex();
        console.log('Vector index loaded successfully.');
      } catch (error) {
        console.error('Failed to initialize vector service:', error);
        throw error;
      }
    })();
  }
  return initializationPromise;
};

// Start initialization right away
initialize();

// Add a root endpoint for health checks and basic status
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Backend is working' });
});

// All API routes will first wait for the initialization to complete
app.use('/api', async (req, res, next) => {
  try {
    await initializationPromise;
    apiRouter(req, res, next);
  } catch (error) {
    console.error('API request failed due to initialization error:', error);
    res.status(503).send('Service Unavailable: The server is not ready to handle requests.');
  }
});

export default app;

import express from 'express';
import * as dotenv from 'dotenv';
import apiRouter, { getVectorService } from './routes/api.routes';

dotenv.config();

const app = express();
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
        // Make the promise reject if initialization fails
        throw error;
      }
    })();
  }
  return initializationPromise;
};

// Start initialization right away
initialize();

// All API routes will first wait for the initialization to complete
app.use('/api', async (req, res, next) => {
  try {
    await initializationPromise;
    apiRouter(req, res, next); // Pass control to the actual router
  } catch (error) {
    console.error('API request failed due to initialization error:', error);
    res.status(503).send('Service Unavailable: The server is not ready to handle requests.');
  }
});

export default app;

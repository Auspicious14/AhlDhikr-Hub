import express from 'express';
import * as dotenv from 'dotenv';
import apiRouter, { getVectorService } from './routes/api.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api', apiRouter);

const startServer = async () => {
  try {
    // Get the vector service instance from the routes file to initialize it
    const vectorService = getVectorService();
    console.log('Initializing and loading vector index...');
    await vectorService.loadIndex();

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log('API endpoints are available at /api');
    });
  } catch (error) {
    console.error('Failed to start the server:', error);
    process.exit(1);
  }
};

startServer();

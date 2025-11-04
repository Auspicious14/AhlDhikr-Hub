import { Router } from 'express';
import { QaController } from '../controllers/qa.controller';
import { QaService } from '../services/qa.service';
import { VectorService } from '../services/vector.service';
import { GeminiService } from '../services/gemini.service';
import { DataRepository } from '../repositories/data.repository';
import { VectorRepository } from '../repositories/vector.repository';

// Instantiate dependencies
const dataRepository = new DataRepository();
const vectorRepository = new VectorRepository();
const geminiService = new GeminiService();
const vectorService = new VectorService(dataRepository, vectorRepository, geminiService);
const qaService = new QaService(geminiService, vectorService);
const qaController = new QaController(qaService, vectorService);

const router = Router();

// Define routes
router.get('/ask', (req, res) => qaController.ask(req, res));
router.post('/build-index', (req, res) => qaController.buildIndex(req, res));

// Export a function to get the vector service for the main app and CLI
export const getVectorService = () => vectorService;

export default router;

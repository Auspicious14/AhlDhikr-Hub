import { Router } from "express";
import { QaController } from "../controllers/qa.controller";
import { QaService } from "../services/qa.service";
import { VectorService } from "../services/vector.service";
import { GeminiService } from "../services/gemini.service";
import { EmbeddingService } from "../services/embedding.service";
import { DataRepository } from "../repositories/data.repository";
import { VectorRepository } from "../repositories/vector.repository";
import { AnswerRepository } from "../repositories/answer.repository";
import { CategoryRepository } from "../repositories/category.repository";
import { CategoryService } from "../services/category.service";

// Instantiate dependencies
const dataRepository = new DataRepository();
const answerRepository = new AnswerRepository();
const categoryRepository = new CategoryRepository();
const embeddingService = new EmbeddingService();
const geminiService = new GeminiService();

// Get embedding dimension and create vector repository
const dimension = embeddingService.getEmbeddingDimension();
const vectorRepository = new VectorRepository(dimension);

const vectorService = new VectorService(
  dataRepository,
  vectorRepository,
  embeddingService
);
const categoryService = new CategoryService(categoryRepository);
const qaService = new QaService(
  geminiService,
  vectorService,
  answerRepository,
  categoryService
);
const qaController = new QaController(qaService, vectorService);

const router = Router();

// Define routes
router.post("/ask", (req, res) => qaController.ask(req, res));
router.post("/ask-stream", (req, res) => qaController.askStream(req, res));
router.get("/ask/:slug", (req, res) => qaController.getAnswer(req, res));
router.get("/recent-questions", (req, res) =>
  qaController.getRecentQuestions(req, res)
);
router.post("/build-index", (req, res) => qaController.buildIndex(req, res));

// Export a function to get the vector service for the main app and CLI
export const getVectorService = () => vectorService;

export default router;

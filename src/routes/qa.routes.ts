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
import { FavoriteRepository } from "../repositories/favorite.repository";
import { authenticateToken } from "../middleware/auth.middleware";

const dataRepository = new DataRepository();
const answerRepository = new AnswerRepository();
const favoriteRepository = new FavoriteRepository();
const categoryRepository = new CategoryRepository();
const embeddingService = new EmbeddingService();
const geminiService = new GeminiService();

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
  categoryService,
  favoriteRepository
);
const qaController = new QaController(qaService, vectorService);

const router = Router();

router.post("/ask", (req, res) => qaController.ask(req, res));
router.post("/ask-stream", (req, res) => qaController.askStream(req, res));
router.get("/ask/:slug", (req, res) => qaController.getAnswer(req, res));
router.get("/recent-questions", (req, res) =>
  qaController.getRecentQuestions(req, res)
);
router.get("/user/recent-questions", authenticateToken, (req, res) =>
  qaController.getUserRecentQuestions(req, res)
);
router.post("/favorites/:slug", authenticateToken, (req, res) =>
  qaController.addToFavorites(req, res)
);
router.delete("/favorites/:slug", authenticateToken, (req, res) =>
  qaController.removeFromFavorites(req, res)
);
router.get("/user/favorites", authenticateToken, (req, res) =>
  qaController.getUserFavorites(req, res)
);
router.get("/user/favorites/:slug", authenticateToken, (req, res) =>
  qaController.isFavorite(req, res)
);
router.post("/build-index", (req, res) => qaController.buildIndex(req, res));

export const getVectorService = () => vectorService;

export default router;

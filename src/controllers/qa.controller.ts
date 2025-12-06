import { Request, Response } from "express";
import { QaService } from "../services/qa.service";
import { VectorService } from "../services/vector.service";

export class QaController {
  private qaService: QaService;
  private vectorService: VectorService;

  constructor(qaService: QaService, vectorService: VectorService) {
    this.qaService = qaService;
    this.vectorService = vectorService;
  }

  async ask(req: Request, res: Response): Promise<void> {
    const { question } = req.body;

    if (!question) {
      res.status(400).json({ error: "Question is a required body parameter." });
      return;
    }

    try {
      const result = await this.qaService.askQuestion(question);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error processing question:", error);
      res
        .status(500)
        .json({
          error: "An internal error occurred while processing the question.",
        });
    }
  }

  /**
   * Streaming endpoint for real-time answer generation
   * Uses Server-Sent Events (SSE)
   */
  async askStream(req: Request, res: Response): Promise<void> {
    const { question } = req.body;

    if (!question) {
      res.status(400).json({ error: "Question is required" });
      return;
    }

    // Set headers for Server-Sent Events
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

    try {
      // Send initial connected event
      res.write(
        `event: connected\ndata: ${JSON.stringify({
          message: "Connected to streaming service",
        })}\n\n`
      );

      // Stream the answer
      for await (const event of this.qaService.askQuestionStream(question)) {
        res.write(
          `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
        );

        // Flush the response to ensure immediate delivery
        if (res.flush) {
          res.flush();
        }
      }

      // Close the connection
      res.end();
    } catch (error) {
      console.error("Error in streaming:", error);
      res.write(
        `event: error\ndata: ${JSON.stringify({
          error: "Failed to process question",
        })}\n\n`
      );
      res.end();
    }
  }

  async getAnswer(req: Request, res: Response): Promise<void> {
    const { slug } = req.params;

    try {
      const answer = await this.qaService.getAnswerBySlug(slug);
      if (answer) {
        res.status(200).json(answer);
      } else {
        res.status(404).json({ error: "Answer not found." });
      }
    } catch (error) {
      console.error("Error fetching answer:", error);
      res
        .status(500)
        .json({
          error: "An internal error occurred while fetching the answer.",
        });
    }
  }

  async getRecentQuestions(req: Request, res: Response): Promise<void> {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;

    try {
      const questions = await this.qaService.getRecentQuestions(limit);
      res.status(200).json(questions);
    } catch (error) {
      console.error("Error fetching recent questions:", error);
      res
        .status(500)
        .json({
          error: "An internal error occurred while fetching recent questions.",
        });
    }
  }

  async buildIndex(req: Request, res: Response): Promise<void> {
    try {
      console.log("API call to build index received.");
      // No need to await here if we want to send a response immediately.
      // The building process will run in the background.
      this.vectorService.buildIndex();
      res
        .status(202)
        .json({ message: "Index building process has been initiated." });
    } catch (error) {
      console.error("Error initiating index build:", error);
      res
        .status(500)
        .json({
          error: "An internal error occurred while initiating the index build.",
        });
    }
  }
}

import { Request, Response } from 'express';
import { QaService } from '../services/qa.service';
import { VectorService } from '../services/vector.service';

export class QaController {
  private qaService: QaService;
  private vectorService: VectorService;

  constructor(qaService: QaService, vectorService: VectorService) {
    this.qaService = qaService;
    this.vectorService = vectorService;
  }

  async ask(req: Request, res: Response): Promise<void> {
    const question = req.query.question as string;

    if (!question) {
      res.status(400).json({ error: 'Question is a required query parameter.' });
      return;
    }

    try {
      const result = await this.qaService.askQuestion(question);
      res.status(200).json(result);
    } catch (error) {
      console.error('Error processing question:', error);
      res.status(500).json({ error: 'An internal error occurred while processing the question.' });
    }
  }

  async buildIndex(req: Request, res: Response): Promise<void> {
    try {
      console.log('API call to build index received.');
      // No need to await here if we want to send a response immediately.
      // The building process will run in the background.
      this.vectorService.buildIndex();
      res.status(202).json({ message: 'Index building process has been initiated.' });
    } catch (error) {
      console.error('Error initiating index build:', error);
      res.status(500).json({ error: 'An internal error occurred while initiating the index build.' });
    }
  }
}

import { GeminiService } from './gemini.service';
import { VectorService } from './vector.service';
import { Metadata } from '../models/types';

export class QaService {
  private geminiService: GeminiService;
  private vectorService: VectorService;

  constructor(geminiService: GeminiService, vectorService: VectorService) {
    this.geminiService = geminiService;
    this.vectorService = vectorService;
  }

  async askQuestion(question: string): Promise<{ answer: string; sources: Metadata[] }> {
    console.log(`Received question: "${question}"`);

    console.log('Searching for relevant sources in the vector index...');
    const context = await this.vectorService.search(question, 5);

    if (context.length === 0) {
      return {
        answer: "I don't know the answer to that question based on the available sources.",
        sources: [],
      };
    }

    console.log(`Found ${context.length} relevant sources.`);

    const contextTexts = context.map(c => `[Source: ${c.source}] ${c.text}`);

    console.log('Generating answer with Gemini...');
    const answer = await this.geminiService.generateAnswer(question, contextTexts);
    console.log('Successfully generated answer.');

    return { answer, sources: context };
  }
}

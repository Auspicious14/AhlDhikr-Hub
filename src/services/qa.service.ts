import { GeminiService } from "./gemini.service";
import { VectorService } from "./vector.service";
import { AnswerRepository } from "../repositories/answer.repository";
import { CategoryService } from "./category.service";
import { IAnswer, ISource } from "../models/answer";
import slugify from "slugify";
import { Metadata } from "../models/types";

export class QaService {
  private geminiService: GeminiService;
  private vectorService: VectorService;
  private answerRepository: AnswerRepository;
  private categoryService: CategoryService;

  constructor(
    geminiService: GeminiService,
    vectorService: VectorService,
    answerRepository: AnswerRepository,
    categoryService: CategoryService
  ) {
    this.geminiService = geminiService;
    this.vectorService = vectorService;
    this.answerRepository = answerRepository;
    this.categoryService = categoryService;
  }

  private _create_slug(question: string): string {
    return slugify(question, { lower: true, strict: true });
  }

  private _create_answer_snippet(answer: string): string {
    const snippet = answer.split("</p>")[0].replace("<p>", "");
    return snippet.length > 200 ? snippet.substring(0, 200) + "..." : snippet;
  }

  private _determine_category(context: Metadata[]): string {
    const sourceCounts: { [key: string]: number } = {};
    for (const item of context) {
      const sourceName = item.source.split(" ")[0]; // "Quran" or "Hadith"
      sourceCounts[sourceName] = (sourceCounts[sourceName] || 0) + 1;
    }
    return Object.keys(sourceCounts).reduce(
      (a, b) => (sourceCounts[a] > sourceCounts[b] ? a : b),
      "Uncategorized"
    );
  }

  private _format_sources(context: Metadata[]): ISource[] {
    return context.map((c) => {
      const type = c.source.startsWith("Quran") ? "Qur'an" : "Hadith";
      return {
        citation: c.source,
        type: type,
        url: "#", // Placeholder
        arabic: "", // Placeholder
        transliteration: "", // Placeholder
        audioUrl: "#", // Placeholder
      };
    });
  }

  async askQuestion(question: string): Promise<IAnswer> {
    console.log(`Received question: "${question}"`);

    const slug = this._create_slug(question);

    console.log("Searching for relevant sources in the vector index...");
    const context = await this.vectorService.search(question, 5);

    if (context.length === 0) {
      const answerData = {
        question,
        slug,
        answer:
          "<p>I don't know the answer to that question based on the available sources.</p>",
        answerSnippet: "I don't know the answer to that question...",
        source: "System",
        category: "Uncategorized",
        sources: [],
      };
      return this.answerRepository.createAnswer(answerData);
    }

    console.log(`Found ${context.length} relevant sources.`);
    const contextTexts = context.map((c) => `[Source: ${c.source}] ${c.text}`);

    console.log("Generating answer with Gemini...");
    const answerHtml = await this.geminiService.generateAnswer(
      question,
      contextTexts
    );
    console.log("Successfully generated answer.");

    const answerSnippet = this._create_answer_snippet(answerHtml);
    const categoryName = this._determine_category(context);
    const category = await this.categoryService.findOrCreateCategory(
      categoryName
    );
    const sources = this._format_sources(context);

    const answerData: Partial<IAnswer> = {
      question,
      slug,
      answer: answerHtml,
      answerSnippet,
      source: sources.length > 0 ? sources[0].citation : "System",
      category: category.name,
      sources,
    };

    return this.answerRepository.createAnswer(answerData);
  }

  /**
   * Ask question with streaming support
   * Yields events for real-time UI updates
   */
  async *askQuestionStream(question: string): AsyncGenerator<{
    type: "thinking" | "sources" | "answer-chunk" | "done" | "error";
    data: any;
  }> {
    try {
      console.log(`Received streaming question: "${question}"`);

      // Step 1: Thinking state
      yield {
        type: "thinking",
        data: { message: "Searching for relevant sources..." },
      };

      // Step 2: Search for sources
      const context = await this.vectorService.search(question, 5);

      if (context.length === 0) {
        yield {
          type: "done",
          data: {
            message: "I don't know the answer based on available sources.",
            slug: this._create_slug(question),
          },
        };
        return;
      }

      // Step 3: Send sources
      const sources = this._format_sources(context);
      yield {
        type: "sources",
        data: { sources, count: context.length },
      };

      // Step 4: Stream answer chunks
      const contextTexts = context.map(
        (c) => `[Source: ${c.source}] ${c.text}`
      );
      let fullAnswer = "";

      for await (const chunk of this.geminiService.generateAnswerStream(
        question,
        contextTexts
      )) {
        fullAnswer += chunk;
        yield {
          type: "answer-chunk",
          data: { chunk },
        };
      }

      // Step 5: Save to database
      const slug = this._create_slug(question);
      const answerSnippet = this._create_answer_snippet(fullAnswer);
      const categoryName = this._determine_category(context);
      const category = await this.categoryService.findOrCreateCategory(
        categoryName
      );

      const answerData: Partial<IAnswer> = {
        question,
        slug,
        answer: fullAnswer,
        answerSnippet,
        source: sources.length > 0 ? sources[0].citation : "System",
        category: category.name,
        sources,
      };

      await this.answerRepository.createAnswer(answerData);

      // Step 6: Send done event
      yield {
        type: "done",
        data: { slug, question, saved: true },
      };
    } catch (error) {
      console.error("Error in streaming:", error);
      yield {
        type: "error",
        data: { message: "Failed to process question", error: String(error) },
      };
    }
  }

  async getAnswerBySlug(slug: string): Promise<IAnswer | null> {
    return this.answerRepository.findAnswerBySlug(slug);
  }

  async getRecentQuestions(
    limit: number = 5
  ): Promise<Pick<IAnswer, "question" | "slug">[]> {
    return this.answerRepository.findRecentAnswers(limit);
  }
}

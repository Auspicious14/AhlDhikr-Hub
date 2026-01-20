import { GeminiService } from "./gemini.service";
import { VectorService } from "./vector.service";
import { AnswerRepository } from "../repositories/answer.repository";
import { CategoryService } from "./category.service";
import { FavoriteRepository } from "../repositories/favorite.repository";
import { IAnswer, ISource } from "../models/answer";
import slugify from "slugify";
import { Metadata } from "../models/types";

export class QaService {
  private geminiService: GeminiService;
  private vectorService: VectorService;
  private answerRepository: AnswerRepository;
  private categoryService: CategoryService;
  private favoriteRepository: FavoriteRepository;

  constructor(
    geminiService: GeminiService,
    vectorService: VectorService,
    answerRepository: AnswerRepository,
    categoryService: CategoryService,
    favoriteRepository: FavoriteRepository
  ) {
    this.geminiService = geminiService;
    this.vectorService = vectorService;
    this.answerRepository = answerRepository;
    this.categoryService = categoryService;
    this.favoriteRepository = favoriteRepository;
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
      const sourceName = item.source.split(" ")[0]; // "Quran", "Hadith", or "Tafsir"
      sourceCounts[sourceName] = (sourceCounts[sourceName] || 0) + 1;
    }
    return Object.keys(sourceCounts).reduce(
      (a, b) => (sourceCounts[a] > sourceCounts[b] ? a : b),
      "Uncategorized"
    );
  }

  private _format_sources(context: Metadata[]): ISource[] {
    return context.map((c) => {
      let type: "Hadith" | "Qur'an" | "Tafsir" = "Qur'an";
      if (c.source.startsWith("Hadith")) {
        type = "Hadith";
      } else if (c.source.startsWith("Tafsir")) {
        type = "Tafsir";
      }
      return {
        citation: c.source,
        type: type,
        text: c.text, // Include the actual verse/hadith/tafsir text
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
    const context = await this.vectorService.search(question, 3);

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

      // Step 2: Search for sources (increased to 10 for better coverage)
      const context = await this.vectorService.search(question, 10);

      // Log sources for debugging
      console.log(`Found ${context.length} sources:`);
      context.forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.source}: ${c.text.substring(0, 80)}...`);
      });

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

  async getUserRecentQuestions(
    userId: string,
    limit: number = 5
  ): Promise<Pick<IAnswer, "question" | "slug">[]> {
    return this.answerRepository.findRecentAnswersByUser(userId, limit);
  }

  async addToFavorites(userId: string, answerSlug: string): Promise<void> {
    await this.favoriteRepository.addFavorite(userId, answerSlug);
  }

  async removeFromFavorites(userId: string, answerSlug: string): Promise<void> {
    await this.favoriteRepository.removeFavorite(userId, answerSlug);
  }

  async getUserFavorites(
    userId: string,
    limit: number = 10,
    skip: number = 0
  ): Promise<IAnswer[]> {
    return this.answerRepository.findFavoriteAnswersByUser(userId, limit, skip);
  }

  async isFavorite(userId: string, answerSlug: string): Promise<boolean> {
    return this.answerRepository.isFavorite(userId, answerSlug);
  }
}

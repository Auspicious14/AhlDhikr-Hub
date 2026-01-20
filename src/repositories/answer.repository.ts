import { IAnswer } from "../models/answer";
import { getPrismaClient } from "../services/prisma.service";

export class AnswerRepository {
  async createAnswer(answerData: Partial<IAnswer>): Promise<IAnswer> {
    const prisma = getPrismaClient();

    const sources = (answerData.sources || []) as any;

    const answer = await prisma.answer.upsert({
      where: {
        slug: answerData.slug as string,
      },
      create: {
        question: answerData.question as string,
        slug: answerData.slug as string,
        answer: answerData.answer as string,
        answerSnippet: answerData.answerSnippet as string,
        source: answerData.source as string,
        category: answerData.category as string,
        sources,
      },
      update: {
        question: answerData.question as string,
        answer: answerData.answer as string,
        answerSnippet: answerData.answerSnippet as string,
        source: answerData.source as string,
        category: answerData.category as string,
        sources,
      },
    });

    return {
      question: answer.question,
      slug: answer.slug,
      answer: answer.answer,
      answerSnippet: answer.answerSnippet,
      source: answer.source,
      category: answer.category,
      sources: (answer.sources || []) as any,
      createdAt: answer.createdAt,
      updatedAt: answer.updatedAt,
    };
  }

  async findAnswerBySlug(slug: string): Promise<IAnswer | null> {
    const prisma = getPrismaClient();
    const answer = await prisma.answer.findUnique({
      where: { slug },
    });

    if (!answer) {
      return null;
    }

    return {
      question: answer.question,
      slug: answer.slug,
      answer: answer.answer,
      answerSnippet: answer.answerSnippet,
      source: answer.source,
      category: answer.category,
      sources: (answer.sources || []) as any,
      createdAt: answer.createdAt,
      updatedAt: answer.updatedAt,
    };
  }

  async findRecentAnswers(
    limit: number = 5
  ): Promise<Pick<IAnswer, "question" | "slug">[]> {
    const prisma = getPrismaClient();
    const answers = await prisma.answer.findMany({
      select: {
        question: true,
        slug: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    return answers.map((a: any) => ({
      question: a.question,
      slug: a.slug,
    }));
  }

  async findRecentAnswersByUser(
    userId: string,
    limit: number = 5
  ): Promise<Pick<IAnswer, "question" | "slug">[]> {
    const prisma = getPrismaClient();
    const answers = await prisma.answer.findMany({
      where: {
        source: userId,
      },
      select: {
        question: true,
        slug: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    return answers.map((a: any) => ({
      question: a.question,
      slug: a.slug,
    }));
  }

  async findFavoriteAnswersByUser(
    userId: string,
    limit: number = 10,
    skip: number = 0
  ): Promise<IAnswer[]> {
    const prisma = getPrismaClient();

    const favorites = await prisma.favorite.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    });

    if (favorites.length === 0) {
      return [];
    }

    const slugs = favorites.map((f: any) => f.answerSlug);

    const answers = await prisma.answer.findMany({
      where: {
        slug: {
          in: slugs,
        },
      },
    });

    const answersBySlug = new Map<string, any>();
    for (const a of answers) {
      answersBySlug.set(a.slug, a);
    }

    const result: IAnswer[] = [];

    for (const f of favorites) {
      const a = answersBySlug.get(f.answerSlug);
      if (!a) {
        continue;
      }
      result.push({
        question: a.question,
        slug: a.slug,
        answer: a.answer,
        answerSnippet: a.answerSnippet,
        source: a.source,
        category: a.category,
        sources: (a.sources || []) as any,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      });
    }

    return result;
  }

  async isFavorite(userId: string, answerSlug: string): Promise<boolean> {
    const prisma = getPrismaClient();
    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_answerSlug: {
          userId,
          answerSlug,
        },
      },
    });

    return !!favorite;
  }
}

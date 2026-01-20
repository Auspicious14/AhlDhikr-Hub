import { IFavorite } from "../models/favorite";
import { getPrismaClient } from "../services/prisma.service";
import { Favorite as PrismaFavorite } from "@prisma/client";

export class FavoriteRepository {
  async addFavorite(userId: string, answerSlug: string): Promise<IFavorite> {
    const prisma = getPrismaClient();

    const favorite: PrismaFavorite = await prisma.favorite.upsert({
      where: {
        userId_answerSlug: {
          userId,
          answerSlug,
        },
      },
      create: {
        userId,
        answerSlug,
      },
      update: {
        createdAt: new Date(),
      },
    });

    return {
      userId: favorite.userId,
      answerSlug: favorite.answerSlug,
      createdAt: favorite.createdAt,
    };
  }

  async removeFavorite(userId: string, answerSlug: string): Promise<boolean> {
    const prisma = getPrismaClient();

    try {
      await prisma.favorite.delete({
        where: {
          userId_answerSlug: {
            userId,
            answerSlug,
          },
        },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async getUserFavorites(
    userId: string,
    limit: number = 10,
    skip: number = 0
  ): Promise<IFavorite[]> {
    const prisma = getPrismaClient();

    const favorites: PrismaFavorite[] = await prisma.favorite.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    });

    return favorites.map((f: PrismaFavorite) => ({
      userId: f.userId,
      answerSlug: f.answerSlug,
      createdAt: f.createdAt,
    }));
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

  async getUserFavoritesCount(userId: string): Promise<number> {
    const prisma = getPrismaClient();
    const count = await prisma.favorite.count({
      where: {
        userId,
      },
    });
    return count;
  }
}

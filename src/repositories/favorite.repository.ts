import { Favorite, IFavorite } from '../models/favorite';

export class FavoriteRepository {
  async addFavorite(userId: string, answerSlug: string): Promise<IFavorite> {
    const favorite = new Favorite({ userId, answerSlug });
    await favorite.save();
    return favorite;
  }

  async removeFavorite(userId: string, answerSlug: string): Promise<boolean> {
    const result = await Favorite.deleteOne({ userId, answerSlug });
    return result.deletedCount > 0;
  }

  async getUserFavorites(userId: string, limit: number = 10, skip: number = 0): Promise<IFavorite[]> {
    return Favorite.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .exec();
  }

  async isFavorite(userId: string, answerSlug: string): Promise<boolean> {
    const favorite = await Favorite.findOne({ userId, answerSlug });
    return !!favorite;
  }

  async getUserFavoritesCount(userId: string): Promise<number> {
    return Favorite.countDocuments({ userId });
  }
}
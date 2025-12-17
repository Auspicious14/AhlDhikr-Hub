import { Answer, IAnswer } from '../models/answer';
import { Favorite } from '../models/favorite';

export class AnswerRepository {
  async createAnswer(answerData: Partial<IAnswer>): Promise<IAnswer> {
    const answer = new Answer(answerData);
    await answer.save();
    return answer;
  }

  async findAnswerBySlug(slug: string): Promise<IAnswer | null> {
    return Answer.findOne({ slug }).exec();
  }

  async findRecentAnswers(limit: number = 5): Promise<Pick<IAnswer, 'question' | 'slug'>[]> {
    return Answer.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('question slug')
      .exec();
  }

  async findRecentAnswersByUser(userId: string, limit: number = 5): Promise<Pick<IAnswer, 'question' | 'slug'>[]> {
    return Answer.find({ source: userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('question slug')
      .exec();
  }

  async findFavoriteAnswersByUser(userId: string, limit: number = 10, skip: number = 0): Promise<IAnswer[]> {
    const favoriteSlugs = await Favorite.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .select('answerSlug')
      .exec();
    
    const slugs = favoriteSlugs.map(fav => fav.answerSlug);
    return Answer.find({ slug: { $in: slugs } }).exec();
  }

  async isFavorite(userId: string, answerSlug: string): Promise<boolean> {
    const favorite = await Favorite.findOne({ userId, answerSlug });
    return !!favorite;
  }
}

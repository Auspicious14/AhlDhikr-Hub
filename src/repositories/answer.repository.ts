import { Answer, IAnswer } from '../models/answer';

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
}

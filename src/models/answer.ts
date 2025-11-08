import { Document, Schema, model } from 'mongoose';

export interface ISource {
  citation: string;
  type: 'Hadith' | 'Qur\'an';
  url?: string;
  arabic?: string;
  transliteration?: string;
  audioUrl?: string;
}

export interface IAnswer extends Document {
  question: string;
  slug: string;
  answer: string;
  answerSnippet: string;
  source: string;
  category: string;
  sources: ISource[];
  createdAt: Date;
  updatedAt: Date;
}

const SourceSchema = new Schema<ISource>({
  citation: { type: String, required: true },
  type: { type: String, required: true, enum: ['Hadith', 'Qur\'an'] },
  url: { type: String },
  arabic: { type: String },
  transliteration: { type: String },
  audioUrl: { type: String },
});

const AnswerSchema = new Schema<IAnswer>({
  question: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  answer: { type: String, required: true },
  answerSnippet: { type: String, required: true },
  source: { type: String, required: true },
  category: { type: String, required: true },
  sources: [SourceSchema],
}, { timestamps: true });

export const Answer = model<IAnswer>('Answer', AnswerSchema);

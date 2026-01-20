export interface ISource {
  citation: string;
  type: "Hadith" | "Qur'an" | "Tafsir";
  text: string;
  url?: string;
  arabic?: string;
  transliteration?: string;
  audioUrl?: string;
}

export interface IAnswer {
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

export interface QuranVerse {
  number: number;
  text: string;
  surah: {
    number: number;
    name: string;
    englishName: string;
    englishNameTranslation: string;
  };
}

export interface Hadith {
  hadith_english: string;
  by_book: string;
}

export interface Metadata {
  id: number;
  text: string;
  source: string;
}

export interface QuranVerse {
  number: number; // Global verse number (1-6236)
  numberInSurah: number; // Verse number within the surah (e.g., 1-286 for Al-Baqarah)
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

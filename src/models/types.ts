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
  hadith_arabic?: string;
  book: string;
  chapter_english?: string;
  chapter_arabic?: string;
  hadith_number: string;
  grading?: string;
  collection?: string; // e.g., "Sahih Bukhari", "Sahih Muslim"
  narrator?: string;
  reference?: string;
}

export interface Metadata {
  id: number;
  text: string;
  source: string;
}

export interface SeerahEntry {
  topic: string;
  content: string;
  source: string;
}

export interface DuaEntry {
  category: string;
  arabic: string;
  transliteration: string;
  english: string;
  reference: string;
  note: string;
}

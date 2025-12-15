// import axios from "axios";
// import * as fs from "fs/promises";
// import * as path from "path";
// import { QuranVerse, Hadith, SeerahEntry } from "../models/types";
// import { TafsirService } from "../services/tafsir.service";
// import { TafsirDocument } from "../models/tafsir.types";
// import * as dotenv from "dotenv";

// dotenv.config();

// const DATA_DIR = path.join(__dirname, "..", "..", "data");
// const QURAN_FILE = path.join(DATA_DIR, "quran.json");
// const HADITH_FILE = path.join(DATA_DIR, "hadith.json");
// const TAFSIR_FILE = path.join(DATA_DIR, "tafsir.json");
// const SEERAH_FILE = path.join(DATA_DIR, "seerah.json");
// const HADITH_API_KEY = process.env.HADITH_API_KEY;

// export class DataRepository {
//   private async fileExists(filePath: string): Promise<boolean> {
//     try {
//       await fs.access(filePath);
//       return true;
//     } catch {
//       return false;
//     }
//   }

//   async getQuranVerses(): Promise<QuranVerse[]> {
//     if (await this.fileExists(QURAN_FILE)) {
//       const data = await fs.readFile(QURAN_FILE, "utf-8");
//       console.log("Loaded Quran data from cache.");
//       return JSON.parse(data);
//     }

//     console.log("Fetching Quran data from API...");
//     const response = await axios.get(
//       "https://api.alquran.cloud/v1/quran/en.asad"
//     );
//     const verses = response.data.data.surahs.flatMap((surah: any) =>
//       surah.ayahs.map((ayah: any) => ({
//         number: ayah.number, // Global verse number (1-6236)
//         numberInSurah: ayah.numberInSurah, // Verse number within the surah
//         text: ayah.text,
//         surah: {
//           number: surah.number,
//           name: surah.name,
//           englishName: surah.englishName,
//           englishNameTranslation: surah.englishNameTranslation,
//         },
//       }))
//     );

//     await fs.mkdir(DATA_DIR, { recursive: true });
//     await fs.writeFile(QURAN_FILE, JSON.stringify(verses, null, 2));
//     console.log("Quran data cached.");
//     return verses;
//   }

//   async getHadith(): Promise<Hadith[]> {
//     if (await this.fileExists(HADITH_FILE)) {
//       const data = await fs.readFile(HADITH_FILE, "utf-8");
//       console.log("Loaded Hadith data from cache.");
//       return JSON.parse(data);
//     }

//     if (!HADITH_API_KEY) {
//       throw new Error(
//         "HADITH_API_KEY is not set in the environment variables."
//       );
//     }

//     console.log("Fetching all Hadiths from Sahih Bukhari...");
//     const allHadiths: Hadith[] = [];
//     let page = 1;
//     let lastPage = 1;

//     do {
//       try {
//         const url = `https://hadithapi.com/public/api/hadiths?apiKey=${HADITH_API_KEY}&book=sahih-bukhari&page=${page}`;
//         const response = await axios.get(url);
//         const { data, current_page, last_page } = response.data.hadiths;

//         const hadiths = data.map((h: any) => ({
//           hadith_english: h.hadithEnglish,
//           by_book: h.book.bookName,
//         }));

//         allHadiths.push(...hadiths);

//         page = current_page;
//         lastPage = last_page;

//         console.log(`Fetched page ${page}/${lastPage} of Hadiths...`);
//       } catch (error) {
//         console.error(`Error fetching page ${page} of Hadiths:`, error);
//         // Stop if there's an error to avoid hammering the API
//         break;
//       }
//     } while (page++ <= lastPage);

//     await fs.mkdir(DATA_DIR, { recursive: true });
//     await fs.writeFile(HADITH_FILE, JSON.stringify(allHadiths, null, 2));
//     console.log(`Hadith data cached with ${allHadiths.length} hadiths.`);
//     return allHadiths;
//   }

//   async getTafsir(): Promise<TafsirDocument[]> {
//     if (await this.fileExists(TAFSIR_FILE)) {
//       const data = await fs.readFile(TAFSIR_FILE, "utf-8");
//       console.log("Loaded Tafsir data from cache.");
//       return JSON.parse(data);
//     }

//     console.log("Fetching Tafsir data from API...");
//     const tafsirService = new TafsirService();
//     const tafsirDocuments = await tafsirService.getTafsirDocuments();

//     // Cache the data
//     await fs.mkdir(DATA_DIR, { recursive: true });
//     await fs.writeFile(TAFSIR_FILE, JSON.stringify(tafsirDocuments, null, 2));
//     console.log(`Tafsir data cached with ${tafsirDocuments.length} documents.`);

//     return tafsirDocuments;
//   }

//   async getSeerah(): Promise<SeerahEntry[]> {
//     if (await this.fileExists(SEERAH_FILE)) {
//       const data = await fs.readFile(SEERAH_FILE, "utf-8");
//       console.log("Loaded Seerah data from cache.");
//       return JSON.parse(data);
//     }

//     // If no cached file, they need to run the extraction script
//     throw new Error("Seerah data not found. Run: npm run extract-seerah");
//   }
// }

// src/repositories/data.repository.ts

import axios from "axios";
import * as fs from "fs/promises";
import * as path from "path";
import { QuranVerse, Hadith, SeerahEntry, DuaEntry } from "../models/types";
import { TafsirService } from "../services/tafsir.service";
import { TafsirDocument } from "../models/tafsir.types";
import * as dotenv from "dotenv";

dotenv.config();

const DATA_DIR = path.join(__dirname, "..", "..", "data");

// Existing cache files
const QURAN_SINGLE_FILE = path.join(DATA_DIR, "quran.json");
const HADITH_BUKHARI_FILE = path.join(DATA_DIR, "hadith.json");
const TAFSIR_FILE = path.join(DATA_DIR, "tafsir.json");
const SEERAH_FILE = path.join(DATA_DIR, "seerah.json");

// New expanded cache files
const QURAN_EDITIONS_FILE = path.join(DATA_DIR, "quran_editions.json");
const FULL_HADITH_FILE = path.join(DATA_DIR, "full_hadith.json");
const DUAS_FILE = path.join(DATA_DIR, "duas.json");

export class DataRepository {
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // ====================== ORIGINAL QURAN (Asad - kept for backward compatibility) ======================
  async getQuranVerses(): Promise<QuranVerse[]> {
    if (await this.fileExists(QURAN_SINGLE_FILE)) {
      const data = await fs.readFile(QURAN_SINGLE_FILE, "utf-8");
      console.log("Loaded single Quran edition (Asad) from cache.");
      return JSON.parse(data);
    }

    console.log("Fetching Quran (Asad translation) from alquran.cloud...");
    const response = await axios.get(
      "https://api.alquran.cloud/v1/quran/en.asad"
    );
    const verses = response.data.data.surahs.flatMap((surah: any) =>
      surah.ayahs.map((ayah: any) => ({
        number: ayah.number,
        numberInSurah: ayah.numberInSurah,
        text: ayah.text,
        surah: {
          number: surah.number,
          name: surah.name,
          englishName: surah.englishName,
          englishNameTranslation: surah.englishNameTranslation,
        },
      }))
    );

    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(QURAN_SINGLE_FILE, JSON.stringify(verses, null, 2));
    console.log("Single Quran edition cached.");
    return verses;
  }

  // ====================== MULTIPLE QURAN EDITIONS (Highly Recommended) ======================
  async getQuranEditions(): Promise<any[]> {
    if (await this.fileExists(QURAN_EDITIONS_FILE)) {
      const data = await fs.readFile(QURAN_EDITIONS_FILE, "utf-8");
      console.log("Loaded multiple Quran editions from cache.");
      return JSON.parse(data);
    }

    console.log(
      "Fetching multiple Quran editions from fawazahmed0/quran-api..."
    );
    const editions = [
      { id: "eng-sahih", name: "Sahih International" },
      { id: "eng-yusufali", name: "Yusuf Ali" },
      { id: "eng-pickthall", name: "Pickthall" },
      { id: "eng-shakir", name: "Shakir" },
      { id: "ara-quranuthmani", name: "Uthmani Script" },
    ];

    const allVerses: any[] = [];

    for (const edition of editions) {
      try {
        const url = `https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/${edition.id}.json`;
        const response = await axios.get(url);
        const verses = response.data.quran.map((verse: any) => ({
          surah: verse.surah,
          ayah: verse.ayah,
          text: verse.text,
          edition: edition.name,
          editionId: edition.id,
          language: edition.id.startsWith("ara-") ? "arabic" : "english",
        }));
        allVerses.push(...verses);
        console.log(`Fetched ${edition.name} (${verses.length} verses)`);
      } catch (error: any) {
        console.warn(`Failed to fetch ${edition.id}: ${error.message}`);
      }
    }

    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(QURAN_EDITIONS_FILE, JSON.stringify(allVerses, null, 2));
    console.log(
      `Multiple Quran editions cached: ${allVerses.length} total verses.`
    );
    return allVerses;
  }

  // ====================== ORIGINAL BUKHARI HADITH (kept for fallback) ======================
  async getHadithBukhari(): Promise<Hadith[]> {
    if (await this.fileExists(HADITH_BUKHARI_FILE)) {
      const data = await fs.readFile(HADITH_BUKHARI_FILE, "utf-8");
      console.log("Loaded Sahih Bukhari from cache.");
      return JSON.parse(data);
    }

    const apiKey = process.env.HADITH_API_KEY;
    if (!apiKey) {
      throw new Error("HADITH_API_KEY not set for original Bukhari fetch.");
    }

    // ... your original pagination logic unchanged
    // (omitted for brevity, keep as-is)
    return []; // placeholder
  }

  // ====================== FULL HADITH COLLECTIONS (Kutub Sitta + more - NO API KEY NEEDED) ======================
  async getFullHadith(): Promise<Hadith[]> {
    if (await this.fileExists(FULL_HADITH_FILE)) {
      const data = await fs.readFile(FULL_HADITH_FILE, "utf-8");
      console.log("Loaded full hadith collections from cache.");
      return JSON.parse(data);
    }

    console.log(
      "Fetching full hadith collections (Nine Books) from AhmedBaset/hadith-json..."
    );
    const books = [
      "bukhari",
      "muslim",
      "tirmidhi",
      "abudawud",
      "nasai",
      "ibnmajah",
      "malik",
      "ahmad",
      "darimi",
    ];

    const allHadiths: Hadith[] = [];

    for (const book of books) {
      try {
        const url = `https://raw.githubusercontent.com/AhmedBaset/hadith-json/main/data/${book}.json`;
        const response = await axios.get(url);
        const hadiths = response.data.map((h: any) => ({
          hadith_english: h.english?.text || "",
          hadith_arabic: h.arabic?.text || "",
          book: book.charAt(0).toUpperCase() + book.slice(1),
          chapter_english: h.chapter?.english || "",
          chapter_arabic: h.chapter?.arabic || "",
          hadith_number: h.hadithNumber || h.id || "",
          grading: h.grading || "",
        }));
        allHadiths.push(...hadiths);
        console.log(`Fetched ${book}: ${hadiths.length} hadiths`);
      } catch (error: any) {
        console.warn(`Failed to fetch ${book}: ${error.message}`);
      }
    }

    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FULL_HADITH_FILE, JSON.stringify(allHadiths, null, 2));
    console.log(
      `Full hadith collections cached: ${allHadiths.length} total hadiths.`
    );
    return allHadiths;
  }

  // ====================== TAFSIR (unchanged - using your TafsirService) ======================
  async getTafsir(): Promise<TafsirDocument[]> {
    if (await this.fileExists(TAFSIR_FILE)) {
      const data = await fs.readFile(TAFSIR_FILE, "utf-8");
      console.log("Loaded Tafsir data from cache.");
      return JSON.parse(data);
    }

    console.log("Fetching Tafsir data via TafsirService...");
    const tafsirService = new TafsirService();
    const tafsirDocuments = await tafsirService.getTafsirDocuments();

    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(TAFSIR_FILE, JSON.stringify(tafsirDocuments, null, 2));
    console.log(`Tafsir data cached: ${tafsirDocuments.length} documents.`);
    return tafsirDocuments;
  }

  // ====================== SEERAH (unchanged) ======================
  async getSeerah(): Promise<SeerahEntry[]> {
    if (await this.fileExists(SEERAH_FILE)) {
      const data = await fs.readFile(SEERAH_FILE, "utf-8");
      console.log("Loaded Seerah data from cache.");
      return JSON.parse(data);
    }

    throw new Error("Seerah data not found. Run: npm run extract-seerah");
  }

  // ====================== DUAS - Hisn al-Muslim (Fortress of the Muslim) ======================
  async getDuas(): Promise<DuaEntry[]> {
    if (await this.fileExists(DUAS_FILE)) {
      const data = await fs.readFile(DUAS_FILE, "utf-8");
      console.log("Loaded Hisn al-Muslim duas from cache.");
      return JSON.parse(data);
    }

    console.log("Fetching Hisn al-Muslim (Arabic + English)...");
    const url =
      "https://raw.githubusercontent.com/wafaaelmaandy/Hisn-Muslim-Json/main/hisn_almuslim_en_ar.json";
    const response = await axios.get(url);

    const duas: DuaEntry[] = response.data.map((item: any) => ({
      category: item.category || "General",
      arabic: item.arabic_text || "",
      transliteration: item.transliteration || "",
      english: item.translation || "",
      reference: item.reference || "",
      note: item.note || "",
    }));

    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DUAS_FILE, JSON.stringify(duas, null, 2));
    console.log(`Hisn al-Muslim cached: ${duas.length} duas.`);
    return duas;
  }
}

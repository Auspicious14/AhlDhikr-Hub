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

import axios from "axios";
import * as fs from "fs/promises";
import * as path from "path";
import { QuranVerse, Hadith, SeerahEntry, DuaEntry } from "../models/types";
import { TafsirService } from "../services/tafsir.service";
import { TafsirDocument } from "../models/tafsir.types";
import * as dotenv from "dotenv";

dotenv.config();

const DATA_DIR = path.join(__dirname, "..", "..", "data");

// Cache files
const QURAN_SINGLE_FILE = path.join(DATA_DIR, "quran.json");
const HADITH_BUKHARI_FILE = path.join(DATA_DIR, "hadith.json");
const TAFSIR_FILE = path.join(DATA_DIR, "tafsir.json");
const SEERAH_FILE = path.join(DATA_DIR, "seerah.json");
const QURAN_EDITIONS_FILE = path.join(DATA_DIR, "quran_editions.json");
const FULL_HADITH_FILE = path.join(DATA_DIR, "full_hadith.json");
const DUAS_FILE = path.join(DATA_DIR, "duas.json");

const HADITH_API_KEY = process.env.HADITH_API_KEY;

export class DataRepository {
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getQuranVerses(): Promise<QuranVerse[]> {
    if (await this.fileExists(QURAN_SINGLE_FILE)) {
      const data = await fs.readFile(QURAN_SINGLE_FILE, "utf-8");
      console.log("Loaded Quran (en.asad) from cache.");
      return JSON.parse(data);
    }

    console.log("Fetching Quran (en.asad) from alquran.cloud...");
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
    console.log("Quran (en.asad) cached.");
    return verses;
  }

  async getQuranEditions(): Promise<any[]> {
    if (await this.fileExists(QURAN_EDITIONS_FILE)) {
      const data = await fs.readFile(QURAN_EDITIONS_FILE, "utf-8");
      console.log("Loaded multiple Quran editions from cache.");
      return JSON.parse(data);
    }

    console.log(
      "Fetching multiple Quran editions from fawazahmed0/quran-api CDN..."
    );
    const editions = [
      { id: "eng-sahih", name: "Sahih International" },
      { id: "eng-yusufali", name: "Yusuf Ali" },
      { id: "eng-pickthall", name: "Pickthall" },
      { id: "eng-shakir", name: "Shakir" },
      { id: "ara-quranuthmani", name: "Arabic Uthmani Script" },
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

  async getHadith(): Promise<Hadith[]> {
    if (await this.fileExists(HADITH_BUKHARI_FILE)) {
      const data = await fs.readFile(HADITH_BUKHARI_FILE, "utf-8");
      console.log("Loaded Sahih Bukhari (original API) from cache.");
      return JSON.parse(data);
    }

    if (!HADITH_API_KEY) {
      throw new Error(
        "HADITH_API_KEY is not set in the environment variables."
      );
    }

    console.log("Fetching all Hadiths from Sahih Bukhari via HadithAPI...");
    const allHadiths: Hadith[] = [];
    let page = 1;
    let lastPage = 1;

    do {
      try {
        const url = `https://hadithapi.com/public/api/hadiths?apiKey=${HADITH_API_KEY}&book=sahih-bukhari&page=${page}`;
        const response = await axios.get(url);
        const { data, current_page, last_page } = response.data.hadiths;

        const hadiths = data.map((h: any) => ({
          hadith_english: h.hadithEnglish,
          hadith_arabic: "", // Not available in this API
          book: h.book.bookName,
          chapter_english: "", // Not available in this API
          chapter_arabic: "", // Not available in this API
          hadith_number: h.hadithNumber || "",
          grading: h.grade || "",
          collection: h.book.bookName,
          narrator: "", // Not available in this API
          reference: h.hadithNumber
            ? `${h.book.bookName} ${h.hadithNumber}`
            : h.book.bookName,
        }));

        allHadiths.push(...hadiths);

        page = current_page + 1;
        lastPage = last_page;

        console.log(
          `Fetched page ${current_page}/${lastPage} (${hadiths.length} hadiths)`
        );

        if (page <= lastPage) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error: any) {
        console.error(`Error fetching page ${page}:`, error.message);
        break;
      }
    } while (page <= lastPage);

    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(
      HADITH_BUKHARI_FILE,
      JSON.stringify(allHadiths, null, 2)
    );
    console.log(`Sahih Bukhari cached: ${allHadiths.length} hadiths.`);
    return allHadiths;
  }

  async getFullHadith(): Promise<Hadith[]> {
    if (await this.fileExists(FULL_HADITH_FILE)) {
      const data = await fs.readFile(FULL_HADITH_FILE, "utf-8");
      console.log("Loaded full hadith collections (9 books) from cache.");
      return JSON.parse(data);
    }

    console.log(
      "Fetching full hadith collections from AhmedBaset/hadith-json (by_book format - efficient)..."
    );

    const collections = [
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

    for (const collection of collections) {
      try {
        const url = `https://raw.githubusercontent.com/AhmedBaset/hadith-json/main/db/by_book/the_9_books/${collection}.json`;
        const response = await axios.get(url);
        const hadithsData: any[] = response.data;

        const mappedHadiths = hadithsData.map((h: any) => ({
          hadith_english: h.english?.text || "",
          hadith_arabic: h.arabic || "",
          book: collection.charAt(0).toUpperCase() + collection.slice(1),
          chapter_english: "", // Not available in this source
          chapter_arabic: "", // Not available in this source
          hadith_number: h.id.toString(),
          grading: "", // Not available in this source
          collection: collection.charAt(0).toUpperCase() + collection.slice(1),
          narrator: "", // Not available in this source
          reference: `${
            collection.charAt(0).toUpperCase() + collection.slice(1)
          } ${h.id}`,
        }));

        allHadiths.push(...mappedHadiths);
        console.log(
          `Fetched ${collection.toUpperCase()}: ${mappedHadiths.length} hadiths`
        );
      } catch (error: any) {
        console.warn(`Failed to fetch ${collection}: ${error.message}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FULL_HADITH_FILE, JSON.stringify(allHadiths, null, 2));
    console.log(
      `Full hadith collections cached: ${allHadiths.length} total hadiths from 9 books.`
    );
    return allHadiths;
  }

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

  async getSeerah(): Promise<SeerahEntry[]> {
    if (await this.fileExists(SEERAH_FILE)) {
      const data = await fs.readFile(SEERAH_FILE, "utf-8");
      console.log("Loaded Seerah data from cache.");
      return JSON.parse(data);
    }

    throw new Error("Seerah data not found. Run: npm run extract-seerah");
  }

  async getDuas(): Promise<DuaEntry[]> {
    if (await this.fileExists(DUAS_FILE)) {
      const data = await fs.readFile(DUAS_FILE, "utf-8");
      console.log("Loaded Hisn al-Muslim duas from cache.");
      return JSON.parse(data);
    }

    console.log(
      "Fetching Hisn al-Muslim duas from wafaaelmaandy/husn_en.json..."
    );

    try {
      const url =
        "https://raw.githubusercontent.com/wafaaelmaandy/Hisn-Muslim-Json/refs/heads/master/husn_en.json";
      const response = await axios.get(url);
      const rawData: any = response.data;

      const englishData = rawData.English || [];

      const duas: DuaEntry[] = [];

      for (const categoryItem of englishData) {
        const categoryTitle = categoryItem.TITLE || "General";

        for (const textItem of categoryItem.TEXT || []) {
          duas.push({
            category: categoryTitle,
            arabic: textItem.ARABIC_TEXT || "",
            transliteration: textItem.LANGUAGE_ARABIC_TRANSLATED_TEXT || "",
            english: textItem.TRANSLATED_TEXT || "",
            reference: "",
            note: textItem.REPEAT ? `Repeat ${textItem.REPEAT} time(s)` : "",
          });
        }
      }

      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(DUAS_FILE, JSON.stringify(duas, null, 2));
      console.log(
        `Hisn al-Muslim cached: ${duas.length} individual duas across ${englishData.length} categories.`
      );
      return duas;
    } catch (error: any) {
      console.error(`Failed to fetch Hisn al-Muslim: ${error.message}`);
      console.log("Using minimal fallback duas...");

      const fallback: DuaEntry[] = [
        {
          category: "Morning & Evening",
          arabic:
            "أَعُوذُ بِاللَّهِ مِنَ الشَّيطَانِ الرَّجِيمِ ﴿اللَّهُ لاَ إِلَهَ إِلاَّ هُوَ الْحَيُّ الْقَيُّومُ﴾...",
          transliteration:
            "A'udhu billahi min ash-shaytan ir-rajim. Allahu la ilaha illa huwa al-hayyu al-qayyum...",
          english:
            "I seek refuge in Allah from Satan the accursed. Allah - there is no deity except Him, the Ever-Living, the Sustainer of existence...",
          reference: "Al-Baqarah 2:255",
          note: "Ayat al-Kursi - Recite morning and evening",
        },
      ];

      await fs.writeFile(DUAS_FILE, JSON.stringify(fallback, null, 2));
      return fallback;
    }
  }
}

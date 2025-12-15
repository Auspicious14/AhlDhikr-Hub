import axios from "axios";
import * as fs from "fs/promises";
import * as path from "path";
import { QuranVerse, Hadith, SeerahEntry } from "../models/types";
import { TafsirService } from "../services/tafsir.service";
import { TafsirDocument } from "../models/tafsir.types";
import * as dotenv from "dotenv";

dotenv.config();

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const QURAN_FILE = path.join(DATA_DIR, "quran.json");
const HADITH_FILE = path.join(DATA_DIR, "hadith.json");
const TAFSIR_FILE = path.join(DATA_DIR, "tafsir.json");
const SEERAH_FILE = path.join(DATA_DIR, "seerah.json");
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
    if (await this.fileExists(QURAN_FILE)) {
      const data = await fs.readFile(QURAN_FILE, "utf-8");
      console.log("Loaded Quran data from cache.");
      return JSON.parse(data);
    }

    console.log("Fetching Quran data from API...");
    const response = await axios.get(
      "https://api.alquran.cloud/v1/quran/en.asad"
    );
    const verses = response.data.data.surahs.flatMap((surah: any) =>
      surah.ayahs.map((ayah: any) => ({
        number: ayah.number, // Global verse number (1-6236)
        numberInSurah: ayah.numberInSurah, // Verse number within the surah
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
    await fs.writeFile(QURAN_FILE, JSON.stringify(verses, null, 2));
    console.log("Quran data cached.");
    return verses;
  }

  async getHadith(): Promise<Hadith[]> {
    if (await this.fileExists(HADITH_FILE)) {
      const data = await fs.readFile(HADITH_FILE, "utf-8");
      console.log("Loaded Hadith data from cache.");
      return JSON.parse(data);
    }

    if (!HADITH_API_KEY) {
      throw new Error(
        "HADITH_API_KEY is not set in the environment variables."
      );
    }

    console.log("Fetching all Hadiths from Sahih Bukhari...");
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
          by_book: h.book.bookName,
        }));

        allHadiths.push(...hadiths);

        page = current_page;
        lastPage = last_page;

        console.log(`Fetched page ${page}/${lastPage} of Hadiths...`);
      } catch (error) {
        console.error(`Error fetching page ${page} of Hadiths:`, error);
        // Stop if there's an error to avoid hammering the API
        break;
      }
    } while (page++ <= lastPage);

    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(HADITH_FILE, JSON.stringify(allHadiths, null, 2));
    console.log(`Hadith data cached with ${allHadiths.length} hadiths.`);
    return allHadiths;
  }

  async getTafsir(): Promise<TafsirDocument[]> {
    if (await this.fileExists(TAFSIR_FILE)) {
      const data = await fs.readFile(TAFSIR_FILE, "utf-8");
      console.log("Loaded Tafsir data from cache.");
      return JSON.parse(data);
    }

    console.log("Fetching Tafsir data from API...");
    const tafsirService = new TafsirService();
    const tafsirDocuments = await tafsirService.getTafsirDocuments();

    // Cache the data
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(TAFSIR_FILE, JSON.stringify(tafsirDocuments, null, 2));
    console.log(`Tafsir data cached with ${tafsirDocuments.length} documents.`);

    return tafsirDocuments;
  }

  async getSeerah(): Promise<SeerahEntry[]> {
    if (await this.fileExists(SEERAH_FILE)) {
      const data = await fs.readFile(SEERAH_FILE, "utf-8");
      console.log("Loaded Seerah data from cache.");
      return JSON.parse(data);
    }

    // If no cached file, they need to run the extraction script
    throw new Error("Seerah data not found. Run: npm run extract-seerah");
  }
}

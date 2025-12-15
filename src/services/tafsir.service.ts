import axios from "axios";
import * as fs from "fs/promises";
import * as path from "path";
import { TafsirData, TafsirDocument } from "../models/tafsir.types";
import * as dotenv from "dotenv";

dotenv.config();

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const TAFSIR_FILE = path.join(DATA_DIR, "tafsir.json");

export class TafsirService {
  private readonly TAFSIR_BASE_URL =
    "https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir";
  private readonly SUPPORTED_TAFSIRS = [
    "en-tafisr-ibn-kathir",
    "en-tafsir-ibn-abbas",
  ];

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getTafsirDocuments(): Promise<TafsirDocument[]> {
    if (await this.fileExists(TAFSIR_FILE)) {
      const data = await fs.readFile(TAFSIR_FILE, "utf-8");
      console.log("Loaded Tafsir data from cache.");
      return JSON.parse(data);
    }

    console.log("Fetching Tafsir data from API...");
    const allTafsirDocuments: TafsirDocument[] = [];

    // Fetch tafsir for all 114 surahs
    for (let surah = 1; surah <= 114; surah++) {
      console.log(`Processing Surah ${surah}/114...`);

      for (const tafsirType of this.SUPPORTED_TAFSIRS) {
        try {
          const url = `${this.TAFSIR_BASE_URL}/${tafsirType}/${surah}.json`;
          const response = await axios.get<TafsirData>(url);

          if (response.data && response.data.ayahs) {
            const tafsirDocs = response.data.ayahs.map((ayah) => ({
              text: ayah.text,
              source: `Tafsir ${this.formatTafsirName(
                tafsirType
              )} - Surah ${surah}:${ayah.ayah}`,
              surah: surah,
              ayah: ayah.ayah,
              tafsirType: tafsirType,
            }));

            allTafsirDocuments.push(...tafsirDocs);
          }
        } catch (error: any) {
          console.warn(
            `Failed to fetch ${tafsirType} for Surah ${surah}:`,
            error.message
          );
          // Continue with other tafsirs even if one fails
          continue;
        }
      }

      // Add delay to avoid rate limiting
      if (surah < 114) {
        await this.delay(500);
      }
    }

    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(
      TAFSIR_FILE,
      JSON.stringify(allTafsirDocuments, null, 2)
    );
    console.log(
      `Tafsir data cached with ${allTafsirDocuments.length} documents.`
    );
    return allTafsirDocuments;
  }

  private formatTafsirName(tafsirType: string): string {
    const nameMap: { [key: string]: string } = {
      "en-tafisr-ibn-kathir": "Ibn Kathir",
      "en-tafsir-maariful-quran": "Maariful Quran",
      "en-tafsir-qurtubi": "Qurtubi",
      "en-tafsir-tablighi": "Tablighi",
      "en-tafsir-jalalayn": "Jalalayn",
    };
    return nameMap[tafsirType] || tafsirType;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getTafsirBySurah(surah: number): Promise<TafsirDocument[]> {
    const allTafsir = await this.getTafsirDocuments();
    return allTafsir.filter((doc) => doc.surah === surah);
  }

  async getTafsirBySurahAndAyah(
    surah: number,
    ayah: number
  ): Promise<TafsirDocument[]> {
    const allTafsir = await this.getTafsirDocuments();
    return allTafsir.filter((doc) => doc.surah === surah && doc.ayah === ayah);
  }
}

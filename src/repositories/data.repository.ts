import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import { QuranVerse, Hadith } from '../models/types';

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const QURAN_FILE = path.join(DATA_DIR, 'quran.json');
const HADITH_FILE = path.join(DATA_DIR, 'hadith.json');

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
      const data = await fs.readFile(QURAN_FILE, 'utf-8');
      return JSON.parse(data);
    }

    console.log('Fetching Quran data from API...');
    const response = await axios.get('https://api.alquran.cloud/v1/quran/en.asad');
    const verses = response.data.data.surahs.flatMap((surah: any) =>
      surah.ayahs.map((ayah: any) => ({
        number: ayah.number,
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
    console.log('Quran data cached.');
    return verses;
  }

  async getHadith(count: number = 1000): Promise<Hadith[]> {
    if (await this.fileExists(HADITH_FILE)) {
      const data = await fs.readFile(HADITH_FILE, 'utf-8');
      return JSON.parse(data);
    }

    console.log(`Fetching ${count} Hadith from API...`);
    const hadiths: Hadith[] = [];
    // Use Promise.all for concurrent fetching to speed up the process
    const promises = Array.from({ length: count }, () =>
      axios.get('https://random-hadith-generator.vercel.app/api/bukhari')
        .then(response => ({
          hadith_english: response.data.hadith_english,
          by_book: response.data.by_book,
        }))
        .catch(error => {
          console.error('Failed to fetch a hadith:', error.message);
          return null; // Return null on failure to not break Promise.all
        })
    );

    const results = await Promise.all(promises);
    hadiths.push(...results.filter((h): h is Hadith => h !== null)); // Filter out any null results from failed requests

    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(HADITH_FILE, JSON.stringify(hadiths, null, 2));
    console.log('Hadith data cached.');
    return hadiths;
  }
}

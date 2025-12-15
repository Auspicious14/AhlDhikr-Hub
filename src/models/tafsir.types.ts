export interface TafsirAyah {
  ayah: number;
  surah: number;
  text: string;
}

export interface TafsirData {
  ayahs: TafsirAyah[];
}

export interface TafsirDocument {
  text: string;
  source: string;
  surah: number;
  ayah: number;
  tafsirType: string;
}
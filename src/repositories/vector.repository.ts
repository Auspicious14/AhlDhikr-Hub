import { HierarchicalNSW } from 'hnswlib-node';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Metadata } from '../models/types';

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const INDEX_PATH = path.join(DATA_DIR, 'islamic_index.bin');
const METADATA_PATH = path.join(DATA_DIR, 'islamic_metadata.json');
const DIMENSION = 768; // Dimension for the 'embedding-001' model

export class VectorRepository {
  private index: HierarchicalNSW;

  constructor() {
    this.index = new HierarchicalNSW('cosine', DIMENSION);
  }

  async saveIndex(metadata: Metadata[]): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await this.index.writeIndex(INDEX_PATH);
    await fs.writeFile(METADATA_PATH, JSON.stringify(metadata, null, 2));
    console.log('Vector index and metadata saved to disk.');
  }

  async loadIndex(): Promise<{ index: HierarchicalNSW; metadata: Metadata[] } | null> {
    try {
      await this.index.readIndex(INDEX_PATH, false);
      const metadataFile = await fs.readFile(METADATA_PATH, 'utf-8');
      const metadata = JSON.parse(metadataFile);
      console.log('Vector index and metadata loaded from disk.');
      return { index: this.index, metadata };
    } catch (error) {
      console.log('Could not find index on disk.');
      return null;
    }
  }

  initIndex(numPoints: number): void {
    this.index.initIndex(numPoints);
  }

  addPoint(embedding: number[], id: number): void {
    this.index.addPoint(embedding, id);
  }

  search(embedding: number[], k: number): number[] {
    const { neighbors } = this.index.searchKnn(embedding, k);
    return neighbors;
  }
}

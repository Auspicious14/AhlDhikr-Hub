import { HierarchicalNSW } from "hnswlib-node";

const DEFAULT_DIMENSION = 768;

export class VectorRepository {
  private index: HierarchicalNSW;
  private dimension: number;

  constructor(dimension?: number) {
    this.dimension = dimension || DEFAULT_DIMENSION;
    this.index = new HierarchicalNSW("cosine", this.dimension);
    console.log(
      `📐 Vector repository initialized with dimension: ${this.dimension}`
    );
  }

  initIndex(numPoints: number): void {
    try {
      this.index.initIndex(numPoints);
    } catch (e) {
      this.index = new HierarchicalNSW("cosine", this.dimension);
      this.index.initIndex(numPoints);
    }
  }

  addPoint(embedding: number[], id: number): void {
    try {
      this.index.addPoint(embedding, id);
    } catch (e) {
      // If we hit the capacity limit, resize the index
      if (
        e instanceof Error &&
        e.message.includes("exceeds the specified limit")
      ) {
        console.log(
          `Resizing index from ${this.index.getMaxElements()} to ${
            this.index.getMaxElements() * 5
          }`
        );
        this.index.resizeIndex(this.index.getMaxElements() * 5);
        // Retry adding the point after resizing
        this.index.addPoint(embedding, id);
      } else {
        throw e;
      }
    }
  }

  search(embedding: number[], k: number): number[] {
    try {
      // Keep high ef for good recall
      this.index.setEf(Math.max(k * 20, 100));

      const { neighbors } = this.index.searchKnn(embedding, k);
      return neighbors;
    } catch (e) {
      console.error("Error searching index:", e);
      return [];
    }
  }

  getCurrentCount(): number {
    return this.index.getCurrentCount();
  }

  getMaxElements(): number {
    return this.index.getMaxElements();
  }
}

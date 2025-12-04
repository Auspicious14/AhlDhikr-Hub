// Type declarations for optional dependencies

declare module "@xenova/transformers" {
  export const env: {
    cacheDir: string;
  };

  export function pipeline(task: string, model: string): Promise<any>;
}

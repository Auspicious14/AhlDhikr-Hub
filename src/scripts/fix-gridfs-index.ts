import * as dotenv from "dotenv";
dotenv.config();

import {
  connectToDatabase,
  closeDatabaseConnection,
} from "../services/mongo.service";

const run = async () => {
  try {
    const db = await connectToDatabase();
    const chunksCollection = db.collection("vector_index_files.chunks");
    const filesCollection = db.collection("vector_index_files.files");

    console.log("Creating indexes for GridFS bucket 'vector_index_files'...");

    // Index for chunks: { files_id: 1, n: 1 } - Critical for download sort
    console.log("Creating index { files_id: 1, n: 1 } on chunks...");
    await chunksCollection.createIndex({ files_id: 1, n: 1 }, { unique: true });
    console.log("Index created on chunks.");

    // Index for files: { filename: 1, uploadDate: 1 } - Useful for finding files
    console.log("Creating index { filename: 1, uploadDate: 1 } on files...");
    await filesCollection.createIndex({ filename: 1, uploadDate: 1 });
    console.log("Index created on files.");

    console.log("Successfully fixed GridFS indexes.");
  } catch (error) {
    console.error("Error fixing GridFS indexes:", error);
  } finally {
    await closeDatabaseConnection();
  }
};

run();

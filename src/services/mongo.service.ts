import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  // We allow this to be empty during build steps, where the DB is not needed.
  // The services that actually use the DB will throw the error at runtime.
  console.warn('MONGODB_URI is not set. Database services will not be available.');
}

let db: Db;
let client: MongoClient;

/**
 * Establishes a connection to the MongoDB database.
 * It uses a singleton pattern to ensure only one connection is created.
 * @returns A promise that resolves to the Db instance.
 */
export const connectToDatabase = async (): Promise<Db> => {
  if (db) {
    return db;
  }

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not set. Cannot connect to the database.');
  }

  client = new MongoClient(MONGODB_URI);
  await client.connect();
  // Using the default database specified in the connection string.
  // You can override this by passing a database name to client.db().
  db = client.db();
  console.log('Successfully connected to MongoDB.');
  return db;
};

/**
 * Returns the existing database instance.
 * Throws an error if the database has not been initialized.
 * @returns The Db instance.
 */
export const getDb = (): Db => {
  if (!db) {
    throw new Error('Database not initialized. Call connectToDatabase first.');
  }
  return db;
};

/**
 * Closes the MongoDB connection.
 */
export const closeDatabaseConnection = async () => {
  if (client) {
    await client.close();
    console.log('MongoDB connection closed.');
  }
};

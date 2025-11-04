# Islamic Q&A Platform with Gemini 1.5 Flash

This project is a TypeScript and Node.js-based backend for an Islamic Q&A platform. It uses Google's Gemini 1.5 Flash for natural language processing and `hnswlib-node` for efficient vector search. The system answers questions based on a knowledge base of Quranic verses and Hadith.

## Features

-   **RAG (Retrieval-Augmented Generation):** The system retrieves relevant texts from the Quran and Hadith before generating an answer.
-   **Vector Search:** Uses `hnswlib-node` for fast and efficient similarity search.
-   **Automatic Indexing:** On the first run, the platform automatically builds a vector index of over 1000 Quranic verses and Hadith.
-   **REST API:** Exposes endpoints for asking questions and rebuilding the index.
-   **CLI Demo:** Includes a command-line interface for testing and demonstration.
-   **Caching:** Caches the Quran and Hadith data to disk to avoid repeated downloads.

## Prerequisites

-   Node.js (v14 or later)
-   npm
-   A Google Gemini API key

## Setup

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-username/islamic-qa-gemini.git
    cd islamic-qa-gemini
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Set up your environment variables:**

    Create a `.env` file in the root of the project and add your Gemini API key:

    ```
    GEMINI_API_KEY=your_gemini_api_key
    ```

4.  **Build the project:**

    ```bash
    npm run build
    ```

## Usage

### Building the Vector Index

The first time you run the application, it will automatically build the vector index. You can also manually trigger this process:

```bash
npm run build-index
```

This will fetch the Quran and Hadith data, generate embeddings, and save the index to the `data` directory.

### Running the API Server

To start the Express.js server, run:

```bash
npm start
```

The server will be available at `http://localhost:3000`.

#### API Endpoints

-   `GET /api/ask?question=<your_question>`

    This endpoint accepts a question as a query parameter and returns a JSON object with the answer and the sources used to generate it.

-   `POST /api/build-index`

    This endpoint rebuilds the vector index.

### Using the CLI Demo

To use the interactive command-line interface, run:

```bash
npm run cli
```

The CLI will load the index and prompt you to ask questions.

## Project Structure

```
.
├── data/                 # Cached data and vector index
├── dist/                 # Compiled JavaScript files
├── node_modules/         # Node.js modules
├── src/                  # TypeScript source files
│   ├── api.ts            # Express API routes
│   ├── cli.ts            # Command-line interface
│   ├── data-fetcher.ts   # Fetches Quran and Hadith data
│   ├── gemini-client.ts  # Interacts with the Gemini API
│   ├── index.ts          # Main application entry point
│   └── vector-store.ts   # Manages the vector index
├── .env                  # Environment variables
├── .gitignore            # Git ignore file
├── package.json          # Project dependencies and scripts
├── tsconfig.json         # TypeScript compiler options
└── README.md             # This file
```

## How It Works

1.  **Data Fetching:** The `data-fetcher.ts` script downloads the entire Quran in English and a collection of over 1000 Hadith from the Sahih Bukhari collection. The data is cached in the `data` directory.
2.  **Vector Indexing:** The `vector-store.ts` script uses the Gemini embedding model to generate vector representations of each Quranic verse and Hadith. These vectors are then stored in an `hnswlib-node` index for efficient similarity search.
3.  **Querying:** When a question is asked, the system generates an embedding for the question and uses the vector index to find the most relevant texts from the knowledge base.
4.  **Answer Generation:** The retrieved texts are then passed to the Gemini 1.5 Flash model along with a system prompt that instructs the model to answer the question based only on the provided sources.

## License

This project is licensed under the ISC License.

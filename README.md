# AhlDhikr Hub - Islamic Q&A Backend

An intelligent Islamic Q&A platform powered by AI, providing answers sourced from the Quran and authentic Hadith using Retrieval Augmented Generation (RAG).

## 🌟 Features

### Core Functionality

- **AI-Powered Q&A**: Ask questions about Islam and get answers with source citations
- **Streaming Responses**: Real-time ChatGPT-like streaming answers
- **Vector Search**: Semantic search across 7,736 Islamic documents (Quran + Hadith)
- **Source Citations**: Every answer includes references to Quran verses and Hadith
- **Multiple Embedding Providers**: Support for Gemini, Hugging Face, and local embeddings

### Technical Features

- **RESTful API**: Express.js backend with clean architecture
- **MongoDB Storage**: Persistent storage for Q&A history and vector index
- **Server-Sent Events (SSE)**: Real-time streaming for live answer generation
- **Rate Limiting**: Configurable delays to respect API quotas
- **Smart Sampling**: Process documents efficiently without data loss

## 🏗️ Architecture

### Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ODM)
- **AI Model**: Google Gemini 2.5 Flash Lite
- **Vector Search**: HNSW (Hierarchical Navigable Small World)
- **Embeddings**: Local (Transformers.js), Hugging Face, or Gemini

### Project Structure

```
src/
├── controllers/        # Request handlers
│   └── qa.controller.ts
├── services/          # Business logic
│   ├── qa.service.ts
│   ├── vector.service.ts
│   ├── gemini.service.ts
│   ├── embedding.service.ts
│   ├── huggingface.service.ts
│   ├── local-embedding.service.ts
│   └── category.service.ts
├── repositories/      # Data access layer
│   ├── data.repository.ts
│   ├── vector.repository.ts
│   ├── answer.repository.ts
│   └── category.repository.ts
├── models/           # Data models
│   ├── answer.ts
│   ├── category.ts
│   └── types.ts
├── routes/           # API routes
│   └── api.routes.ts
├── cli.ts           # Command-line interface
└── index.ts         # Application entry point
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- API Keys:
  - Google Gemini API key
  - Hadith API key
  - (Optional) Hugging Face API key

### Installation

1. **Clone and install dependencies:**

```bash
npm install
```

2. **Configure environment variables:**
   Create a `.env` file:

```env
# Required
GEMINI_API_KEY=your_gemini_api_key
HADITH_API_KEY=your_hadith_api_key
MONGODB_URI=mongodb://localhost:27017/ahldhikr-hub

# Embedding Provider (auto-detects if not set)
EMBEDDING_PROVIDER=local  # Options: local, huggingface, gemini

# Optional: Hugging Face (if using huggingface provider)
HUGGINGFACE_API_KEY=your_hf_token
HUGGINGFACE_MODEL=BAAI/bge-small-en-v1.5

# Performance Tuning
MAX_DOCUMENTS_TO_INDEX=7736
EMBEDDING_DELAY_MS=200

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

3. **Build the project:**

```bash
npm run build
```

4. **Build the vector index:**

```bash
npm run build-index
```

_This processes all Quran verses and Hadith (~30-45 minutes for 7,736 documents)_

5. **Start the server:**

```bash
npm start
```

Server runs on `http://localhost:3000`

## 📡 API Endpoints

### POST `/api/ask-stream`

Stream AI-generated answers in real-time.

**Request:**

```json
{
  "question": "What is prayer in Islam?"
}
```

**Response:** Server-Sent Events (SSE)

```
event: connected
data: {"message":"Connected to streaming service"}

event: thinking
data: {"message":"Searching for relevant sources..."}

event: sources
data: {"sources":[...],"count":10}

event: answer-chunk
data: {"chunk":"Prayer in Islam..."}

event: done
data: {"slug":"what-is-prayer-in-islam","saved":true}
```

### POST `/api/ask`

Get complete answer (non-streaming).

**Request:**

```json
{
  "question": "What is Zakat?"
}
```

**Response:**

```json
{
  "question": "What is Zakat?",
  "slug": "what-is-zakat",
  "answer": "Zakat is...",
  "sources": [
    {
      "citation": "Quran Al-Baqarah 2:43",
      "type": "Qur'an",
      "text": "And establish prayer and give zakah..."
    }
  ],
  "category": "Quran"
}
```

### GET `/api/ask/:slug`

Retrieve a saved answer by slug.

### GET `/api/recent-questions?limit=10`

Get recent questions.

### POST `/api/build-index`

Trigger index rebuild (background process).

## 🎯 Embedding Providers

### Local Embeddings (Recommended)

- **Pros**: Free, unlimited, offline, privacy
- **Cons**: Slower (~3-4 docs/sec)
- **Setup**: `npm install @xenova/transformers`

### Hugging Face

- **Pros**: Fast, 30k requests/month free
- **Cons**: Requires API key, online only
- **Setup**: Get token from https://huggingface.co/settings/tokens

### Gemini

- **Pros**: High quality
- **Cons**: Very low free tier (~100 requests)
- **Setup**: Already configured for Q&A

## 🔧 Configuration

### Environment Variables

| Variable                 | Required | Default | Description                         |
| ------------------------ | -------- | ------- | ----------------------------------- |
| `GEMINI_API_KEY`         | Yes      | -       | Google Gemini API key               |
| `HADITH_API_KEY`         | Yes      | -       | Hadith API key                      |
| `MONGODB_URI`            | Yes      | -       | MongoDB connection string           |
| `EMBEDDING_PROVIDER`     | No       | auto    | `local`, `huggingface`, or `gemini` |
| `HUGGINGFACE_API_KEY`    | No       | -       | HF token (if using HF)              |
| `MAX_DOCUMENTS_TO_INDEX` | No       | 7736    | Number of documents to process      |
| `EMBEDDING_DELAY_MS`     | No       | 200     | Delay between API calls (ms)        |
| `FRONTEND_URL`           | No       | -       | Frontend URL for CORS               |

### Data Sources

**Quran:**

- API: https://api.alquran.cloud/v1/quran/en.asad
- Translation: Muhammad Asad
- Total verses: 6,236

**Hadith:**

- Source: Sahih Bukhari
- Total hadiths: 1,500

## 🛠️ Development

### Available Scripts

```bash
npm run dev        # Development with auto-reload
npm run build      # Compile TypeScript
npm start          # Start production server
npm run cli        # Interactive CLI for testing
npm run build-index # Build vector index
```

### CLI Usage

Test the Q&A system interactively:

```bash
npm run cli
```

Then ask questions:

```
Ask a question: What is fasting in Islam?
```

## 📊 Performance

### Index Building

- **Documents**: 7,736 (6,236 Quran + 1,500 Hadith)
- **Time**: ~30-45 minutes (local embeddings)
- **Storage**: ~90MB (model) + MongoDB index

### Query Performance

- **Search**: <100ms (vector search)
- **Answer Generation**: 2-5 seconds (streaming)
- **Embedding**: ~250ms per query

## 🔍 How It Works

1. **Question Received**: User asks a question
2. **Embedding**: Question converted to vector (384 dimensions)
3. **Vector Search**: Find 10 most relevant sources using cosine similarity
4. **Context Building**: Format sources with citations
5. **AI Generation**: Gemini generates answer using only provided sources
6. **Streaming**: Answer streamed word-by-word to client
7. **Storage**: Q&A saved to MongoDB for history

## 🐛 Troubleshooting

### Index Build Fails

- **Check MongoDB connection**: Ensure MongoDB is running
- **Check API keys**: Verify Gemini and Hadith API keys
- **Reduce documents**: Set `MAX_DOCUMENTS_TO_INDEX=100` for testing

### Slow Performance

- **Use local embeddings**: No API rate limits
- **Increase delay**: Set `EMBEDDING_DELAY_MS=500`
- **Reduce search results**: Modify `search(question, 10)` to `search(question, 5)`

### Duplicate Key Errors

- **Handled automatically**: System updates existing answers
- **Manual fix**: Delete from MongoDB: `db.answers.deleteOne({slug: "question-slug"})`

### Wrong Verse References

- **Delete cached data**: `rm data/quran.json`
- **Rebuild index**: `npm run build-index`

## 📚 Data Models

### Answer

```typescript
{
  question: string;
  slug: string;
  answer: string;
  answerSnippet: string;
  source: string;
  category: string;
  sources: [{
    citation: string;
    type: 'Hadith' | 'Qur\'an';
    text: string;
    url?: string;
    arabic?: string;
  }];
  createdAt: Date;
  updatedAt: Date;
}
```

### Vector Index

- **Algorithm**: HNSW (Hierarchical Navigable Small World)
- **Metric**: Cosine similarity
- **Dimensions**: 384 (local/HF) or 768 (Gemini)
- **Storage**: MongoDB Binary

## 🔐 Security

- **CORS**: Configured for frontend URL
- **Input Validation**: Question length limits
- **Rate Limiting**: Configurable delays
- **Error Handling**: Graceful error responses
- **No User Data**: Questions stored without user association

## 📝 License

ISC

## 👥 Author

Auspicious

## 🙏 Acknowledgments

- Muhammad Asad for Quran translation
- Sahih Bukhari for authentic Hadith
- Google Gemini for AI capabilities
- Hugging Face for embedding models
- AlQuran Cloud for Quran API

---

**Built with ❤️ for the Muslim community**

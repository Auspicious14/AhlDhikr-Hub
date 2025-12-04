# Vector Index Optimization - Summary

## Problem

You were hitting Gemini API quota limits when trying to generate embeddings for 7,736 documents (Quran verses + Hadiths). The error showed:

- 429 Too Many Requests
- Quota exceeded for embedding requests

## Solution Implemented

I've reduced the data processing **without deleting any data** by implementing:

### 1. **Intelligent Document Sampling**

- The system now samples documents evenly from both Quran and Hadith collections
- Default: processes 1,000 documents instead of 7,736
- Maintains proportional representation from both sources
- Uses evenly-distributed sampling (not random) to ensure coverage across all content

### 2. **Rate Limiting**

- Added configurable delay between API requests (default: 100ms)
- Prevents hitting rate limits by spacing out requests
- Fully configurable via environment variables

### 3. **Configuration Options**

Two new environment variables in your `.env` file:

```bash
# Maximum documents to process (default: 1000)
MAX_DOCUMENTS_TO_INDEX=1000

# Delay between requests in milliseconds (default: 100)
EMBEDDING_DELAY_MS=100
```

## How to Use

### Option 1: Use Defaults (Recommended for Free Tier)

Just add these lines to your `.env` file:

```bash
MAX_DOCUMENTS_TO_INDEX=1000
EMBEDDING_DELAY_MS=100
```

### Option 2: Adjust Based on Your API Tier

- **Free Tier**: Use 500-1000 documents, 200ms delay
- **Pro Tier**: Use 2000-3000 documents, 100ms delay
- **Enterprise**: Use higher limits, lower delays

### Option 3: Start Small and Scale Up

```bash
# Start with just 500 documents
MAX_DOCUMENTS_TO_INDEX=500
EMBEDDING_DELAY_MS=200
```

## What Changed in the Code

### `vector.service.ts`

1. Added document sampling logic that:

   - Reads the `MAX_DOCUMENTS_TO_INDEX` from environment
   - Calculates proportional samples from Quran and Hadith
   - Uses evenly-distributed sampling for better coverage

2. Added rate limiting:

   - Reads `EMBEDDING_DELAY_MS` from environment
   - Adds delay between each embedding request
   - Shows progress with percentage completion

3. Added helper methods:
   - `sampleDocuments<T>()`: Evenly samples from any array
   - `delay()`: Adds configurable delays

### `.env.example`

Added documentation for the new configuration variables

### `README.md`

Updated setup instructions to document the new options

## Benefits

✅ **No data deleted** - All original data remains intact  
✅ **Configurable** - Adjust limits based on your API tier  
✅ **Smart sampling** - Evenly distributed, not random  
✅ **Rate limit protection** - Prevents quota errors  
✅ **Better progress tracking** - Shows percentage and emoji indicators

## Next Steps

1. Add the configuration to your `.env` file
2. Run `npm run build-index` again
3. Monitor the output - it should now complete successfully
4. If you still hit limits, reduce `MAX_DOCUMENTS_TO_INDEX` further
5. Once successful, you can gradually increase the limit

## Example Output

```
📊 Data Summary:
   Total available: 7736 documents
   Quran verses: 6236 (sampling 806)
   Hadiths: 1500 (sampling 194)
   Processing: 1000 documents
   Delay between requests: 100ms

🚀 Generating embeddings for 1000 documents...
   ✓ Embedded 50/1000 documents (5%)
   ✓ Embedded 100/1000 documents (10%)
   ...
```

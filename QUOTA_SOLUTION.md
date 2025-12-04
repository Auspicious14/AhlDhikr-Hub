# Progressive Index Building Strategy

## The Problem

Your Gemini API has a **daily quota limit** for embedding requests. Even with the Pro tier, you can only make a certain number of requests per day.

## Solution: Build Index Over Multiple Days

Instead of building the entire index at once, we'll build it progressively:

### Day 1: Process 100 documents

```bash
MAX_DOCUMENTS_TO_INDEX=100
EMBEDDING_DELAY_MS=500
```

### Day 2: Process next 100 documents

```bash
MAX_DOCUMENTS_TO_INDEX=200
EMBEDDING_DELAY_MS=500
```

### Continue until complete...

## Alternative: Use Smaller Initial Dataset

For testing and development, start with a **minimal viable index**:

```bash
# Just 50 documents to test the system
MAX_DOCUMENTS_TO_INDEX=50
EMBEDDING_DELAY_MS=1000
```

This will give you:

- ~40 Quran verses
- ~10 Hadiths
- Enough to test the Q&A functionality
- Won't exhaust your quota

## Check Your Quota Status

Visit: https://ai.dev/usage?tab=rate-limit

This will show you:

- How many requests you've made today
- When your quota resets
- Your current limits

## Recommended Next Steps

1. **Wait 24 hours** for quota reset
2. **Start with 50 documents** to test
3. **Check your API tier** - you might be on free tier despite having a Pro key
4. **Gradually increase** as you verify it works

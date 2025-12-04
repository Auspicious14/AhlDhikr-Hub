# Quick Start Guide: Free Embedding Alternatives

## 🎯 Recommended: Hugging Face (Best Free Option)

### Step 1: Get Your Free Hugging Face API Key

1. Go to https://huggingface.co/join
2. Sign up for a free account (no credit card required)
3. Go to https://huggingface.co/settings/tokens
4. Click "New token"
5. Give it a name (e.g., "Islamic QA")
6. Select "Read" permission
7. Click "Generate token"
8. Copy the token

### Step 2: Update Your .env File

Add these lines to your `.env` file:

```bash
# Use Hugging Face for embeddings
EMBEDDING_PROVIDER=huggingface
HUGGINGFACE_API_KEY=hf_your_token_here

# Optional: Choose a model (default is BAAI/bge-small-en-v1.5)
HUGGINGFACE_MODEL=BAAI/bge-small-en-v1.5

# Process all documents (Hugging Face free tier: 30,000/month)
MAX_DOCUMENTS_TO_INDEX=7736
EMBEDDING_DELAY_MS=100
```

### Step 3: Install Dependencies

```bash
npm install axios
```

### Step 4: Build the Index

```bash
npm run build-index
```

**Expected time**: ~15-20 minutes for all 7,736 documents

---

## 🏆 Alternative: Local Embeddings (100% Free, No API)

If you want **zero API costs** and **no rate limits**:

### Step 1: Install Transformers.js

```bash
npm install @xenova/transformers
```

### Step 2: Update Your .env File

```bash
# Use local embeddings (no API key needed!)
EMBEDDING_PROVIDER=local

# Process all documents (no limits!)
MAX_DOCUMENTS_TO_INDEX=7736
EMBEDDING_DELAY_MS=0  # No rate limits with local
```

### Step 3: Build the Index

```bash
npm run build-index
```

**Note**: First run will download the model (~90MB). Subsequent runs will be faster.

**Expected time**: ~30-45 minutes for all 7,736 documents (slower than API but free!)

---

## 📊 Comparison

| Feature              | Hugging Face | Local     | Gemini Free |
| -------------------- | ------------ | --------- | ----------- |
| **Cost**             | Free         | Free      | Free        |
| **Setup**            | Easy         | Easy      | Easy        |
| **Monthly Limit**    | 30,000       | Unlimited | Very Low    |
| **Speed**            | Fast         | Moderate  | Fast        |
| **Quality**          | Excellent    | Good      | Excellent   |
| **Offline**          | ❌           | ✅        | ❌          |
| **API Key Required** | ✅           | ❌        | ✅          |

---

## 🚀 Quick Commands

### Check which provider you're using:

```bash
# Your .env file should have:
EMBEDDING_PROVIDER=huggingface  # or 'local' or 'gemini'
```

### Build index with Hugging Face:

```bash
EMBEDDING_PROVIDER=huggingface npm run build-index
```

### Build index with local embeddings:

```bash
EMBEDDING_PROVIDER=local npm run build-index
```

---

## 🔧 Troubleshooting

### Hugging Face: "Model is loading"

- **Solution**: The script will automatically wait and retry
- First request to a model may take 10-20 seconds

### Local: "Cannot find module @xenova/transformers"

- **Solution**: Run `npm install @xenova/transformers`

### Local: First run is very slow

- **Solution**: This is normal! The model is downloading (~90MB)
- Subsequent runs will be much faster

---

## 💡 Recommendations

**For Development/Testing:**

- Use **Local** embeddings (no API limits, free forever)
- Set `MAX_DOCUMENTS_TO_INDEX=100` for quick testing

**For Production:**

- Use **Hugging Face** (faster, better quality)
- 30,000 requests/month is enough for most use cases

**If you have budget:**

- Use **OpenAI** or **Cohere** for best quality
- Or upgrade to Gemini Pro tier

---

## ✅ Next Steps

1. Choose your provider (Hugging Face recommended)
2. Update your `.env` file
3. Run `npm run build-index`
4. Test with `npm run cli`
5. Deploy your app!

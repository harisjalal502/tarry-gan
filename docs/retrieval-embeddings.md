# Retrieval And Embeddings

Research date: 2026-05-16.

## Decision

Use ZeroEntropy for GBrain retrieval embeddings:

- Embeddings: `zeroentropyai:zembed-1`
- Dimensions: `2560`
- Required env var: `ZEROENTROPY_API_KEY`

Continue using OpenAI for speech/transcription/model work where OpenAI is the better product fit. This decision only changes the GBrain embedding/retrieval layer.

## Why ZeroEntropy

ZeroEntropy's docs position `zembed-1` as their flagship multilingual embedding model. It supports asymmetric retrieval through `input_type: "query"` and `input_type: "document"`, and supports dimensions `2560`, `1280`, `640`, `320`, `160`, `80`, and `40`.

Source: https://docs.zeroentropy.dev/models

## Optional Reranker

ZeroEntropy also provides `zerank-2`, a reranker that can reorder candidate documents after initial retrieval. This is not the same as embeddings. It is a second retrieval-quality layer.

For TerryGam, the clean order is:

1. Start with `zembed-1` embeddings.
2. Once we have enough pages and queries, enable `zerank-2` reranking if retrieval quality needs a boost.

Source: https://docs.zeroentropy.dev/api-reference/models/rerank

## GBrain Config

This repo uses a project-local GBrain home at `.gbrain/` so ZeroEntropy's vector dimensions do not collide with any existing global `~/.gbrain` database.

The project-local GBrain config is initialized with:

```json
{
  "embedding_model": "zeroentropyai:zembed-1",
  "embedding_dimensions": 2560
}
```

To activate embeddings in a shell:

```bash
export ZEROENTROPY_API_KEY=...
npm run gbrain:sync
```

Do not commit real API keys.

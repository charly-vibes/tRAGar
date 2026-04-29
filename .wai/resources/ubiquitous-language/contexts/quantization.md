# Quantization context

## Scheme: symmetric int8, per-vector, post-normalization

1. L2-normalize the float32 vector → `v'`
2. `m = max(|v'ᵢ|)`
3. `scale s = m / 127.0`
4. `q[i] = round(v'[i] / s)` clamped to `[-127, 127]`
5. Store `q` (int8, length D) + `s` (float32)

## Cosine recovery
`cosine(a, b) ≈ dot(q_a, q_b) * s_a * s_b`

## Accuracy targets (D=384)
- Mean absolute cosine error ≤ 0.005
- Top-10 ranking agreement ≥ 95% vs float32

## Storage savings (D=384, N=10K)
- Float32: 15.4 MB → Int8+scales: 3.9 MB (~4× reduction)

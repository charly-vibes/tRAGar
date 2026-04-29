# quantization Specification

## Purpose
TBD - created by archiving change add-initial-capabilities. Update Purpose after archive.
## Requirements
### Requirement: Symmetric Int8 Quantization Procedure
The C++23 core SHALL quantize every float32 embedding vector using symmetric per-vector int8 quantization, applied **after** unit normalization. The procedure for a float32 vector `v` of dimension `D` is:

0. **Pre-check:** If any component of `v` is `NaN` or `Inf`, the quantizer MUST reject with `EmbedderRuntimeError` before proceeding. Storing NaN vectors would silently poison all future cosine scores.
1. Compute L2 norm: `‖v‖ = sqrt(Σ vᵢ²)`
2. Normalize: `v' = v / ‖v‖`  (now `‖v'‖ = 1`)
3. Find max absolute value: `m = max(|v'ᵢ|)`
4. Compute scale: `s = m / 127.0`
5. Quantize: `q[i] = round(v'[i] / s)`, clamped to `[-127, 127]`
6. Store `q` (int8, length D) and `s` (float32)

The quantizer MUST NOT produce values of `+128` or `-128`.

#### Scenario: Round-trip accuracy within bounds
- **WHEN** a float32 vector is quantized and then dequantized via `v_recovered[i] = q[i] * s`
- **THEN** the mean absolute error between `v'` and `v_recovered` is ≤ 0.005 for dim=384 typical sentence embeddings

#### Scenario: NaN/Inf rejected before quantization
- **WHEN** the embedder returns a vector containing `NaN` or `Inf` in any component
- **THEN** the quantizer rejects with `EmbedderRuntimeError` before any quantization step; no data is written to the store

#### Scenario: Zero vector emits DegenerateVector warning and is skipped
- **WHEN** the embedder returns an all-zero float32 vector (L2 norm = 0)
- **THEN** `onWarn` receives `{ kind: 'DegenerateVector', source, line }` and the chunk is NOT stored (zero vectors score 0 against all queries and waste storage)

#### Scenario: Values clamped to [-127, 127]
- **WHEN** a pathological vector has a single component much larger than the rest
- **THEN** all quantized values are in `[-127, 127]` (128 is never stored)

### Requirement: Cosine Recovery via Int8 Dot Product
For two quantized vectors `(q_a, s_a)` and `(q_b, s_b)`, the approximate cosine similarity SHALL be computed as:

```
cosine(a, b) ≈ dot(q_a, q_b) × s_a × s_b
```

This identity holds because both vectors are unit-normalized before quantization. The index MUST use this formula exclusively; full dequantization to float32 at query time is prohibited.

**Accumulation width:** The dot product MUST accumulate into int32. For `D=384` and int8 inputs, the maximum per-dimension product is 127 × 127 = 16129; summed over 384 dimensions this reaches ~6.2M, which overflows int8 (after 1 add) and int16 (after 2 adds). WASM SIMD implementations MUST use a widening pattern (e.g. sign-extend int8 lanes to int16, then accumulate int16 products into int32 using `i32x4.dot_i16x8_s` or equivalent). Naive int8 accumulation is incorrect.

#### Scenario: Approximate cosine within error bound
- **WHEN** cosine similarity is computed via int8 dot product (with int32 accumulation) on two typical sentence embeddings
- **THEN** the result differs from the true float32 cosine by at most 0.01 for the vast majority of pairs

### Requirement: Quantization Loss Detection
When a vector's estimated quantization error exceeds a configured threshold (pathological case: a vector where one component dominates all others), the core MUST invoke `onWarn` with `QuantizationLossHigh`. This affects ≤ 1% of typical corpora.

#### Scenario: High-loss vector warning
- **WHEN** a vector with a single dominant component is quantized and the reconstruction error exceeds threshold
- **THEN** `onWarn` receives `{ kind: 'QuantizationLossHigh', source, line, loss }`

### Requirement: Storage Efficiency
For `dim = 384`, int8 quantization with per-vector float32 scales MUST achieve approximately 4× storage reduction compared to float32:
- Float32 storage: `N × D × 4` bytes
- Int8 + scales storage: `N × (D + 4)` bytes

For `N = 10000`, `D = 384`: float32 = 15.4 MB vs int8 = 3.9 MB. This is a design requirement, not a performance budget.

#### Scenario: Storage size within budget
- **WHEN** 10,000 vectors of dim=384 are quantized and stored
- **THEN** `vectors.bin` is `10000 × 384 = 3.84 MB` and `scales.bin` is `10000 × 4 = 40 KB`


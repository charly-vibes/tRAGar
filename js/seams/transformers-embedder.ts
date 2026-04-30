/**
 * Transformers.js embedder seam — lazy-loads the pipeline on first embed() call.
 *
 * The pipeline is cached per-config-instance so repeated calls reuse the loaded
 * model without re-initialising. Each call to createTransformersEmbedder()
 * produces an independent cache; tests can create fresh embedders freely.
 *
 * Throws TRAGarError("EmbedderLoadFailed") when the module or model fails to load.
 */
import { TRAGarError } from "../errors.ts";
import type { TransformersEmbedderConfig } from "../types.ts";

export const DEFAULT_MODEL = "Xenova/all-MiniLM-L6-v2";
export const DEFAULT_DIM = 384;

/** Shape of a transformers.js pipeline output for feature-extraction. */
interface PipelineOutput {
  data: Float32Array;
  dims: number[];
}

type EmbedPipeline = (
  input: string | string[],
  opts?: Record<string, unknown>,
) => Promise<PipelineOutput>;

export function createTransformersEmbedder(
  modelId: string = DEFAULT_MODEL,
  dim: number = DEFAULT_DIM,
): TransformersEmbedderConfig {
  // Per-instance pipeline cache — null until first embed() call.
  let pipeline: EmbedPipeline | null = null;

  async function loadPipeline(): Promise<EmbedPipeline> {
    if (pipeline !== null) return pipeline;
    try {
      const { pipeline: p } = await import("@xenova/transformers");
      pipeline = (await p("feature-extraction", modelId)) as EmbedPipeline;
      return pipeline;
    } catch (err) {
      throw new TRAGarError(
        "EmbedderLoadFailed",
        `Failed to load transformers.js model "${modelId}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  return {
    type: "transformers",
    modelId,
    dim,

    async embed(batch: string[]): Promise<Float32Array[]> {
      const pipe = await loadPipeline();
      const out = await pipe(batch, { pooling: "mean", normalize: true });
      const batchSize = batch.length;
      const actualDim = out.dims[1];
      return Array.from({ length: batchSize }, (_, i) =>
        out.data.slice(i * actualDim, (i + 1) * actualDim),
      );
    },
  };
}

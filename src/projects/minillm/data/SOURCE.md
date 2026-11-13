# Sources of the minillm page data

Repository: [github.com/MatiiiBL/LLM-inference-engine](https://github.com/MatiiiBL/LLM-inference-engine),
commit `bb175958c4718f47f9609d5fa4c933b3a26eb255` ("BF16 model, CLI --weights auto|bf16").
Model: [HuggingFaceTB/SmolLM2-135M](https://huggingface.co/HuggingFaceTB/SmolLM2-135M),
revision `93efa2f097d58c2a74874c7e644dbc9b0cee75a2` (Apache 2.0), the checkpoint minillm's
oracle downloads.

Numbers quoted on the page (weight sizes, KL budgets and measurements, measured errors against
PyTorch) are from the repository's `README.md`, `tests/common/tolerances.h` and
`tests/cli/test_cli.cpp` at that commit.

## attention.json, attention-reference.json

From the oracle data that minillm's `oracle/generate.py` writes (`oracle/data/` is gitignored
and reproducible with `oracle/generate.py`; the script is unchanged since `3cd1400`):
`attention/input_ids.npy` (the 13-token prompt "The capital of France is Paris, and the capital
of Italy is") and `attention/l{0,15}_{q,k}_rope.npy`, PyTorch's post-RoPE queries `[13, 9, 64]`
and keys `[13, 3, 64]` for layers 0 and 15. Token strings are from the checkpoint's `vocab.json`.

`attention.json` holds, for each layer, query head h and position t, the scores
`q[t, h] · k[s, h / 3] / sqrt(64)` for s = 0..t, computed in float64 and rounded to 4 decimals.
`attention-reference.json` holds numpy's softmax of the unrounded scores; `../model.test.ts`
checks the page's softmax against it.

## q8-blocks.json

Eight blocks of 32 real weights: the most typical block and the one with the largest outlier
(max |x| over median |x|) of four rows: row 0 of `model.layers.0.self_attn.q_proj.weight`,
`model.layers.0.self_attn.k_proj.weight` and `model.layers.15.mlp.down_proj.weight`, and the
embedding row of the token " Paris" (id 7042) in `model.embed_tokens.weight`. The rows were read
from the checkpoint's `model.safetensors` (bf16, converted to float32 exactly); the first 16
values of each row 0 match `oracle/data/weights/samples.json`. `reference` is what
`oracle/generate.py`'s `quantize_q8_0`, minillm's byte-exact reference for its C++ quantizer,
writes for each block: the f16 scale's bits and the 32 int8 values. `../q8_0.test.ts` checks the
page's quantizer against it.

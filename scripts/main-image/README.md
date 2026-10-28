# Local Main-image worker

Creates an additional PNG with a white studio background without a Gemini call.
It does not change product colors or repair a black valve. Recoloring rules belong
in the existing Hero pipeline; this worker is applied to the chosen result.

Supported scope: one opaque, fully visible product on a plain, light, neutral
studio background. White products are supported by semantic segmentation rather
than a brightness flood fill. Busy backgrounds, transparency, glass, multiple
objects, and general lifestyle photographs are outside the tested scope.

The output is always a **preview requiring visual review**. An exact-white pixel
check does not establish that the inferred product outline or shadow is correct.

## Setup

Python 3.11–3.13 with CPU wheels on macOS ARM64 and Linux AMD64. From the
repository root, `pnpm setup:main-image` provisions `vendor/main-image/.venv` and
`vendor/main-image/birefnet.onnx`. Manual equivalent:

```sh
python3 -m venv vendor/main-image/.venv
vendor/main-image/.venv/bin/python -m pip install -r scripts/main-image/requirements.txt
vendor/main-image/.venv/bin/python scripts/main-image/worker.py --download-model --model-dir vendor/main-image
```

The explicit BiRefNet-general-lite checkpoint is downloaded once (approximately
214 MiB) into `vendor/main-image/birefnet.onnx`. Its upstream content
checksum is verified at download and at inference. In deployment, download during
the image build rather than allowing request-time network downloads. Ordinary
processing is entirely offline. The model is not committed to git.

## CLI contract

```sh
vendor/main-image/.venv/bin/python scripts/main-image/worker.py \
  --input /absolute/path/source.jpeg \
  --output /absolute/path/main.png \
  --metrics /absolute/path/main.json \
  --model vendor/main-image/birefnet.onnx \
  --cache-dir /absolute/path/mask-cache
```

Use `--no-shadow` for a complete white cutout, or `--mask-preview mask.png` to
inspect the inferred coverage. Contact-shadow preservation is the default.
`--threads` defaults to 2. The worker rejects source files over 25 MiB or 25 MP
before full decoding. It applies EXIF orientation and converts embedded color
profiles to sRGB before processing; preservation metrics refer to those decoded,
normalized source pixels.

Stdout contains one JSON result; progress/error messages use stderr. Exit 0 means
technical checks passed, not human approval. Exit 2 means invalid/unsupported
input or processing failure. Paths are supplied by the caller, not by image
metadata. Output and metrics are atomically renamed into place. The caller owns
a unique request directory and should delete it after cancellation/failure.
SIGTERM/SIGKILL ends the process; no remote job or paid request continues.

Key metrics: `requiresReview: true`, `checks.pureWhiteBackground`,
`checks.opaqueProductUnchanged`, `opaqueProductChangedPixels`,
`backgroundNonWhitePixels`, `opaqueProductPixels`, `backgroundPixels`,
`shadowPixels`, dimensions, source/model SHA256, worker version, cache hit, and
warnings. The mask cache key includes source bytes, pinned model and worker
version. A changed source or implementation cannot reuse an old mask.

## How it works and limits

BiRefNet predicts the product mask. Confident opaque interior pixels are copied
unchanged. Only the narrow mixed edge is composited with an estimate of the old
background removed. A robust low-order fit estimates the plain studio floor.
For contact shadows, measured attenuation is transferred onto white in a bounded
region connected to the product's lower edge. This keeps the photographed shadow
shape; it does not generate a new shadow. Extremely faint shadow/noise is reduced
to avoid leaving a gray floor. This can slightly change the shadow's lightest
falloff. A shadow not connected to the ground-contact region is not retained.

All remaining background pixels become RGB 255/255/255, and the final lossless
PNG is decoded again to verify byte equality. These checks cannot discover a
semantic segmentation mistake. A wrong valve in the source remains wrong in the
output. Product shape/valve correctness must be checked before approval.

No generative API tokens are used. CPU/memory, model download/storage and hosting
still have costs. The real 1024-pixel ONNX inference peaked near **7.2 GB RSS** on
macOS ARM64 in testing (approximately 7–11 seconds for a 1264×843 input).
Provision **16 GiB** for the application plus one worker and large-image
headroom; do not deploy this model into a 2–4 GiB service. Limit concurrent
worker processes to one per container. Cached-mask compositing took under one
second and around 250–375 MB for the same images. Linux figures may differ;
run the real CPU model smoke test in the build/deployment environment:

```sh
vendor/main-image/.venv/bin/python scripts/main-image/worker.py \
  --self-test --model vendor/main-image/birefnet.onnx
```

The smoke test performs genuine ONNX inference on a synthetic product image
and reports peak memory. It sends no customer image anywhere. The runtime uses
sequential execution and BASIC graph optimization; image/model resolution is
not reduced to save memory.

## Tests and model provenance

```sh
vendor/main-image/.venv/bin/python -m unittest discover -s scripts/main-image -p 'test_*.py'
```

Tests cover white product/detail preservation, shadow on/off, soft edges, pure
white background, unsupported sources, and checksum/size protection. Model smoke
tests use real photographs separately and are not required for unit tests.

- [BiRefNet official repository (MIT)](https://github.com/ZhengPeng7/BiRefNet)
- [Official model weights and MIT model card](https://huggingface.co/ZhengPeng7/BiRefNet)
- [rembg's pinned lite ONNX conversion and checksum](https://github.com/danielgatis/rembg/blob/main/rembg/sessions/birefnet_general_lite.py)
- [ONNX Runtime platform support](https://onnxruntime.ai/docs/get-started/with-javascript/node.html)

The explicit BiRefNet checkpoint is used, not rembg's default BRIA model. The
model's MIT copyright/license notice is retained in `MODEL-LICENSE.txt`.

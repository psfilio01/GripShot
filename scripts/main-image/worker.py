#!/usr/bin/env python3
"""Local, non-generative main-image preparation for single studio products.

The model estimates coverage, never replacement product pixels. A numeric
background check does not certify that the mask or the product is correct.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import resource
import sys
import tempfile
import time
import urllib.request

import numpy as np
from PIL import Image, ImageCms, ImageOps
from scipy import ndimage

VERSION = "studio-white-v1"
MODEL_NAME = "BiRefNet-general-lite-swin-tiny-epoch232"
MODEL_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-general-bb_swin_v1_tiny-epoch_232.onnx"
# Upstream rembg's published content checksum; the downloaded bytes are also
# SHA256-hashed for the cache key and output provenance.
MODEL_MD5 = "4fab47adc4ff364be1713e97b7e66334"
MODEL_SHA256 = "5600024376f572a557870a5eb0afb1e5961636bef4e1e22132025467d0f03333"
MAX_BYTES = 10 * 1024 * 1024
MAX_PIXELS = 25_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


class UnsupportedImage(ValueError):
    pass


def file_digest(path: Path, algorithm: str = "sha256") -> str:
    digest = hashlib.new(algorithm)
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def verify_model(path: Path) -> str:
    if not path.is_file():
        raise ValueError("Local background model is missing. Run worker.py --download-model first.")
    digest = file_digest(path)
    if MODEL_SHA256:
        matches = digest == MODEL_SHA256
    else:
        matches = file_digest(path, "md5") == MODEL_MD5
    if not matches:
        raise ValueError("Background model checksum does not match the pinned model.")
    return digest


def download_model(directory: Path) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / "birefnet.onnx"
    if target.exists():
        verify_model(target)
        return target
    fd, temporary = tempfile.mkstemp(prefix="model-", suffix=".part", dir=directory)
    try:
        with os.fdopen(fd, "wb") as output:
            request = urllib.request.Request(MODEL_URL, headers={"User-Agent": "GripShot-main-image/1"})
            with urllib.request.urlopen(request, timeout=120) as response:
                while block := response.read(1024 * 1024):
                    output.write(block)
        verify_model(Path(temporary))
        os.replace(temporary, target)
    finally:
        Path(temporary).unlink(missing_ok=True)
    return target


def load_source(path: Path) -> tuple[Image.Image, str]:
    if path.stat().st_size > MAX_BYTES:
        raise UnsupportedImage("Image exceeds the 10 MB limit.")
    with Image.open(path) as opened:
        if opened.width * opened.height > MAX_PIXELS:
            raise UnsupportedImage("Image exceeds the 25 megapixel limit.")
        if min(opened.size) < 64:
            raise UnsupportedImage("Image must be at least 64 pixels on each side.")
        if getattr(opened, "n_frames", 1) != 1:
            raise UnsupportedImage("Animated images are not supported.")
        image = ImageOps.exif_transpose(opened)
        profile = image.info.get("icc_profile")
        if profile:
            try:
                image = ImageCms.profileToProfile(image, ImageCms.ImageCmsProfile(io.BytesIO(profile)), ImageCms.createProfile("sRGB"), outputMode="RGBA" if "A" in image.getbands() else "RGB")
            except (ValueError, OSError, ImageCms.PyCMSError) as error:
                raise UnsupportedImage("The image color profile could not be converted to sRGB.") from error
        if "A" in image.getbands():
            backdrop = Image.new("RGBA", image.size, (255, 255, 255, 255))
            image = Image.alpha_composite(backdrop, image.convert("RGBA"))
        image = image.convert("RGB")
        image.load()
    return image, file_digest(path)


def infer_mask(image: Image.Image, model: Path, threads: int) -> np.ndarray:
    import onnxruntime as ort
    options = ort.SessionOptions()
    options.intra_op_num_threads = threads
    options.inter_op_num_threads = 1
    options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
    session = ort.InferenceSession(str(model), sess_options=options, providers=["CPUExecutionProvider"])
    resized = np.asarray(image.resize((1024, 1024), Image.Resampling.LANCZOS), dtype=np.float32) / 255.0
    tensor = ((resized - np.array([.485, .456, .406], dtype=np.float32)) / np.array([.229, .224, .225], dtype=np.float32)).transpose(2, 0, 1)[None]
    logits = session.run(None, {session.get_inputs()[0].name: tensor})[0].squeeze()
    prediction = 1.0 / (1.0 + np.exp(-np.clip(logits, -80, 80)))
    # Do not normalize every image's extrema to 0/1: that would turn an
    # uncertain/empty prediction into a confident-looking foreground.
    return np.asarray(Image.fromarray(prediction.astype(np.float32)).resize(image.size, Image.Resampling.BILINEAR), dtype=np.float32)


def cached_mask(image: Image.Image, source_hash: str, model: Path, model_hash: str, cache: Path | None, threads: int) -> tuple[np.ndarray, bool]:
    key = hashlib.sha256(f"{VERSION}:{source_hash}:{model_hash}".encode()).hexdigest()
    entry = cache / f"{key}.npz" if cache else None
    if entry and entry.exists():
        try:
            with np.load(entry, allow_pickle=False) as saved:
                mask = saved["mask"].astype(np.float32)
                if mask.shape == (image.height, image.width) and np.isfinite(mask).all():
                    return np.clip(mask, 0, 1), True
        except (ValueError, OSError, KeyError):
            pass
    mask = infer_mask(image, model, threads)
    if entry:
        entry.parent.mkdir(parents=True, exist_ok=True)
        fd, temporary = tempfile.mkstemp(prefix="mask-", suffix=".npz", dir=entry.parent)
        try:
            with os.fdopen(fd, "wb") as stream:
                np.savez_compressed(stream, mask=mask)
            os.replace(temporary, entry)
        finally:
            Path(temporary).unlink(missing_ok=True)
    return mask, False


def prepare_alpha(mask: np.ndarray) -> tuple[np.ndarray, np.ndarray, tuple[int, int, int, int]]:
    if not np.isfinite(mask).all():
        raise UnsupportedImage("Foreground detection returned invalid values.")
    solid = mask >= .5
    labels, count = ndimage.label(solid)
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    if count == 0 or sizes.max() < mask.size * .01:
        raise UnsupportedImage("No clear single product could be detected.")
    largest = int(sizes.argmax())
    if (sizes.sum() - sizes[largest]) > max(50, sizes[largest] * .02):
        raise UnsupportedImage("Multiple separate objects detected. Use a single-product studio image.")
    solid = labels == largest
    if solid.mean() > .9:
        raise UnsupportedImage("The product leaves too little visible background.")
    if solid[0].any() or solid[-1].any() or solid[:, 0].any() or solid[:, -1].any():
        raise UnsupportedImage("The product touches the image edge. Use an uncropped product image.")
    ys, xs = np.nonzero(solid)
    bounds = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
    edge_radius = max(2, round(min(mask.shape) / 400))
    # Preserve a narrow soft edge, but suppress tiny model leakage in the
    # distant background. The untouched interior is defined conservatively.
    edge_support = ndimage.binary_dilation(solid, iterations=edge_radius * 2)
    alpha = np.where(edge_support, np.clip((mask - .01) / .98, 0, 1), 0).astype(np.float32)
    interior = ndimage.binary_erosion(solid, iterations=edge_radius) & (mask >= .98)
    if interior.sum() < solid.sum() * .8:
        raise UnsupportedImage("The product outline is uncertain. Review the source or use a clearer photograph.")
    alpha[interior] = 1
    return alpha, interior, bounds


def design_matrix(x: np.ndarray, y: np.ndarray) -> np.ndarray:
    return np.stack([np.ones_like(x), x, y, x * x, x * y, y * y], axis=-1)


def estimate_background(rgb: np.ndarray, alpha: np.ndarray, bounds: tuple[int, int, int, int]) -> tuple[np.ndarray, dict]:
    height, width = alpha.shape
    step = max(1, round(max(height, width) / 256))
    yy, xx = np.mgrid[0:height:step, 0:width:step]
    samples = rgb[::step, ::step].astype(np.float64)
    sample_alpha = alpha[::step, ::step]
    x0, y0, x1, y1 = bounds
    product_width, product_height = x1 - x0 + 1, y1 - y0 + 1
    # Exclude all product pixels and the potential contact-shadow area.
    possible_shadow = (yy >= y1 - product_height * .15) & (xx >= x0 - product_width * .45) & (xx <= x1 + product_width * .45)
    distance = ndimage.distance_transform_edt(alpha < .01)[::step, ::step]
    safe = (sample_alpha == 0) & (distance > max(5, product_width * .04)) & ~possible_shadow
    if safe.sum() < 300:
        raise UnsupportedImage("Not enough clean background is visible for a reliable white-background conversion.")
    selected = samples[safe]
    if np.percentile(selected.min(axis=1), 10) < 185 or np.percentile(np.ptp(selected, axis=1), 95) > 30:
        raise UnsupportedImage("Use a plain light neutral studio background. Colored or textured backgrounds are not supported yet.")
    matrix = design_matrix(xx[safe] / max(width - 1, 1), yy[safe] / max(height - 1, 1))
    keep = np.ones(len(selected), dtype=bool)
    for _ in range(4):
        coefficients = np.linalg.lstsq(matrix[keep], selected[keep], rcond=None)[0]
        residual = np.max(np.abs(selected - np.einsum("ij,jk->ik", matrix, coefficients)), axis=1)
        cutoff = max(2.0, float(np.percentile(residual[keep], 90)) * 1.5)
        keep = residual <= min(cutoff, 12)
        if keep.sum() < 300:
            raise UnsupportedImage("The background is too irregular for the studio-background mode.")
    residual_p95 = float(np.percentile(np.max(np.abs(selected - np.einsum("ij,jk->ik", matrix, coefficients)), axis=1), 95))
    if residual_p95 > 10:
        raise UnsupportedImage("The background contains texture or objects; a plain studio background is required.")
    # Evaluate a modest grid, then upsample, avoiding a 25MP x 6 design matrix.
    small_y, small_x = np.mgrid[0:65, 0:65]
    background_small = np.einsum("...j,jk->...k", design_matrix(small_x / 64, small_y / 64), coefficients)
    background = np.stack([np.asarray(Image.fromarray(background_small[:, :, c].astype(np.float32)).resize((width, height), Image.Resampling.BILINEAR)) for c in range(3)], axis=-1)
    background = np.clip(background, 180, 255).astype(np.float32)
    return background, {"fitResidualP95": round(residual_p95, 3), "sampleCount": int(keep.sum())}


def to_linear(rgb: np.ndarray) -> np.ndarray:
    value = rgb / 255.0
    return np.where(value <= .04045, value / 12.92, ((value + .055) / 1.055) ** 2.4)


def to_srgb(linear: np.ndarray) -> np.ndarray:
    value = np.clip(linear, 0, 1)
    return 255.0 * np.where(value <= .0031308, 12.92 * value, 1.055 * value ** (1 / 2.4) - .055)


def contact_shadow(rgb: np.ndarray, background: np.ndarray, alpha: np.ndarray, bounds: tuple[int, int, int, int], noise_floor: float = .012) -> tuple[np.ndarray, np.ndarray]:
    height, width = alpha.shape
    x0, y0, x1, y1 = bounds
    product_width, product_height = x1 - x0 + 1, y1 - y0 + 1
    yy, xx = np.ogrid[:height, :width]
    # Shadows are supported only near the product's ground contact, never in
    # distant background. This is intentionally not a general shadow remover.
    roi = (yy >= y1 - product_height * .15) & (yy <= y1 + product_height * .3) & (xx >= x0 - product_width * .4) & (xx <= x1 + product_width * .4)
    ratio = np.clip(to_linear(rgb.astype(np.float32)) / np.maximum(to_linear(background), .05), 0, 1)
    deficit = 1 - ratio.mean(axis=2)
    # Remove the small luminance noise floor smoothly, retaining the measured
    # shadow's shape and RGB attenuation rather than drawing a new shadow.
    floor = noise_floor
    strength = np.maximum(deficit - floor, 0) / np.maximum(deficit, 1e-6)
    candidate = roi & (alpha < .5) & (deficit > floor)
    labels, count = ndimage.label(candidate)
    seed = candidate & (yy >= y1 - product_height * .04) & (yy <= y1 + product_height * .08) & (xx >= x0 + product_width * .2) & (xx <= x1 - product_width * .2)
    connected = np.unique(labels[seed])
    connected = connected[connected != 0]
    support = np.isin(labels, connected) if len(connected) else np.zeros_like(candidate)
    # Softly end only the preservation support, never draw a replacement
    # shadow. Hard rectangular ROI boundaries create visible floor bands.
    fade = np.clip(ndimage.distance_transform_edt(roi) / max(8, product_width * .07), 0, 1)
    attenuation = (1 - ratio) * strength[:, :, None] * support[:, :, None] * fade[:, :, None]
    support &= np.max(attenuation, axis=2) > .002
    attenuation[~support] = 0
    return to_srgb(1 - attenuation), support


def edge_backdrop(rgb: np.ndarray, alpha: np.ndarray, background: np.ndarray) -> np.ndarray:
    """Interpolate photographed ground into mixed pixels, including its shadow.

    Unmixing the contact edge against an unshadowed floor makes a dark outline.
    Nearby known exterior pixels provide the correct local backdrop there.
    """
    known = (alpha == 0).astype(np.float32)
    sigma = max(1.5, min(alpha.shape) / 280)
    weight = ndimage.gaussian_filter(known, sigma=sigma)
    mixed = (alpha > 0) & (alpha < 1) & (weight > .001)
    local = background.copy()
    for channel in range(3):
        sample = ndimage.gaussian_filter(rgb[:, :, channel].astype(np.float32) * known, sigma=sigma) / np.maximum(weight, 1e-6)
        local[:, :, channel][mixed] = sample[mixed]
    return local


def composite(rgb: np.ndarray, mask: np.ndarray, preserve_shadow: bool = True) -> tuple[np.ndarray, dict, np.ndarray]:
    alpha, interior, bounds = prepare_alpha(mask)
    background, background_metrics = estimate_background(rgb, alpha, bounds)
    # A slightly uneven photographed floor must not become an enormous
    # "shadow". Ignore attenuation within the fitted background's noise.
    shadow_noise_floor = max(.012, background_metrics["fitResidualP95"] * 2 / 255)
    if preserve_shadow:
        canvas, shadow = contact_shadow(rgb, background, alpha, bounds, shadow_noise_floor)
    else:
        canvas = np.full(rgb.shape, 255, dtype=np.float32)
        shadow = np.zeros(alpha.shape, dtype=bool)
    local_background = edge_backdrop(rgb, alpha, background)
    if preserve_shadow:
        near_shadow = ndimage.binary_dilation(shadow, iterations=max(3, round(min(alpha.shape) / 140)))
        mixed_contact = (alpha > 0) & (alpha < 1) & near_shadow
        ratio = np.clip(to_linear(local_background[mixed_contact]) / np.maximum(to_linear(background[mixed_contact]), .05), 0, 1)
        deficit = 1 - ratio.mean(axis=1)
        strength = np.maximum(deficit - shadow_noise_floor, 0) / np.maximum(deficit, 1e-6)
        canvas[mixed_contact] = to_srgb(1 - (1 - ratio) * strength[:, None])
    # At mixed boundary pixels, undo the estimated old backdrop before white
    # compositing. Apply only to the narrow soft edge; do not recolor interiors.
    a = alpha[:, :, None]
    foreground = np.clip((rgb.astype(np.float32) - (1 - a) * local_background) / np.maximum(a, .02), 0, 255)
    output = np.rint(a * foreground + (1 - a) * canvas).clip(0, 255).astype(np.uint8)
    output[interior] = rgb[interior]
    free_background = (alpha == 0) & ~shadow
    output[free_background] = 255
    changed = int(np.count_nonzero(np.any(output[interior] != rgb[interior], axis=1)))
    nonwhite = int(np.count_nonzero(np.any(output[free_background] != 255, axis=1)))
    if changed or nonwhite:
        raise RuntimeError("Local compositing invariant failed.")
    metrics = {
        "requiresReview": True,
        "checks": {"pureWhiteBackground": nonwhite == 0, "opaqueProductUnchanged": changed == 0},
        "opaqueProductChangedPixels": changed,
        "backgroundNonWhitePixels": nonwhite,
        "opaqueProductPixels": int(interior.sum()),
        "backgroundPixels": int(free_background.sum()),
        "shadowPixels": int(shadow.sum()),
        "preserveShadow": preserve_shadow,
        "productBounds": list(bounds),
        "backgroundFit": background_metrics,
        "shadowNoiseFloor": round(shadow_noise_floor, 4),
        "warnings": ["Automatic segmentation and shadow extraction require visual review; numeric checks do not verify product correctness."],
    }
    if preserve_shadow and not shadow.any():
        metrics["warnings"].append("No distinct contact shadow was detected.")
    return output, metrics, alpha


def atomic_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}-", suffix=".part", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(data)
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--metrics", type=Path)
    parser.add_argument("--model", type=Path, default=Path(__file__).parent / "models" / "birefnet.onnx")
    parser.add_argument("--model-dir", type=Path, default=Path(__file__).parent / "models")
    parser.add_argument("--download-model", action="store_true")
    parser.add_argument("--self-test", action="store_true", help="Load the pinned model and run a real CPU inference on a synthetic image")
    parser.add_argument("--cache-dir", type=Path)
    parser.add_argument("--no-shadow", action="store_true")
    parser.add_argument("--threads", type=int, default=2)
    parser.add_argument("--mask-preview", type=Path, help="Optional diagnostic mask PNG, never a quality certificate")
    args = parser.parse_args()
    try:
        if args.download_model:
            model = download_model(args.model_dir)
            print(json.dumps({"model": str(model), "modelSha256": verify_model(model)}))
            return 0
        if args.self_test:
            from PIL import ImageDraw
            model_hash = verify_model(args.model)
            synthetic = Image.new("RGB", (512, 512), (245, 245, 245))
            ImageDraw.Draw(synthetic).ellipse((110, 90, 402, 402), fill=(80, 100, 120))
            mask = infer_mask(synthetic, args.model, max(1, min(args.threads, 8)))
            if mask.shape != (512, 512) or not np.isfinite(mask).all() or float(mask.max() - mask.min()) < .1:
                raise RuntimeError("ONNX CPU inference self-test returned an invalid mask.")
            max_rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
            print(json.dumps({"selfTest": True, "modelSha256": model_hash, "provider": "CPUExecutionProvider", "maskMin": float(mask.min()), "maskMax": float(mask.max()), "peakMemoryBytes": max_rss if sys.platform == "darwin" else max_rss * 1024}))
            return 0
        if not args.input or not args.output or not args.metrics:
            parser.error("--input, --output and --metrics are required")
        output_paths = [args.output.resolve(), args.metrics.resolve()] + ([args.mask_preview.resolve()] if args.mask_preview else [])
        if args.input.resolve() in output_paths or args.model.resolve() in output_paths or len(set(output_paths)) != len(output_paths):
            raise ValueError("Output paths must not overwrite the source image.")
        if args.output.suffix.lower() != ".png":
            raise ValueError("Output must use the lossless .png format.")
        if args.threads < 1 or args.threads > 8:
            raise ValueError("--threads must be between 1 and 8.")
        started = time.monotonic()
        image, source_hash = load_source(args.input)
        model_hash = verify_model(args.model)
        print("Estimating product outline locally…", file=sys.stderr, flush=True)
        mask, cache_hit = cached_mask(image, source_hash, args.model, model_hash, args.cache_dir, args.threads)
        rgb = np.asarray(image)
        output, metrics, alpha = composite(rgb, mask, not args.no_shadow)
        encoded = io.BytesIO()
        Image.fromarray(output).save(encoded, format="PNG", compress_level=6)
        # Verify the encoded deliverable, not just the working buffer.
        with Image.open(io.BytesIO(encoded.getvalue())) as decoded:
            if not np.array_equal(np.asarray(decoded), output):
                raise RuntimeError("PNG round-trip invariant failed.")
        max_rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        peak_memory = max_rss if sys.platform == "darwin" else max_rss * 1024
        metrics.update({"version": VERSION, "model": MODEL_NAME, "modelSha256": model_hash, "sourceSha256": source_hash, "width": image.width, "height": image.height, "cacheHit": cache_hit, "durationMs": round((time.monotonic() - started) * 1000), "peakMemoryBytes": peak_memory})
        atomic_bytes(args.output, encoded.getvalue())
        atomic_bytes(args.metrics, (json.dumps(metrics, indent=2) + "\n").encode())
        if args.mask_preview:
            mask_buffer = io.BytesIO()
            Image.fromarray(np.rint(alpha * 255).astype(np.uint8)).save(mask_buffer, format="PNG")
            atomic_bytes(args.mask_preview, mask_buffer.getvalue())
        print(json.dumps(metrics), flush=True)
        return 0
    except Exception as error:
        print(json.dumps({"error": str(error), "code": "UNSUPPORTED_IMAGE" if isinstance(error, UnsupportedImage) else "PROCESSING_FAILED"}), file=sys.stderr, flush=True)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

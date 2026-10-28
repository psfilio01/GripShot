"""Deterministic compositor tests; no model download, API calls, or billing."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

import numpy as np
from PIL import Image

spec = importlib.util.spec_from_file_location("worker", Path(__file__).with_name("worker.py"))
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


def studio_fixture(with_shadow=True):
    height, width = 220, 260
    yy, xx = np.mgrid[:height, :width]
    distance = np.sqrt(((xx - 130) / 65) ** 2 + ((yy - 100) / 65) ** 2)
    alpha = np.clip((1.01 - distance) / .02, 0, 1).astype(np.float32)
    floor = np.full((height, width, 3), 240, dtype=np.float32)
    if with_shadow:
        attenuation = 65 * np.exp(-((xx - 130) / 55) ** 2 - ((yy - 166) / 10) ** 2)
        floor -= attenuation[:, :, None]
    # Include near-white highlights and very dark valve/embossing details.
    foreground = np.full_like(floor, 245)
    foreground[55:60, 126:135] = [12, 15, 18]
    foreground[90:96, 100:160] = [190, 190, 190]
    source = np.rint(alpha[:, :, None] * foreground + (1 - alpha[:, :, None]) * floor).astype(np.uint8)
    return source, alpha


class CompositorTests(unittest.TestCase):
    def test_white_product_and_details_are_unchanged(self):
        source, mask = studio_fixture()
        output, metrics, alpha = worker.composite(source, mask)
        _, interior, _ = worker.prepare_alpha(mask)
        self.assertTrue(np.array_equal(output[interior], source[interior]))
        self.assertTrue(np.array_equal(output[55:60, 126:135], source[55:60, 126:135]))
        self.assertEqual(metrics["opaqueProductChangedPixels"], 0)
        self.assertTrue(metrics["requiresReview"])
        self.assertTrue(np.all(output[:15] == 255))
        self.assertEqual(metrics["backgroundNonWhitePixels"], 0)

    def test_contact_shadow_is_preserved_without_changing_product(self):
        source, mask = studio_fixture()
        with_shadow, metrics, _ = worker.composite(source, mask)
        without_shadow, no_shadow_metrics, alpha = worker.composite(source, mask, False)
        self.assertGreater(metrics["shadowPixels"], 0)
        self.assertLess(int(with_shadow[170, 130, 0]), 230)
        self.assertTrue(np.all(without_shadow[alpha == 0] == 255))
        self.assertEqual(no_shadow_metrics["shadowPixels"], 0)

    def test_soft_edges_remain_soft_and_floor_is_removed(self):
        source, mask = studio_fixture(False)
        output, _, alpha = worker.composite(source, mask, False)
        boundary = (alpha > .05) & (alpha < .95)
        self.assertGreater(boundary.sum(), 20)
        self.assertTrue(np.all(output[alpha == 0] == 255))
        self.assertTrue(np.all(output[boundary] >= source[boundary]))

    def test_contact_edge_does_not_gain_a_dark_cutout_outline(self):
        source, mask = studio_fixture()
        output, _, alpha = worker.composite(source, mask)
        yy, _ = np.mgrid[:alpha.shape[0], :alpha.shape[1]]
        contact_edge = (alpha > .02) & (alpha < .98) & (yy > 150)
        # White compositing must not subtract an unshadowed floor from the
        # photographed shadow-mixed edge, which produces a dark cutout ring.
        delta = output[contact_edge].astype(int) - source[contact_edge].astype(int)
        self.assertGreaterEqual(int(delta.min()), -2)

    def test_dark_background_is_rejected(self):
        source, mask = studio_fixture()
        source[mask == 0] = 80
        with self.assertRaisesRegex(worker.UnsupportedImage, "light neutral"):
            worker.composite(source, mask)

    def test_multiple_objects_and_empty_masks_are_rejected(self):
        _, mask = studio_fixture()
        mask[10:35, 10:35] = 1
        with self.assertRaisesRegex(worker.UnsupportedImage, "Multiple"):
            worker.prepare_alpha(mask)
        with self.assertRaises(worker.UnsupportedImage):
            worker.prepare_alpha(np.zeros_like(mask))

    def test_source_limits_and_model_checksum(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "image.png"
            Image.new("RGB", (30, 30), "white").save(path)
            with self.assertRaisesRegex(worker.UnsupportedImage, "64 pixels"):
                worker.load_source(path)
            path.write_bytes(b"not-the-model")
            with self.assertRaisesRegex(ValueError, "checksum"):
                worker.verify_model(path)


if __name__ == "__main__":
    unittest.main()

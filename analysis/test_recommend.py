"""Unit tests for heuristic recommendation (no network when coordinates are omitted)."""

from __future__ import annotations

import io
import unittest

from PIL import Image

from recommend import compute_signals_from_image, recommend_from_bytes


def _jpeg_bytes(img: Image.Image, *, quality: int = 85) -> bytes:
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="JPEG", quality=quality)
    return buf.getvalue()


class TestConcreteAndRanking(unittest.TestCase):
    def test_uniform_gray_scene_flags_hardscape(self) -> None:
        gray = Image.new("RGB", (320, 240), color=(145, 145, 145))
        raw = _jpeg_bytes(gray)
        out = recommend_from_bytes(raw, None, None)
        self.assertTrue(out.get("unsuitableForPlanting"))
        self.assertIsNone(out.get("recommended"))
        self.assertEqual(out.get("rankedSeedlings"), [])

    def test_green_scene_produces_ranked_seedlings(self) -> None:
        green = Image.new("RGB", (320, 240), color=(40, 160, 55))
        raw = _jpeg_bytes(green)
        # Omit coordinates so tests stay offline; area/soil context still applies.
        out = recommend_from_bytes(raw, None, None, area_m2=500.0, soil=None)
        self.assertFalse(out.get("unsuitableForPlanting"))
        self.assertIsNotNone(out.get("recommended"))
        ranked = out.get("rankedSeedlings") or []
        self.assertGreaterEqual(len(ranked), 2)
        self.assertIn("matchPercent", ranked[0])
        self.assertLessEqual(ranked[0]["matchPercent"], 100)

    def test_signals_include_concrete_likelihood(self) -> None:
        img = Image.new("RGB", (128, 128), color=(120, 118, 122))
        sig = compute_signals_from_image(img)
        self.assertIn("concreteLikelihood", sig)
        self.assertGreater(sig["concreteLikelihood"], 0.2)


if __name__ == "__main__":
    unittest.main()

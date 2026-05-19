"""Unit tests for heuristic recommendation (no network when coordinates are omitted)."""

from __future__ import annotations

import io
import unittest

from PIL import Image

from capture_validity import assess_capture_validity, has_land_or_aerial_vegetation_cue
from recommend import compute_signals_from_image, recommend_from_bytes


def _jpeg_bytes(img: Image.Image, *, quality: int = 85) -> bytes:
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="JPEG", quality=quality)
    return buf.getvalue()


class TestConcreteAndRanking(unittest.TestCase):
    def test_keyboard_pattern_rejected(self) -> None:
        w, h = 320, 240
        img = Image.new("RGB", (w, h), (55, 58, 62))
        px = img.load()
        for y in range(0, h, 14):
            for x in range(0, w, 28):
                for dy in range(12):
                    for dx in range(26):
                        if x + dx < w and y + dy < h:
                            px[x + dx, y + dy] = (
                                (200, 205, 210) if (x // 28 + y // 14) % 2 == 0 else (70, 73, 78)
                            )
        sig = compute_signals_from_image(img)
        validity = assess_capture_validity(sig)
        self.assertFalse(validity.get("isValidFieldCapture"))
        self.assertIn(
            validity.get("captureIssueType"),
            ("keyboard_or_gadget", "hardscape_concrete", "hardscape_built"),
        )

    def test_concrete_pavement_rejected(self) -> None:
        gray = Image.new("RGB", (320, 240), color=(145, 145, 145))
        sig = compute_signals_from_image(gray)
        validity = assess_capture_validity(sig)
        self.assertFalse(validity.get("isValidFieldCapture"))
        self.assertEqual(validity.get("captureIssueType"), "hardscape_concrete")

    def test_wood_boards_rejected(self) -> None:
        w, h = 320, 240
        img = Image.new("RGB", (w, h), (120, 85, 55))
        px = img.load()
        for y in range(0, h, 18):
            for x in range(0, w, 40):
                shade = (150, 105, 65) if (x // 40 + y // 18) % 2 == 0 else (95, 68, 42)
                for dy in range(16):
                    for dx in range(38):
                        if x + dx < w and y + dy < h:
                            px[x + dx, y + dy] = shade
        sig = compute_signals_from_image(img)
        validity = assess_capture_validity(sig)
        self.assertFalse(validity.get("isValidFieldCapture"))
        self.assertIn(
            validity.get("captureIssueType"),
            ("wood_or_boards", "hardscape_concrete", "hardscape_built"),
        )

    def test_open_sun_without_vegetation_rejected(self) -> None:
        gray = Image.new("RGB", (320, 240), color=(160, 158, 155))
        sig = compute_signals_from_image(gray)
        self.assertFalse(has_land_or_aerial_vegetation_cue(sig))
        validity = assess_capture_validity(sig)
        self.assertFalse(validity.get("isValidFieldCapture"))

    def test_screen_like_ui_pattern_rejected(self) -> None:
        """Checkerboard UI + text-like edges should not pass as field vegetation."""
        w, h = 320, 240
        img = Image.new("RGB", (w, h))
        px = img.load()
        palette = (
            (30, 35, 48),
            (220, 225, 235),
            (45, 120, 200),
            (40, 160, 70),
        )
        for y in range(h):
            for x in range(w):
                px[x, y] = palette[((x // 16) + (y // 12)) % 4]
        sig = compute_signals_from_image(img)
        validity = assess_capture_validity(sig)
        self.assertFalse(validity.get("isValidFieldCapture"))
        raw = _jpeg_bytes(img)
        penro_plot = {
            "site_code": "test-screen",
            "species_planted": "Narra, Jackfruit",
            "area_ha": 50.0,
            "seedlings_contracted": 25000,
        }
        out = recommend_from_bytes(raw, None, None, penro_plot=penro_plot)
        self.assertTrue(out.get("unsuitableForPlanting"))

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
        penro_plot = {
            "site_code": "11-060606-0055-0050",
            "species_planted": "Narra, Jackfruit, Badlan, Mahogany",
            "area_ha": 50.0,
            "seedlings_contracted": 25000,
            "latest_survival_rate": 0.16,
        }
        out = recommend_from_bytes(
            raw, None, None, area_m2=500.0, penro_plot=penro_plot
        )
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

    def test_mottled_canopy_not_flagged_as_hardscape(self) -> None:
        """Shade + bark + foliage: strict green ratio can be near zero; scene must stay plantable."""
        w, h = 320, 240
        img = Image.new("RGB", (w, h))
        px = img.load()
        palette = (
            (38, 52, 34),  # dark green foliage
            (62, 58, 48),  # trunk / brown
            (44, 48, 42),  # shadow mix
        )
        for y in range(h):
            for x in range(w):
                px[x, y] = palette[(x // 12 + y // 10) % 3]
        raw = _jpeg_bytes(img)
        penro_plot = {
            "site_code": "test-canopy",
            "species_planted": "Narra, Toog, Rambutan",
            "area_ha": 75.0,
            "seedlings_contracted": 37500,
        }
        out = recommend_from_bytes(
            raw, None, None, area_m2=400.0, penro_plot=penro_plot
        )
        self.assertFalse(out.get("unsuitableForPlanting"))
        self.assertIsNotNone(out.get("recommended"))
        ranked = out.get("rankedSeedlings") or []
        self.assertGreaterEqual(len(ranked), 1)


if __name__ == "__main__":
    unittest.main()

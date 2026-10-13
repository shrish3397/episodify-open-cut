"""Tests for arbitrary episode count slicing and meaningful scene-arc boundary segmentation."""

import unittest
from pathlib import Path
from eoc.analyzer import build_episodic_recipe, estimate_episode_count
from eoc.parser import parse_subtitles
from eoc.recipe import validate_recipe_data

FIXTURES_DIR = Path(__file__).parent / "fixtures"


class TestNarrativeSegmenter(unittest.TestCase):
    def setUp(self):
        self.cues = parse_subtitles(FIXTURES_DIR / "sample.srt")

    def test_flexible_episode_counts(self):
        """Verify the engine can slice a film into any requested episode count."""
        for num_eps in [2, 3, 5, 6, 8]:
            recipe = build_episodic_recipe(
                cues=self.cues,
                title="Narrative Test Film",
                year=2024,
                runtime_seconds=7200,
                episodes_count=num_eps,
                provider="heuristic",
            )
            self.assertEqual(recipe.total_episodes, num_eps)
            self.assertEqual(len(recipe.episodes), num_eps)
            self.assertEqual(recipe.episodes[0].start_time, "00:00:00")
            self.assertEqual(recipe.episodes[-1].end_time, "02:00:00")

            # Verify schema validity
            errors = validate_recipe_data(recipe.to_dict())
            self.assertEqual(len(errors), 0, f"Validation errors for {num_eps} eps: {errors}")

    def test_cuts_strictly_after_complete_scene(self):
        """Verify that cuts occur at complete dialogue breaks, never mid-sentence or mid-scene."""
        recipe = build_episodic_recipe(
            cues=self.cues,
            title="Scene Arc Integrity Test",
            year=2024,
            runtime_seconds=360,
            episodes_count=3,
            provider="heuristic",
        )
        for ep in recipe.episodes[:-1]:
            # Each episode cut should have a verified scene boundary or dialogue lull
            self.assertIn(ep.cut_type, ["dialogue_lull", "hard_cut_with_silence", "visual_cut_without_silence"])
            self.assertGreater(ep.duration_seconds, 10.0)

    def test_estimate_episode_count_adaptive(self):
        """Verify episode count recommendation respects pacing and duration."""
        # 155 min film (like Bethlehem Kudumba Unit: 9313s = ~155 mins)
        self.assertEqual(estimate_episode_count(9313, target_duration_mins=20), 8)
        self.assertEqual(estimate_episode_count(9313, target_duration_mins=26), 6)
        self.assertEqual(estimate_episode_count(9313, target_duration_mins=39), 4)


if __name__ == "__main__":
    unittest.main()

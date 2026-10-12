"""Unit tests for recipe validation and persistence."""

import json
import tempfile
import unittest
from pathlib import Path

from eoc.recipe import load_recipe, save_recipe, validate_recipe_data, RecipeValidationError
from eoc.models import Recipe, RecipeMeta, Episode

FIXTURES_DIR = Path(__file__).parent / "fixtures"


class TestRecipe(unittest.TestCase):
    def test_load_valid_recipe(self):
        recipe_path = FIXTURES_DIR / "sample.eoc.json"
        recipe = load_recipe(recipe_path)

        self.assertEqual(recipe.meta.title, "Oppenheimer")
        self.assertEqual(recipe.meta.year, 2023)
        self.assertEqual(recipe.meta.runtime_seconds, 10800)
        self.assertEqual(recipe.total_episodes, 4)
        self.assertEqual(len(recipe.episodes), 4)
        self.assertEqual(recipe.episodes[0].title, "Prometheus Bound")
        self.assertEqual(recipe.episodes[0].start_time, "00:00:00")
        self.assertEqual(recipe.episodes[0].end_time, "00:46:18")
        self.assertEqual(recipe.episodes[1].start_time, "00:46:18")

    def test_validate_invalid_continuity(self):
        data = {
            "$schema": "https://episodify.org/schema/v1.json",
            "meta": {"title": "Test", "year": 2024, "runtime_seconds": 3600},
            "total_episodes": 2,
            "episodes": [
                {
                    "episode_number": 1,
                    "title": "Part 1",
                    "start_time": "00:05:00",  # Invalid! Must start at 00:00:00
                    "end_time": "00:25:00",
                    "cliffhanger_rating": 8.0,
                    "break_rationale": "r",
                    "recap_text": "r",
                    "teaser_next": "t",
                },
                {
                    "episode_number": 2,
                    "title": "Part 2",
                    "start_time": "00:30:00",  # Invalid! Gap of 5 minutes from previous end
                    "end_time": "01:00:00",
                    "cliffhanger_rating": 8.0,
                    "break_rationale": "r",
                    "recap_text": "r",
                    "teaser_next": "t",
                },
            ],
        }
        errors = validate_recipe_data(data)
        self.assertTrue(any("first episode must start at 00:00:00" in e for e in errors))
        self.assertTrue(any("does not align with previous episode" in e for e in errors))

    def test_save_and_reload_recipe(self):
        recipe_path = FIXTURES_DIR / "sample.eoc.json"
        recipe = load_recipe(recipe_path)

        with tempfile.TemporaryDirectory() as tmp_dir:
            target_file = Path(tmp_dir) / "saved.eoc.json"
            save_recipe(recipe, target_file)

            reloaded = load_recipe(target_file)
            self.assertEqual(reloaded.meta.title, recipe.meta.title)
            self.assertEqual(reloaded.total_episodes, recipe.total_episodes)


if __name__ == "__main__":
    unittest.main()

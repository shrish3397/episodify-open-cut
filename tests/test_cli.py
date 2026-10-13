"""Integration tests for CLI subcommands."""

import tempfile
import unittest
from pathlib import Path
from eoc.cli import main

FIXTURES_DIR = Path(__file__).parent / "fixtures"


class TestCLI(unittest.TestCase):
    def test_cli_validate(self):
        sample_recipe = str(FIXTURES_DIR / "sample.eoc.json")
        exit_code = main(["validate", sample_recipe])
        self.assertEqual(exit_code, 0)

    def test_cli_info(self):
        sample_recipe = str(FIXTURES_DIR / "sample.eoc.json")
        exit_code = main(["info", sample_recipe])
        self.assertEqual(exit_code, 0)

    def test_cli_snap(self):
        sample_srt = str(FIXTURES_DIR / "sample.srt")
        exit_code = main(["snap", sample_srt, "--time", "00:00:25"])
        self.assertEqual(exit_code, 0)

    def test_cli_cut_heuristic(self):
        sample_srt = str(FIXTURES_DIR / "sample.srt")
        with tempfile.TemporaryDirectory() as tmp_dir:
            out_file = str(Path(tmp_dir) / "test_cut.eoc.json")
            exit_code = main([
                "cut",
                sample_srt,
                "--title", "Test Movie",
                "--year", "2024",
                "--runtime", "360",
                "--episodes", "3",
                "--provider", "heuristic",
                "--output", out_file,
            ])
            self.assertEqual(exit_code, 0)
            self.assertTrue(Path(out_file).exists())

            # Verify the generated recipe is valid
            val_exit = main(["validate", out_file])
            self.assertEqual(val_exit, 0)

    def test_cli_export(self):
        sample_recipe = str(FIXTURES_DIR / "sample.eoc.json")
        with tempfile.TemporaryDirectory() as tmp_dir:
            out_ffmpeg = str(Path(tmp_dir) / "chapters.txt")
            exit_code = main(["export", sample_recipe, "--format", "ffmpeg", "--output", out_ffmpeg])
            self.assertEqual(exit_code, 0)
            self.assertTrue(Path(out_ffmpeg).exists())
            content = Path(out_ffmpeg).read_text()
            self.assertIn(";FFMETADATA1", content)
            self.assertIn("The Angamaly Shift", content)


    def test_cli_snap_scene_boundary(self):
        sample_srt = str(FIXTURES_DIR / "sample.srt")
        exit_code = main(["snap", sample_srt, "--time", "00:00:25", "--constraint", "scene_boundary"])
        self.assertEqual(exit_code, 0)

    def test_cli_cut_scene_boundary(self):
        sample_srt = str(FIXTURES_DIR / "sample.srt")
        with tempfile.TemporaryDirectory() as tmp_dir:
            out_file = str(Path(tmp_dir) / "test_cut_scene.eoc.json")
            exit_code = main([
                "cut",
                sample_srt,
                "--title", "Test Movie",
                "--year", "2024",
                "--runtime", "360",
                "--episodes", "3",
                "--provider", "heuristic",
                "--constraint", "scene_boundary",
                "--output", out_file,
            ])
            self.assertEqual(exit_code, 0)
            self.assertTrue(Path(out_file).exists())

            # Validate generated recipe
            val_exit = main(["validate", out_file])
            self.assertEqual(val_exit, 0)


if __name__ == "__main__":
    unittest.main()

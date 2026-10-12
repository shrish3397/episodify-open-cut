"""Unit tests for micro-break snapping."""

import unittest
from pathlib import Path
from eoc.parser import parse_subtitles
from eoc.snapper import find_silence_gaps, snap_to_micro_break

FIXTURES_DIR = Path(__file__).parent / "fixtures"


class TestSnapper(unittest.TestCase):
    def test_find_silence_gaps(self):
        cues = parse_subtitles(FIXTURES_DIR / "sample.srt")
        # In sample.srt:
        # cue 3 ends at 00:00:22.8 (22.8s)
        # cue 4 starts at 00:00:30.0 (30.0s) -> gap of 7.2s!
        gaps = find_silence_gaps(cues, window_start=20.0, window_end=32.0)
        self.assertGreaterEqual(len(gaps), 1)

        # Check that the 7.2s gap between cue 3 and cue 4 is found
        target_gaps = [g for g in gaps if abs(g[2] - 7.2) < 0.1]
        self.assertEqual(len(target_gaps), 1)
        gap_start, gap_end, duration, prev_c, next_c = target_gaps[0]
        self.assertEqual(gap_start, 22.8)
        self.assertEqual(gap_end, 30.0)
        self.assertEqual(round(duration, 1), 7.2)
        self.assertEqual(prev_c.text, "Most people were silent.")
        self.assertEqual(next_c.text, "Now I am become Death, the destroyer of worlds.")

    def test_snap_to_micro_break(self):
        cues = parse_subtitles(FIXTURES_DIR / "sample.srt")
        res = snap_to_micro_break(cues, target_seconds=25.0, window_seconds=15.0)

        self.assertGreaterEqual(res.snapped_seconds, 22.8)
        self.assertLessEqual(res.snapped_seconds, 30.0)
        self.assertIsNotNone(res.preceding_cue)
        self.assertEqual(res.preceding_cue.text, "Most people were silent.")
        self.assertIsNotNone(res.succeeding_cue)
        self.assertEqual(res.succeeding_cue.text, "Now I am become Death, the destroyer of worlds.")
        self.assertGreater(res.gap_duration, 7.0)

    def test_snap_empty_cues(self):
        res = snap_to_micro_break([], target_seconds=60.0)
        self.assertEqual(res.snapped_seconds, 60.0)
        self.assertEqual(res.gap_duration, 0.0)


if __name__ == "__main__":
    unittest.main()

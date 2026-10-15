"""Unit tests for micro-break snapping."""

import unittest
from pathlib import Path
from eoc.parser import parse_subtitles
from eoc.snapper import (
    find_candidate_lulls,
    find_exact_scene_break,
    find_silence_gaps,
    is_during_dialogue_silence,
    snap_to_micro_break,
)

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

    def test_is_during_dialogue_silence(self):
        cues = parse_subtitles(FIXTURES_DIR / "sample.srt")
        gaps = find_silence_gaps(cues, window_start=0.0, window_end=60.0)

        # 25.0s is inside 22.8s - 30.0s gap
        self.assertTrue(is_during_dialogue_silence(25.0, gaps))
        self.assertTrue(is_during_dialogue_silence(25.0, gaps, min_gap_sec=1.5))
        self.assertFalse(is_during_dialogue_silence(25.0, gaps, min_gap_sec=10.0))

        # 21.0s is during cue 3 (19.2s -> 22.8s), so not in silence
        self.assertFalse(is_during_dialogue_silence(21.0, gaps))

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

    def test_find_exact_scene_break_with_silence(self):
        cues = parse_subtitles(FIXTURES_DIR / "sample.srt")
        # Visual scene cuts at 26.5s (inside 22.8-30.0 lull) and 45.0s
        visual_cuts = [10.0, 26.5, 45.0]
        res = find_exact_scene_break(
            cues,
            target_time_sec=25.0,
            search_window_sec=10.0,
            visual_scene_cuts=visual_cuts,
        )

        self.assertEqual(res.snapped_seconds, 26.5)
        self.assertTrue(res.scene_boundary_verified)
        self.assertEqual(res.cut_type, "hard_cut_with_silence")
        self.assertEqual(res.snapped_timestamp, "00:00:26.500")
        self.assertIsNotNone(res.preceding_cue)
        self.assertIsNotNone(res.succeeding_cue)
        self.assertEqual(res.preceding_cue.text, "Most people were silent.")
        self.assertEqual(res.succeeding_cue.text, "Now I am become Death, the destroyer of worlds.")

    def test_find_exact_scene_break_without_silence(self):
        cues = parse_subtitles(FIXTURES_DIR / "sample.srt")
        # Visual cut at 20.0s (during cue 3 speech: 19.2s -> 22.8s)
        visual_cuts = [20.0]
        res = find_exact_scene_break(
            cues,
            target_time_sec=20.0,
            search_window_sec=5.0,
            visual_scene_cuts=visual_cuts,
        )

        self.assertEqual(res.snapped_seconds, 20.0)
        self.assertTrue(res.scene_boundary_verified)
        self.assertEqual(res.cut_type, "visual_cut_without_silence")

    def test_find_exact_scene_break_fallback_no_cuts(self):
        cues = parse_subtitles(FIXTURES_DIR / "sample.srt")
        res = find_exact_scene_break(
            cues,
            target_time_sec=25.0,
            search_window_sec=15.0,
            visual_scene_cuts=[],
        )

        self.assertEqual(res.cut_type, "dialogue_lull")
        self.assertGreater(res.gap_duration, 7.0)
        self.assertTrue(res.scene_boundary_verified)  # gap >= 2.5s marks verified

    def test_snap_to_micro_break_constraint_scene_boundary(self):
        cues = parse_subtitles(FIXTURES_DIR / "sample.srt")
        res = snap_to_micro_break(
            cues,
            target_seconds=25.0,
            window_seconds=15.0,
            constraint="scene_boundary",
            visual_scene_cuts=[26.5],
        )
        self.assertEqual(res.snapped_seconds, 26.5)
        self.assertTrue(res.scene_boundary_verified)
        self.assertEqual(res.cut_type, "hard_cut_with_silence")

    def test_avoid_talking_scene_mid_conversation_cuts(self):
        """Verifies that snapper avoids mid-dialogue gaps (<3.0s) and expands to find a true scene transition pause >= 3.0s."""
        cues = parse_subtitles(FIXTURES_DIR / "bethlehem_kudumba_unit.srt")
        # In this scene:
        # Cues 1-4 are continuous conversation with gaps <= 0.9s (between 15.2s and 35.5s).
        # Cue 4 ends at 35.5s, followed by a 9.5s silence gap before Cue 5 at 45.0s.
        res = snap_to_micro_break(
            cues,
            target_seconds=24.0,  # inside the rapid dialogue conversation
            window_seconds=10.0,
            min_gap_seconds=3.0,
        )
        # Must NOT cut inside the dialogue (20.5 - 29.4s), but in the pause >= 3.0s (after 35.5s)
        self.assertGreaterEqual(res.gap_duration, 3.0)
        self.assertGreaterEqual(res.snapped_seconds, 35.5)
        self.assertLessEqual(res.snapped_seconds, 45.0)

    def test_find_candidate_lulls(self):
        cues = parse_subtitles(FIXTURES_DIR / "bethlehem_kudumba_unit.srt")
        lulls = find_candidate_lulls(cues, target_seconds=30.0, window_seconds=40.0, min_gap_seconds=3.0)
        self.assertGreaterEqual(len(lulls), 1)
        for _, _, dur, _, _ in lulls:
            self.assertGreaterEqual(dur, 3.0)


if __name__ == "__main__":
    unittest.main()

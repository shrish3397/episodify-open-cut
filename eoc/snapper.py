"""Micro-Break Snapping engine to find natural dialogue lulls and scene transitions."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Tuple

from eoc.models import SubtitleCue, seconds_to_timestamp


@dataclass
class SnapResult:
    """Result of snapping a target cut timestamp to a natural dialogue lull."""

    original_target: float
    snapped_seconds: float
    snapped_timestamp: str
    gap_duration: float
    preceding_cue: Optional[SubtitleCue]
    succeeding_cue: Optional[SubtitleCue]
    adjustment_seconds: float

    @property
    def summary(self) -> str:
        adj = f"{self.adjustment_seconds:+.1f}s"
        prev_txt = f'"{self.preceding_cue.text[:35]}..."' if self.preceding_cue else "None"
        next_txt = f'"{self.succeeding_cue.text[:35]}..."' if self.succeeding_cue else "None"
        return (
            f"Snapped {seconds_to_timestamp(self.original_target)} -> {self.snapped_timestamp} "
            f"({adj}, lull: {self.gap_duration:.1f}s) between {prev_txt} and {next_txt}"
        )


def find_silence_gaps(
    cues: List[SubtitleCue],
    window_start: float,
    window_end: float,
) -> List[Tuple[float, float, float, Optional[SubtitleCue], Optional[SubtitleCue]]]:
    """Find all intervals without dialogue inside [window_start, window_end].

    Returns list of tuples: (gap_start, gap_end, gap_duration, prev_cue, next_cue).
    """
    gaps: List[Tuple[float, float, float, Optional[SubtitleCue], Optional[SubtitleCue]]] = []

    if not cues:
        return gaps

    # If window starts before first cue
    if window_start < cues[0].start_time:
        gap_end = min(window_end, cues[0].start_time)
        gaps.append((window_start, gap_end, gap_end - window_start, None, cues[0]))

    # Inter-cue gaps
    for i in range(len(cues) - 1):
        prev_c = cues[i]
        next_c = cues[i + 1]

        gap_start = prev_c.end_time
        gap_end = next_c.start_time

        # Check if this gap overlaps with our search window
        if gap_end > gap_start:  # There is actual silence
            if not (gap_end < window_start or gap_start > window_end):
                gaps.append((gap_start, gap_end, gap_end - gap_start, prev_c, next_c))

    # If window extends past last cue
    if window_end > cues[-1].end_time:
        gap_start = max(window_start, cues[-1].end_time)
        gaps.append((gap_start, window_end, window_end - gap_start, cues[-1], None))

    return gaps


def snap_to_micro_break(
    cues: List[SubtitleCue],
    target_seconds: float,
    window_seconds: float = 30.0,
    min_gap_seconds: float = 1.5,
    post_cue_buffer: float = 0.8,
) -> SnapResult:
    """Snap a target cut timestamp to the optimal dialogue silence gap within +/- window_seconds.

    Args:
        cues: List of subtitle cues sorted by start_time.
        target_seconds: Desired narrative cut point in seconds.
        window_seconds: Search radius in seconds (default 30s).
        min_gap_seconds: Preferred minimum dialogue silence length (default 1.5s).
        post_cue_buffer: Buffer added after speech ends to prevent harsh audio cutoff.

    Returns:
        SnapResult containing the snapped timestamp and diagnostic metadata.
    """
    if not cues:
        # No subtitles to guide cut; return target as is
        return SnapResult(
            original_target=target_seconds,
            snapped_seconds=target_seconds,
            snapped_timestamp=seconds_to_timestamp(target_seconds),
            gap_duration=0.0,
            preceding_cue=None,
            succeeding_cue=None,
            adjustment_seconds=0.0,
        )

    w_start = max(0.0, target_seconds - window_seconds)
    w_end = target_seconds + window_seconds

    gaps = find_silence_gaps(cues, w_start, w_end)

    if not gaps:
        # Fallback: find nearest cue boundary
        nearest_cue = min(cues, key=lambda c: abs(c.end_time - target_seconds))
        snapped = nearest_cue.end_time + post_cue_buffer
        return SnapResult(
            original_target=target_seconds,
            snapped_seconds=snapped,
            snapped_timestamp=seconds_to_timestamp(snapped),
            gap_duration=0.0,
            preceding_cue=nearest_cue,
            succeeding_cue=None,
            adjustment_seconds=snapped - target_seconds,
        )

    # Filter by min_gap_seconds if possible; if none meet threshold, pick largest available gap
    valid_gaps = [g for g in gaps if g[2] >= min_gap_seconds]
    candidates = valid_gaps if valid_gaps else gaps

    # Score candidates: prioritize larger pauses while favoring proximity to the narrative target
    # score = gap_duration - (abs(target - gap_midpoint) * 0.1)
    best_gap = None
    best_score = float("-inf")

    for gap_start, gap_end, duration, prev_c, next_c in candidates:
        midpoint = (gap_start + gap_end) / 2.0
        distance = abs(midpoint - target_seconds)
        # Give strong weight to long gaps (e.g. > 3s indicate scene changes)
        score = min(duration, 5.0) * 2.0 - (distance * 0.15)
        if score > best_score:
            best_score = score
            best_gap = (gap_start, gap_end, duration, prev_c, next_c)

    assert best_gap is not None
    gap_start, gap_end, duration, prev_c, next_c = best_gap

    # Calculate ideal snap cut point within the silence gap
    if prev_c is not None:
        # Leave a breathing buffer after the preceding sentence finishes
        snapped = min(gap_start + post_cue_buffer, (gap_start + gap_end) / 2.0)
    else:
        snapped = gap_start

    # Round to 1 decimal place or whole seconds
    snapped = round(snapped, 1)

    return SnapResult(
        original_target=target_seconds,
        snapped_seconds=snapped,
        snapped_timestamp=seconds_to_timestamp(snapped),
        gap_duration=duration,
        preceding_cue=prev_c,
        succeeding_cue=next_c,
        adjustment_seconds=round(snapped - target_seconds, 1),
    )

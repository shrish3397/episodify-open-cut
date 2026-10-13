"""Micro-Break Snapping engine to find natural dialogue lulls and visual scene transitions."""

from __future__ import annotations

import re
import shutil
import subprocess
from dataclasses import dataclass
from typing import List, Optional, Tuple

from eoc.models import SubtitleCue, seconds_to_timestamp


@dataclass
class SnapResult:
    """Result of snapping a target cut timestamp to a natural dialogue lull or scene transition."""

    original_target: float
    snapped_seconds: float
    snapped_timestamp: str
    gap_duration: float
    preceding_cue: Optional[SubtitleCue]
    succeeding_cue: Optional[SubtitleCue]
    adjustment_seconds: float
    scene_boundary_verified: bool = False
    cut_type: str = "dialogue_lull"

    @property
    def summary(self) -> str:
        adj = f"{self.adjustment_seconds:+.1f}s"
        prev_txt = f'"{self.preceding_cue.text[:35]}..."' if self.preceding_cue else "None"
        next_txt = f'"{self.succeeding_cue.text[:35]}..."' if self.succeeding_cue else "None"
        scene_flag = " [Scene Verified]" if self.scene_boundary_verified else ""
        return (
            f"Snapped {seconds_to_timestamp(self.original_target)} -> {self.snapped_timestamp} "
            f"({adj}, lull: {self.gap_duration:.1f}s{scene_flag}) between {prev_txt} and {next_txt}"
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


def is_during_dialogue_silence(
    timestamp: float,
    gaps: List[Tuple[float, float, float, Optional[SubtitleCue], Optional[SubtitleCue]]],
    min_gap_sec: float = 0.0,
) -> bool:
    """Check if a timestamp falls within any detected dialogue silence gap."""
    for gap_start, gap_end, duration, _, _ in gaps:
        if duration >= min_gap_sec and gap_start <= timestamp <= gap_end:
            return True
    return False


def detect_visual_scene_cuts(
    video_path: str,
    min_time_sec: float = 0.0,
    max_time_sec: float = float("inf"),
    threshold: float = 27.0,
) -> List[float]:
    """Detect visual scene transitions using PySceneDetect or FFmpeg."""
    cuts: List[float] = []

    # 1. Try PySceneDetect
    try:
        from scenedetect import ContentDetector, detect

        scene_list = detect(video_path, ContentDetector(threshold=threshold))
        for scene in scene_list:
            t = scene[0].get_seconds()
            if min_time_sec <= t <= max_time_sec:
                cuts.append(t)
        return cuts
    except ImportError:
        pass
    except Exception:
        pass

    # 2. Try FFmpeg scene filter fallback
    if shutil.which("ffmpeg"):
        try:
            cmd = [
                "ffmpeg",
                "-hide_banner",
                "-nostats",
                "-ss",
                str(max(0.0, min_time_sec)),
                "-to",
                str(max_time_sec),
                "-i",
                video_path,
                "-filter:v",
                "select='gt(scene,0.3)',metadata=print:file=-",
                "-f",
                "null",
                "-",
            ]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            for match in re.finditer(r"pts_time:([0-9.]+)", res.stdout):
                t = float(match.group(1)) + max(0.0, min_time_sec)
                if min_time_sec <= t <= max_time_sec:
                    cuts.append(t)
            return sorted(set(cuts))
        except Exception:
            pass

    return cuts


def find_exact_scene_break(
    cues: List[SubtitleCue],
    target_time_sec: float,
    video_path: Optional[str] = None,
    search_window_sec: float = 60.0,
    min_gap_sec: float = 1.5,
    visual_scene_cuts: Optional[List[float]] = None,
) -> SnapResult:
    """Dual-layer boundary detection: finds visual scene transitions cross-referenced with dialogue silence."""
    min_time = max(0.0, target_time_sec - search_window_sec)
    max_time = target_time_sec + search_window_sec

    gaps = find_silence_gaps(cues, min_time, max_time)

    # 1. Get visual scene change timestamps
    if visual_scene_cuts is not None:
        candidate_cuts = [t for t in visual_scene_cuts if min_time <= t <= max_time]
    elif video_path:
        candidate_cuts = detect_visual_scene_cuts(video_path, min_time, max_time)
    else:
        candidate_cuts = []

    # 2. Match visual cuts against subtitle silence lulls (> min_gap_sec)
    valid_cuts = []
    for cut_time in candidate_cuts:
        if is_during_dialogue_silence(cut_time, gaps, min_gap_sec=min_gap_sec):
            valid_cuts.append(cut_time)

    # If none meet min_gap_sec threshold, check for any dialogue silence (> 0.0s)
    if not valid_cuts and candidate_cuts:
        for cut_time in candidate_cuts:
            if is_during_dialogue_silence(cut_time, gaps, min_gap_sec=0.0):
                valid_cuts.append(cut_time)

    # 3. If exact scene cuts coincide with dialogue silence, choose candidate closest to target
    if valid_cuts:
        best_cut = min(valid_cuts, key=lambda t: abs(t - target_time_sec))
        prev_c = max([c for c in cues if c.end_time <= best_cut], key=lambda c: c.end_time, default=None)
        next_c = min([c for c in cues if c.start_time >= best_cut], key=lambda c: c.start_time, default=None)
        gap_dur = (next_c.start_time - prev_c.end_time) if (prev_c and next_c) else 0.0

        return SnapResult(
            original_target=target_time_sec,
            snapped_seconds=round(best_cut, 3),
            snapped_timestamp=seconds_to_timestamp(best_cut, include_millis=True),
            gap_duration=round(gap_dur, 2),
            preceding_cue=prev_c,
            succeeding_cue=next_c,
            adjustment_seconds=round(best_cut - target_time_sec, 2),
            scene_boundary_verified=True,
            cut_type="hard_cut_with_silence",
        )

    # Fallback to nearest visual cut if candidate cuts exist but none in silence
    if candidate_cuts:
        best_cut = min(candidate_cuts, key=lambda t: abs(t - target_time_sec))
        prev_c = max([c for c in cues if c.end_time <= best_cut], key=lambda c: c.end_time, default=None)
        next_c = min([c for c in cues if c.start_time >= best_cut], key=lambda c: c.start_time, default=None)
        gap_dur = (next_c.start_time - prev_c.end_time) if (prev_c and next_c) else 0.0

        return SnapResult(
            original_target=target_time_sec,
            snapped_seconds=round(best_cut, 3),
            snapped_timestamp=seconds_to_timestamp(best_cut, include_millis=True),
            gap_duration=round(gap_dur, 2),
            preceding_cue=prev_c,
            succeeding_cue=next_c,
            adjustment_seconds=round(best_cut - target_time_sec, 2),
            scene_boundary_verified=True,
            cut_type="visual_cut_without_silence",
        )

    # Fallback to standard micro-break dialogue silence snapping
    result = snap_to_micro_break(
        cues,
        target_time_sec,
        window_seconds=search_window_sec,
        min_gap_seconds=min_gap_sec,
    )
    # Long pauses (>= 2.5s) generally represent natural scene boundaries in audio
    result.scene_boundary_verified = result.gap_duration >= 2.5
    result.cut_type = "dialogue_lull"
    return result


def snap_to_micro_break(
    cues: List[SubtitleCue],
    target_seconds: float,
    window_seconds: float = 30.0,
    min_gap_seconds: float = 1.5,
    post_cue_buffer: float = 0.8,
    constraint: str = "dialogue_lull",
    video_path: Optional[str] = None,
    visual_scene_cuts: Optional[List[float]] = None,
) -> SnapResult:
    """Snap a target cut timestamp to the optimal dialogue silence gap or scene boundary.

    Args:
        cues: List of subtitle cues sorted by start_time.
        target_seconds: Desired narrative cut point in seconds.
        window_seconds: Search radius in seconds (default 30s).
        min_gap_seconds: Preferred minimum dialogue silence length (default 1.5s).
        post_cue_buffer: Buffer added after speech ends to prevent harsh audio cutoff.
        constraint: Snapping mode ("dialogue_lull" or "scene_boundary").
        video_path: Optional video file path for visual frame scene cuts.
        visual_scene_cuts: Optional precomputed visual scene transition timestamps.

    Returns:
        SnapResult containing the snapped timestamp and diagnostic metadata.
    """
    if constraint == "scene_boundary" or video_path is not None or visual_scene_cuts is not None:
        return find_exact_scene_break(
            cues=cues,
            target_time_sec=target_seconds,
            video_path=video_path,
            search_window_sec=window_seconds,
            min_gap_sec=min_gap_seconds,
            visual_scene_cuts=visual_scene_cuts,
        )

    if not cues:
        return SnapResult(
            original_target=target_seconds,
            snapped_seconds=target_seconds,
            snapped_timestamp=seconds_to_timestamp(target_seconds),
            gap_duration=0.0,
            preceding_cue=None,
            succeeding_cue=None,
            adjustment_seconds=0.0,
            scene_boundary_verified=False,
            cut_type="dialogue_lull",
        )

    w_start = max(0.0, target_seconds - window_seconds)
    w_end = target_seconds + window_seconds

    gaps = find_silence_gaps(cues, w_start, w_end)

    if not gaps:
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
            scene_boundary_verified=False,
            cut_type="dialogue_lull",
        )

    valid_gaps = [g for g in gaps if g[2] >= min_gap_seconds]
    candidates = valid_gaps if valid_gaps else gaps

    best_gap = None
    best_score = float("-inf")

    for gap_start, gap_end, duration, prev_c, next_c in candidates:
        midpoint = (gap_start + gap_end) / 2.0
        distance = abs(midpoint - target_seconds)
        score = min(duration, 5.0) * 2.0 - (distance * 0.15)
        if score > best_score:
            best_score = score
            best_gap = (gap_start, gap_end, duration, prev_c, next_c)

    assert best_gap is not None
    gap_start, gap_end, duration, prev_c, next_c = best_gap

    if prev_c is not None:
        snapped = min(gap_start + post_cue_buffer, (gap_start + gap_end) / 2.0)
    else:
        snapped = gap_start

    snapped = round(snapped, 1)

    return SnapResult(
        original_target=target_seconds,
        snapped_seconds=snapped,
        snapped_timestamp=seconds_to_timestamp(snapped),
        gap_duration=duration,
        preceding_cue=prev_c,
        succeeding_cue=next_c,
        adjustment_seconds=round(snapped - target_seconds, 1),
        scene_boundary_verified=duration >= 2.5,
        cut_type="dialogue_lull",
    )

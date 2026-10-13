"""Narrative beat analyzer and miniseries segmenter.

Supports:
1. Google Gemini 3.8 Flash (via google-genai SDK or direct HTTPS REST API)
2. Local Ollama (e.g. Llama 3 / Mistral)
3. Offline Heuristic Screenplay Segmenter (pure rule-based fallback)
"""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

from eoc.models import Episode, Recipe, RecipeMeta, SubtitleCue, seconds_to_timestamp, timestamp_to_seconds
from eoc.snapper import snap_to_micro_break

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass


SYSTEM_INSTRUCTION = """You are an award-winning film editor, television showrunner, and dramaturgist.
Your task is to transform a feature-length film screenplay/subtitles into a bingeable prestige miniseries.

STRICT CONSTRAINTS & RULES:
1. Exact Scene Transitions: Episode target_end_time MUST occur at an EXACT SCENE TRANSITION (e.g., location change, time jump, sequence resolution, or fade to black).
2. Silence & Dialogue Integrity: DO NOT cut in the middle of an active scene or ongoing conversation. Verify that dialogue has completely stopped before setting the target_end_time timestamp.
3. Savor the story: Slices must occur at natural narrative act breaks, suspense climaxes, or compelling cliffhangers.
4. Target episode runtimes: 25 to 45 minutes each.
5. Every episode must have:
   - episode_number (integer, 1-indexed)
   - title (evocative, cinematic episode title)
   - target_end_time (timestamp in "HH:MM:SS" format where the episode concludes)
   - cliffhanger_rating (float 1.0 to 10.0 indicating suspense level)
   - break_rationale (1-2 sentences on why this moment is the ideal episodic boundary)
   - recap_text (2-3 sentences summarizing this episode's key developments for "Previously on...")
   - teaser_next (1-2 sentences teasing the upcoming episode)

Return ONLY a valid JSON object with the key "episodes".
"""


def estimate_episode_count(runtime_seconds: float) -> int:
    """Recommend an ideal miniseries episode count based on movie runtime."""
    mins = runtime_seconds / 60.0
    if mins <= 100:
        return 3
    elif mins <= 155:
        return 4
    elif mins <= 210:
        return 5
    else:
        return 6


def format_subtitles_for_prompt(cues: List[SubtitleCue], max_cues: int = 2500) -> str:
    """Sample or format subtitle cues into a clean transcript with timestamps."""
    step = 1
    if len(cues) > max_cues:
        step = len(cues) // max_cues + 1

    lines = []
    for c in cues[::step]:
        ts = seconds_to_timestamp(c.start_time)
        lines.append(f"[{ts}] {c.text}")
    return "\n".join(lines)


class HeuristicAnalyzer:
    """Offline, deterministic screenplay narrative segmenter based on classical 3-act structure."""

    def analyze(
        self,
        cues: List[SubtitleCue],
        title: str,
        year: int,
        runtime_seconds: int,
        target_episodes: int,
        pacing: str = "prestige_drama",
        constraint: str = "dialogue_lull",
        video_path: Optional[str] = None,
        visual_scene_cuts: Optional[List[float]] = None,
    ) -> List[Dict[str, Any]]:
        total_time = float(runtime_seconds) if runtime_seconds > 0 else (cues[-1].end_time if cues else 7200.0)

        # Classical 3-act proportions
        # For 3 episodes: Act I (~28%), Act II (~65%), Act III (100%)
        # For 4 episodes: Act I (~25%), Act II-A (~50%), Act II-B (~75%), Act III (100%)
        # For 5 episodes: 20%, 40%, 60%, 80%, 100%
        proportions = []
        for i in range(1, target_episodes):
            proportions.append(i / float(target_episodes))

        raw_cuts = [total_time * p for p in proportions]
        episodes_data = []

        thematic_names = [
            ("The Inciting Spark", "A world established is shattered by an irrevocable choice.", 8.2),
            ("Crossing the Rubicon", "Protagonists venture into uncharted danger as stakes escalate.", 8.7),
            ("Point of No Return", "Tensions erupt into crisis; the mission faces catastrophic ruin.", 9.4),
            ("All is Lost", "At the darkest hour, the ultimate confrontation becomes inevitable.", 9.8),
            ("The Reckoning", "The climax unfolds with irreversible consequences.", 9.1),
            ("Daybreak & Shadows", "The resolution leaves lasting scars and a transformed world.", 7.5),
        ]

        curr_start = 0.0
        for ep_idx in range(1, target_episodes + 1):
            if ep_idx < target_episodes:
                raw_target = raw_cuts[ep_idx - 1]
                snap = snap_to_micro_break(
                    cues,
                    raw_target,
                    constraint=constraint,
                    video_path=video_path,
                    visual_scene_cuts=visual_scene_cuts,
                )
                end_sec = snap.snapped_seconds
            else:
                end_sec = total_time

            default_title, default_rationale, default_rating = thematic_names[
                (ep_idx - 1) % len(thematic_names)
            ]
            ep_title = f"{title}: Part {ep_idx} - {default_title}"

            episodes_data.append(
                {
                    "episode_number": ep_idx,
                    "title": ep_title,
                    "target_end_time": seconds_to_timestamp(end_sec),
                    "cliffhanger_rating": default_rating,
                    "break_rationale": (
                        f"Act break aligned at {seconds_to_timestamp(end_sec)}. {default_rationale}"
                    ),
                    "recap_text": (
                        f"In Episode {ep_idx}, the narrative builds through central conflicts "
                        f"leading up to the dramatic pause at {seconds_to_timestamp(end_sec)}."
                    ),
                    "teaser_next": (
                        f"Coming up in Episode {ep_idx + 1}, new alliances and escalating peril emerge."
                        if ep_idx < target_episodes
                        else "The concluding chapter brings the cinematic arc to its final crescendo."
                    ),
                }
            )
            curr_start = end_sec

        return episodes_data


class GeminiAnalyzer:
    """Narrative segmenter utilizing Google Gemini API (gemini-3.8-flash)."""

    def __init__(self, api_key: Optional[str] = None, model: str = "gemini-3.8-flash"):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        self.model = model

    def analyze(
        self,
        cues: List[SubtitleCue],
        title: str,
        year: int,
        runtime_seconds: int,
        target_episodes: int,
        pacing: str = "prestige_drama",
    ) -> List[Dict[str, Any]]:
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY environment variable or argument is required for GeminiAnalyzer.")

        transcript_sample = format_subtitles_for_prompt(cues)
        user_prompt = f"""Movie Title: {title} ({year})
Total Runtime: {runtime_seconds} seconds ({seconds_to_timestamp(runtime_seconds)})
Target Episodes: {target_episodes}
Pacing Preference: {pacing}

Here is the dialogue transcript with timestamps:
---
{transcript_sample}
---

Analyze the narrative arc. Choose exactly {target_episodes} episodes.
For each episode, provide:
- episode_number (1 to {target_episodes})
- title
- target_end_time ("HH:MM:SS" timestamp for episode cut, except the last episode which ends at {seconds_to_timestamp(runtime_seconds)})
- cliffhanger_rating (1.0 to 10.0)
- break_rationale
- recap_text
- teaser_next
"""

        # Try google-genai SDK if available
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=self.api_key)
            response = client.models.generate_content(
                model=self.model,
                contents=[user_prompt],
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_INSTRUCTION,
                    response_mime_type="application/json",
                ),
            )
            data = json.loads(response.text)
            return data.get("episodes", data)
        except ImportError:
            # Fallback to direct HTTPS REST API
            return self._call_rest_api(user_prompt)

    def _call_rest_api(self, prompt: str) -> List[Dict[str, Any]]:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent?key={self.api_key}"
        )
        payload = {
            "system_instruction": {"parts": [{"text": SYSTEM_INSTRUCTION}]},
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"response_mime_type": "application/json"},
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=60) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            candidate = res_data["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(candidate)
            return parsed.get("episodes", parsed)


class OllamaAnalyzer:
    """Local offline narrative analyzer using Ollama."""

    def __init__(self, host: str = "http://localhost:11434", model: str = "llama3"):
        self.host = host.rstrip("/")
        self.model = model

    def analyze(
        self,
        cues: List[SubtitleCue],
        title: str,
        year: int,
        runtime_seconds: int,
        target_episodes: int,
        pacing: str = "prestige_drama",
    ) -> List[Dict[str, Any]]:
        transcript_sample = format_subtitles_for_prompt(cues, max_cues=1200)
        user_prompt = f"""Movie: {title} ({year}), Runtime: {seconds_to_timestamp(runtime_seconds)}.
Segment into {target_episodes} bingeable episodes.
Output JSON schema: {{"episodes": [{{"episode_number": 1, "title": "...", "target_end_time": "HH:MM:SS", "cliffhanger_rating": 8.5, "break_rationale": "...", "recap_text": "...", "teaser_next": "..."}}]}}

Transcript:
{transcript_sample}
"""
        url = f"{self.host}/api/generate"
        payload = {
            "model": self.model,
            "prompt": f"{SYSTEM_INSTRUCTION}\n\n{user_prompt}",
            "stream": False,
            "format": "json",
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            parsed = json.loads(data["response"])
            return parsed.get("episodes", parsed)


def build_episodic_recipe(
    cues: List[SubtitleCue],
    title: str,
    year: int,
    runtime_seconds: Optional[int] = None,
    imdb_id: Optional[str] = None,
    tmdb_id: Optional[int] = None,
    episodes_count: Optional[int] = None,
    pacing: str = "prestige_drama",
    provider: str = "auto",
    gemini_api_key: Optional[str] = None,
    ollama_host: str = "http://localhost:11434",
    ollama_model: str = "llama3",
    constraint: str = "dialogue_lull",
    video_path: Optional[str] = None,
    visual_scene_cuts: Optional[List[float]] = None,
) -> Recipe:
    """Analyze movie subtitles and assemble a snapped, validated miniseries Recipe."""
    # Compute film duration if not provided
    if runtime_seconds is None or runtime_seconds <= 0:
        if cues:
            runtime_seconds = int(round(cues[-1].end_time + 15.0))
        else:
            runtime_seconds = 7200

    target_eps = episodes_count or estimate_episode_count(runtime_seconds)

    # Select segmentation engine
    generator_name = "eoc-heuristic"
    raw_episodes: List[Dict[str, Any]] = []

    api_key = gemini_api_key or os.environ.get("GEMINI_API_KEY")

    if provider == "gemini" or (provider == "auto" and api_key):
        try:
            analyzer = GeminiAnalyzer(api_key=api_key)
            raw_episodes = analyzer.analyze(
                cues, title, year, runtime_seconds, target_eps, pacing
            )
            generator_name = "gemini-3.8-flash"
        except Exception:
            if provider == "gemini":
                raise
            # In auto mode, fallback to heuristic if Gemini fails or is unconfigured
            analyzer = HeuristicAnalyzer()
            raw_episodes = analyzer.analyze(
                cues,
                title,
                year,
                runtime_seconds,
                target_eps,
                pacing,
                constraint=constraint,
                video_path=video_path,
                visual_scene_cuts=visual_scene_cuts,
            )
            generator_name = "eoc-heuristic"
    elif provider == "ollama":
        analyzer = OllamaAnalyzer(host=ollama_host, model=ollama_model)
        raw_episodes = analyzer.analyze(
            cues, title, year, runtime_seconds, target_eps, pacing
        )
        generator_name = f"ollama-{ollama_model}"
    else:
        analyzer = HeuristicAnalyzer()
        raw_episodes = analyzer.analyze(
            cues,
            title,
            year,
            runtime_seconds,
            target_eps,
            pacing,
            constraint=constraint,
            video_path=video_path,
            visual_scene_cuts=visual_scene_cuts,
        )
        generator_name = "eoc-heuristic"

    # Stage 2: Micro-Break Snapping to ensure seamless cuts on silence lulls or exact scene transitions
    processed_episodes: List[Episode] = []
    current_start_sec = 0.0

    num_items = len(raw_episodes)
    for i, item in enumerate(raw_episodes):
        ep_num = i + 1
        ep_title = item.get("title", f"{title} - Episode {ep_num}")

        if i == num_items - 1:
            # Final episode ends at runtime
            end_sec = float(runtime_seconds)
            snapped_ts = seconds_to_timestamp(end_sec)
            scene_verified = True
            cut_type = "end_of_film"
        else:
            raw_end = item.get("target_end_time") or item.get("end_time")
            if isinstance(raw_end, str):
                target_sec = timestamp_to_seconds(raw_end)
            elif isinstance(raw_end, (int, float)):
                target_sec = float(raw_end)
            else:
                target_sec = (runtime_seconds / num_items) * (i + 1)

            # Snap to silence lull or exact scene transition
            snap = snap_to_micro_break(
                cues,
                target_sec,
                constraint=constraint,
                video_path=video_path,
                visual_scene_cuts=visual_scene_cuts,
            )
            end_sec = snap.snapped_seconds
            snapped_ts = snap.snapped_timestamp
            scene_verified = snap.scene_boundary_verified
            cut_type = snap.cut_type

        start_ts = seconds_to_timestamp(current_start_sec)

        processed_episodes.append(
            Episode(
                episode_number=ep_num,
                title=ep_title,
                start_time=start_ts,
                end_time=snapped_ts,
                cliffhanger_rating=float(item.get("cliffhanger_rating", 8.0)),
                break_rationale=str(item.get("break_rationale", "Dramatic narrative transition.")),
                recap_text=str(item.get("recap_text", f"Key events of episode {ep_num}.")),
                teaser_next=str(item.get("teaser_next", "The story continues.")),
                scene_boundary_verified=scene_verified,
                cut_type=cut_type,
            )
        )
        current_start_sec = end_sec

    meta = RecipeMeta(
        title=title,
        year=year,
        runtime_seconds=runtime_seconds,
        imdb_id=imdb_id,
        tmdb_id=tmdb_id,
        pacing=pacing,
        generator=generator_name,
    )

    return Recipe(
        meta=meta,
        total_episodes=len(processed_episodes),
        episodes=processed_episodes,
    )

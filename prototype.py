"""Episodify Open Cut - Minimal Prototype Script.

Demonstrates the core 3-step pipeline:
  1. Input: Load raw movie subtitles from `data/`
  2. Process: Segment into narrative episodes (Heuristic or Gemini AI)
  3. Output: Save structured miniseries recipe to `output/`

Tip: In VS Code, you can run this script line-by-line or cell-by-cell
using Shift + Enter (Jupyter Interactive Window).
"""

# %% [1] Imports and Environment Setup
import os
import sys
from pathlib import Path

# Load local environment variables (.env) if present
try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

from eoc.analyzer import build_episodic_recipe
from eoc.parser import parse_subtitles
from eoc.recipe import save_recipe


# %% [2] Configuration
DATA_DIR = Path("data")
OUTPUT_DIR = Path("output")
OUTPUT_DIR.mkdir(exist_ok=True)

# Path to input subtitle file
SUBTITLE_PATH = DATA_DIR / "sample.srt"
MOVIE_TITLE = "Bethlehem Kudumba Unit"
MOVIE_YEAR = 2026
MOVIE_RUNTIME_SECONDS = 9360  # ~156 minutes
TARGET_EPISODES = 4

# Select provider: 'auto', 'gemini', 'ollama', or 'heuristic'
# 'heuristic' works offline with zero API keys or external services!
PROVIDER = "gemini" if os.getenv("GEMINI_API_KEY") else "heuristic"


# %% [3] Main Prototype Execution Pipeline
def run_prototype() -> None:
    print("=" * 60)
    print(f"🎬 Episodify Open Cut: Prototype Run")
    print(f"📽️  Film: {MOVIE_TITLE} ({MOVIE_YEAR})")
    print(f"⚙️  Narrative Engine: {PROVIDER}")
    print("=" * 60)

    # Step 1: Ingest Subtitles
    if not SUBTITLE_PATH.exists():
        print(f"❌ Subtitle file not found: {SUBTITLE_PATH}", file=sys.stderr)
        return

    try:
        print(f"\n[1/3] 📄 Reading raw subtitles from {SUBTITLE_PATH}...")
        cues = parse_subtitles(SUBTITLE_PATH)
        print(f"      Parsed {len(cues)} dialogue cues successfully.")
    except Exception as e:
        print(f"❌ Failed to parse subtitles: {e}", file=sys.stderr)
        return

    # Step 2: Analyze Narrative Arc & Micro-Break Snapping
    try:
        print(f"\n[2/3] 🧠 Segmenting into {TARGET_EPISODES} bingeable episodes...")
        recipe = build_episodic_recipe(
            cues=cues,
            title=MOVIE_TITLE,
            year=MOVIE_YEAR,
            runtime_seconds=MOVIE_RUNTIME_SECONDS,
            episodes_count=TARGET_EPISODES,
            provider=PROVIDER,
        )
    except Exception as e:
        print(f"❌ Segmentation failed: {e}", file=sys.stderr)
        return

    # Step 3: Export Miniseries Recipe
    output_path = OUTPUT_DIR / "prototype-cut.eoc.json"
    try:
        print(f"\n[3/3] 💾 Saving deliverable recipe to {output_path}...")
        saved_file = save_recipe(recipe, output_path)
        print(f"      Saved: {saved_file}")
    except Exception as e:
        print(f"❌ Failed to save recipe: {e}", file=sys.stderr)
        return

    # Summary Display
    print("\n" + "=" * 60)
    print(f"✨ MINISERIES GENERATED: {recipe.total_episodes} EPISODES")
    print("=" * 60)
    for ep in recipe.episodes:
        print(f"  📺 Episode {ep.episode_number}: {ep.title}")
        print(f"     Time: {ep.start_time} ➔ {ep.end_time} ({ep.formatted_duration})")
        print(f"     Cliffhanger Rating: {ep.cliffhanger_rating}/10")
        print(f"     Rationale: {ep.break_rationale}\n")


# %% [4] Entrypoint
if __name__ == "__main__":
    run_prototype()

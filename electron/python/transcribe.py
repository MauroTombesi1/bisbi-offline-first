#!/usr/bin/env python3
"""Runs a single transcription with OpenAI's official Whisper package
(https://github.com/openai/whisper). Invoked as a subprocess by
electron/src/backend/transcriber.ts — one process per transcription, same
lifecycle whisper-cli used to have, just swapping the engine.

Usage: transcribe.py <model_name> <wav_path> <download_root>
Prints a single JSON object to stdout: {"text": str, "language": str|None}
"""
import json
import sys


def main() -> int:
    if len(sys.argv) != 4:
        print(json.dumps({"error": "usage: transcribe.py <model> <wav_path> <download_root>"}), file=sys.stderr)
        return 2

    model_name, wav_path, download_root = sys.argv[1], sys.argv[2], sys.argv[3]

    try:
        import whisper
    except ImportError:
        print(json.dumps({"error": "openai-whisper package is not installed"}), file=sys.stderr)
        return 3

    try:
        model = whisper.load_model(model_name, download_root=download_root)
        result = model.transcribe(wav_path, fp16=False, temperature=0.0)
    except Exception as exc:  # noqa: BLE001 - surface any failure to the caller
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 1

    print(json.dumps({
        "text": (result.get("text") or "").strip(),
        "language": result.get("language"),
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main())

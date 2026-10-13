#!/usr/bin/env python3
"""Long-lived transcription worker for OpenAI's official Whisper package
(https://github.com/openai/whisper). Loads the model ONCE and then serves
many transcription requests over stdin/stdout — spawning a fresh process per
call (the old transcribe.py) meant reloading the whole checkpoint every
time, which is a rounding error for `tiny`/`base` but makes anything
`medium`+ painfully slow, especially for the live-caption pass that fires
every ~1.8s while recording. Kept alive by
electron/src/backend/transcriber.ts and restarted only when the selected
model changes.

Usage: worker.py <model_name> <download_root> [model_path]
  model_path is the checkpoint resolved by the Electron side (which prefers
  the copy bundled in resources/). When it points at an existing file we load
  it directly, since whisper.load_model(name, download_root=...) would
  otherwise ignore it and re-download the whole checkpoint from OpenAI's CDN.
Protocol (newline-delimited JSON both ways):
  startup:  stdout <- {"ready": true}                    (once, after the model loads)
                   <- {"error": "..."}                    (if loading fails; process exits)
  request:  stdin  -> {"id": <int>, "wav_path": "<path>", "language": "<code>"?}
                   (language is optional — the Electron side only sends it for
                   multilingual checkpoints; English-only ".en" models never
                   get one since they have nothing to do with it)
  response: stdout <- {"id": <int>, "text": "...", "language": "..."}
                   <- {"id": <int>, "error": "..."}
"""
import json
import os
import sys


def main() -> int:
    if len(sys.argv) not in (3, 4):
        print(
            json.dumps({"error": "usage: worker.py <model> <download_root> [model_path]"}),
            flush=True,
        )
        return 2

    model_name, download_root = sys.argv[1], sys.argv[2]
    model_path = sys.argv[3] if len(sys.argv) == 4 else None

    try:
        import whisper
    except ImportError:
        print(json.dumps({"error": "openai-whisper package is not installed"}), flush=True)
        return 3

    # load_model() takes either an official model id (which it resolves against
    # download_root, downloading on miss) or a direct path to a .pt checkpoint.
    # Prefer the path we were handed so an already-present checkpoint is never
    # re-downloaded; fall back to the id so a genuinely missing model still
    # self-heals. Loading by path yields alignment_heads=None, which only
    # matters for word_timestamps=True — not used below.
    target = model_path if model_path and os.path.isfile(model_path) else model_name

    try:
        model = whisper.load_model(target, download_root=download_root)
    except Exception as exc:  # noqa: BLE001 - surface any failure to the caller
        print(json.dumps({"error": str(exc)}), flush=True)
        return 1

    print(json.dumps({"ready": True}), flush=True)

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        req_id = None
        try:
            req = json.loads(line)
            req_id = req.get("id")
            language = req.get("language")
            kwargs = {"language": language} if language else {}
            result = model.transcribe(req["wav_path"], fp16=False, temperature=0.0, **kwargs)
            print(json.dumps({
                "id": req_id,
                "text": (result.get("text") or "").strip(),
                "language": result.get("language"),
            }), flush=True)
        except Exception as exc:  # noqa: BLE001 - one bad request must not kill the worker
            print(json.dumps({"id": req_id, "error": str(exc)}), flush=True)

    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python
"""Classify one audio file with lv-chordia and print JSON for the Node server."""

from __future__ import annotations

import argparse
import importlib.resources
import json
import sys
import time
import warnings
from pathlib import Path

warnings.filterwarnings(
    "ignore",
    message="Couldn't find ffmpeg or avconv.*",
    category=RuntimeWarning,
)

SETUP_HINT = (
    "lv-chordia is not installed for this Python interpreter. "
    "From the backend directory, run `npm run setup:ai`, then restart the backend server. "
    "You can also set LV_CHORDIA_PYTHON to the Python executable that has lv-chordia installed."
)

try:
    import numpy as np
    import torch

    from lv_chordia.chord_recognition import MODEL_NAMES
    from lv_chordia.chordnet_ismir_naive import ChordNet
    from lv_chordia.extractors.cqt import CQTV2
    from lv_chordia.extractors.xhmm_ismir import XHMMDecoder
    from lv_chordia.mir import DataEntry, io
    from lv_chordia.mir.nn.train import NetworkInterface
    from lv_chordia.settings import DEFAULT_HOP_LENGTH, DEFAULT_SR
except ModuleNotFoundError as error:
    missing_package = error.name or "a required package"
    raise SystemExit(f"{SETUP_HINT} Missing module: {missing_package}") from None


class LvChordiaRecognizer:
    def __init__(self, chord_dict_name: str) -> None:
        with importlib.resources.path(
            "lv_chordia.data",
            f"{chord_dict_name}_chord_list.txt",
        ) as data_file:
            self.hmm = XHMMDecoder(template_file=str(data_file))

        print("Loading lv-chordia models...", file=sys.stderr)
        self.nets = [
            NetworkInterface(ChordNet(None), model_name, load_checkpoint=False)
            for model_name in MODEL_NAMES
        ]
        print("Models ready.", file=sys.stderr)

    def recognize(self, audio_path: Path) -> list[dict[str, float | str]]:
        entry = DataEntry()
        entry.prop.set("sr", DEFAULT_SR)
        entry.prop.set("hop_length", DEFAULT_HOP_LENGTH)
        entry.append_file(str(audio_path), io.MusicIO, "music")
        entry.append_extractor(CQTV2, "cqt")

        probs = [net.inference(entry.cqt) for net in self.nets]
        probs = [
            np.mean([model_probs[i] for model_probs in probs], axis=0)
            for i in range(len(probs[0]))
        ]
        chordlab = self.hmm.decode_to_chordlab(entry, probs, False)

        return [
            {
                "start_time": float(f"{segment[0]:.2f}"),
                "end_time": float(f"{segment[1]:.2f}"),
                "chord": str(segment[2]),
            }
            for segment in chordlab
        ]


def summarize_chord(results: list[dict[str, float | str]]) -> str:
    voiced = [item for item in results if item["chord"] != "N"]
    candidates = voiced if voiced else results
    if not candidates:
        return "N"

    best = max(
        candidates,
        key=lambda item: float(item["end_time"]) - float(item["start_time"]),
    )
    return str(best["chord"])


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Classify one audio file.")
    parser.add_argument("audio", help="Input audio file path.")
    parser.add_argument(
        "--chord-dict",
        choices=("submission", "ismir2017", "full"),
        default="submission",
        help="Chord vocabulary to use.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    audio_path = Path(args.audio).expanduser().resolve()
    if not audio_path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    started = time.time()
    device = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"
    recognizer = LvChordiaRecognizer(args.chord_dict)
    segments = recognizer.recognize(audio_path)

    print(json.dumps({
        "source": "lv-chordia",
        "device": device,
        "chord": summarize_chord(segments),
        "segments": segments,
        "elapsedSeconds": round(time.time() - started, 2),
    }))


if __name__ == "__main__":
    main()

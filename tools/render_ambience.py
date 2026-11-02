"""Rebuild the v4.2 offline ambience beds from licensed source recordings.

Requires Python 3, numpy, ffmpeg and ffprobe. Run from any directory:
  python tools/render_ambience.py
Sources are cached outside the repository; each download is SHA256 pinned.
No audio service, credentials, generated music, or bird-call oscillators are used.
"""
from pathlib import Path
import argparse
import hashlib
import json
import re
import subprocess
import tempfile
import urllib.request
import wave

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RATE = 44100
SECONDS = 40
CROSSFADE = 3
LICENSE = "https://creativecommons.org/publicdomain/zero/1.0/"
SOURCES = {
    "grassland": dict(file="park_ambience_wind.wav", start=52, highpass=110, lowpass=6500,
        author="Thimras", page="https://opengameart.org/content/park-ambiences",
        url="https://opengameart.org/sites/default/files/park_ambience_wind.wav",
        sha256="5c381856745b4706e7eba55eb9271a61a530e90c05df8126adb2db89ecfa6c5a",
        description="Open-field winter wind, Adelaide, South Australia."),
    "forest": dict(file="park_ambience_birds.wav", start=110, highpass=110, lowpass=6500,
        author="Thimras", page="https://opengameart.org/content/park-ambiences",
        url="https://opengameart.org/sites/default/files/park_ambience_birds.wav",
        sha256="dc1a5ac34b89cab7f8f261b53a23da7c1c5e3cc895aae4cb6fb4a1a04001b2af",
        description="Birds near a copse of trees before rain, Adelaide, South Australia."),
    "alpine": dict(file="alps.mp3", start=52, highpass=125, lowpass=5000,
        author="kyles", page="https://freesound.org/people/kyles/sounds/454092/",
        url="https://cdn.freesound.org/previews/454/454092_612689-hq.mp3",
        sha256="2205b22f08b43c5f4bbee344a62c3d3717938cd65d5cc1db2c3c20576d338013",
        description="Mountain wind heavy strong gusts, Swiss Alps (author title)."),
    "desert": dict(file="atacama.mp3", start=45, highpass=140, lowpass=5000,
        author="felix.blume", page="https://freesound.org/people/felix.blume/sounds/146914/",
        url="https://cdn.freesound.org/previews/146/146914_1661766-hq.mp3",
        sha256="ef6b9ea532919862fcf0680ddab1eeb112248f2513ce738c161042fdff93831d",
        description="Wind blowing and howling in the Moon Valley, Atacama Desert, Chile."),
    "lagoon": dict(file="lake.mp3", start=117, highpass=80, lowpass=7000,
        transient_filter="alimiter=limit=0.0625:attack=5:release=120:level=false:latency=true",
        author="TheFlyFishingFilmmaker", page="https://freesound.org/people/TheFlyFishingFilmmaker/sounds/614299/",
        url="https://cdn.freesound.org/previews/614/614299_6501596-hq.mp3",
        sha256="29adca4215a5e89e19d4e5bb407cc7d2b35c1fd0c1c383e59845050329d077ea",
        description="Gentle lake waves lapping against rocks, Eastern Washington."),
    "cavern": dict(file="karst.mp3", start=1, highpass=80, lowpass=6500, peak_ceiling=-6.5,
        author="nomadas", page="https://freesound.org/people/nomadas/sounds/609161/",
        url="https://cdn.freesound.org/previews/609/609161_938246-hq.mp3",
        sha256="61e2afed409f0db538dd38770cbf1dfe617e9908b5f4054454c781a2c29acf32",
        description="Water drips in Cacique hall, Ojo Guarena karst system, Burgos, Spain; Sony PCM-D50."),
}


def run(args):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors="replace"))
    return result


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def loudness(path):
    result = run(["ffmpeg", "-hide_banner", "-i", str(path), "-af",
                  "loudnorm=I=-26:TP=-8:LRA=11:print_format=json", "-f", "null", "-"])
    obj = json.loads(re.findall(rb"\{[^{}]+\}", result.stderr)[-1])
    return {"integrated_lufs": float(obj["input_i"]),
            "true_peak_dbfs": float(obj["input_tp"]),
            "loudness_range_lu": float(obj["input_lra"])}


def decode(path):
    data = run(["ffmpeg", "-v", "error", "-i", str(path), "-ar", str(RATE),
                "-ac", "2", "-f", "f32le", "-"]).stdout
    return np.frombuffer(data, dtype="<f4").reshape(-1, 2).copy()


def metrics(path):
    data = decode(path)
    rms = float(np.sqrt(np.mean(data.astype(float) ** 2)))
    delta = np.abs(np.diff(data, axis=0))
    seam = float(np.max(np.abs(data[-1] - data[0])))
    p99 = float(np.quantile(delta, .99))
    edge = RATE // 4
    edges = [float(np.sqrt(np.mean(part.astype(float) ** 2)))
             for part in [data[:edge], data[-edge:]]]
    # Averaged one-second periodograms: descriptive diagnostic, not a quality score.
    mono = data.mean(axis=1)
    blocks = mono[:len(mono) // RATE * RATE].reshape(-1, RATE)
    psd = np.mean(np.abs(np.fft.rfft(blocks * np.hanning(RATE), axis=1)) ** 2, axis=0)
    band = psd[80:1501]
    peak_db = 20 * np.log10(max(float(np.max(np.abs(data))), 1e-12))
    result = dict(file=path.name, sha256=digest(path), bytes=path.stat().st_size,
        decoded_seconds=round(len(data) / RATE, 6), sample_rate_hz=RATE, channels=2,
        sample_peak_dbfs=round(float(peak_db), 3), rms_dbfs=round(float(20 * np.log10(rms)), 3),
        loop_sample_jump=round(seam, 8), native_sample_delta_p99=round(p99, 8),
        loop_jump_over_native_p99=round(seam / max(p99, 1e-12), 4),
        first_last_250ms_rms_over_global=[round(x / rms, 4) for x in edges],
        max_1hz_bin_over_median_80_1500hz_db=round(float(10 * np.log10(np.max(band) / max(np.median(band), 1e-20))), 3),
        finite=bool(np.isfinite(data).all()))
    result.update(loudness(path))
    return result


def write_wav(path, samples):
    pcm = np.rint(np.clip(samples, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(pcm.tobytes())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=ROOT.parent / "output_game_v4" / "audio-sources-v4_2")
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    before_dir = ROOT.parent / "output_game_v4" / "audio-before-v4_2"
    before = {p.stem: metrics(p) for p in sorted(before_dir.glob("*.mp3"))}
    after = {}
    for theme, source in SOURCES.items():
        cached = args.cache / source["file"]
        if not cached.exists():
            urllib.request.urlretrieve(source["url"], cached)
        if digest(cached) != source["sha256"]:
            raise ValueError(f"Source hash mismatch: {cached}; refusing changed upstream audio")
        with tempfile.TemporaryDirectory(prefix="windward-audio-") as temp:
            temp = Path(temp)
            raw = temp / "filtered.wav"
            filt = f"highpass=f={source['highpass']},lowpass=f={source['lowpass']}"
            if source.get("transient_filter"):
                filt += "," + source["transient_filter"]
            run(["ffmpeg", "-v", "error", "-y", "-ss", str(source["start"]), "-i", str(cached),
                 "-t", str(SECONDS + CROSSFADE), "-ar", str(RATE), "-ac", "2", "-af", filt, str(raw)])
            data = decode(raw)
            n = RATE * CROSSFADE
            assert len(data) == RATE * (SECONDS + CROSSFADE)
            # The file starts at source t=3 and finishes at source t=3 again.
            # Fade between the tail and the preceding 3 seconds, never to silence.
            loop = data[n:].copy()
            phase = np.linspace(0, np.pi / 2, n, endpoint=True)[:, None]
            loop[-n:] = data[-n:] * np.cos(phase) + data[:n] * np.sin(phase)
            loop_wav = temp / "loop.wav"
            write_wav(loop_wav, loop)
            measured = loudness(loop_wav)
            gain_db = min(-26 - measured["integrated_lufs"], source.get("peak_ceiling", -8.5) - measured["true_peak_dbfs"])
            # Constant gain preserves source dynamics and the circular seam.
            out = ROOT / "assets" / f"{theme}.mp3"
            run(["ffmpeg", "-v", "error", "-y", "-i", str(loop_wav), "-af", f"volume={gain_db:.6f}dB",
                 "-codec:a", "libmp3lame", "-b:a", "112k", "-ar", str(RATE), "-map_metadata", "-1",
                 "-metadata", f"title=Windward Trails - {theme} ambience",
                 "-metadata", f"artist={source['author']}", "-metadata", f"copyright=CC0 1.0; {source['page']}", str(out)])
            after[theme] = metrics(out)
            after[theme].update(source_file=source["file"], source_sha256=source["sha256"],
                source_start_seconds=source["start"], source_length_seconds=43,
                circular_crossfade_seconds=3, constant_gain_db=round(gain_db, 6), filter=filt)
            assert after[theme]["finite"]
            assert after[theme]["decoded_seconds"] == SECONDS
            assert after[theme]["true_peak_dbfs"] < -6
            assert -28.5 <= after[theme]["integrated_lufs"] <= -24
            assert after[theme]["loop_jump_over_native_p99"] < 3
            print(theme, json.dumps(after[theme]), flush=True)
    report = dict(version="v4.2", method="real licensed recordings; 43-second trim, 3-second circular equal-power overlap, constant loudness gain, 112kbps MP3",
        license=LICENSE, ffmpeg_version=run(["ffmpeg", "-version"]).stdout.decode().splitlines()[0], before=before, after=after,
        perceptual_review="Not performed. Decode, loudness, spectral and seam checks cannot establish naturalness, absence of unwanted source events, or perceived loop continuity on the user's device.",
        music="Removed; no music layer or oscillator birds added.",
        playback_note="MP3 includes gapless encoder metadata. Actual HTML audio loop timing remains browser-dependent; inspect multiple wraps by ear.")
    (ROOT / "qa" / "audio-quality.json").write_text(json.dumps(report, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()

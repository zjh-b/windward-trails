# Ambient audio credits and reproduction

The six v4.2 ambience files replace the previous procedural musical beds.
No music, synthetic bird whistles, chimes, or added oscillator drones are mixed
into these replacements. Each MP3 is bundled locally; the game needs no audio
network request after installation.

All source recordings below are released under **[CC0 1.0 Universal Public
Domain Dedication](https://creativecommons.org/publicdomain/zero/1.0/)** on their
individual author/upload pages, checked 2026-11-02. Credits are retained for
provenance even though CC0 does not require attribution. The sources describe
real outdoor or cave sound recordings. These are environmental sound effects;
the source locations do not imply that the fictional game scenes depict them.

| Delivered file | Recording and author | Author's source page | Actual download |
| --- | --- | --- | --- |
| `grassland.mp3` | Open-field wind from **Park ambiences**, **Thimras**, public park in Adelaide, South Australia, winter | [Park ambiences](https://opengameart.org/content/park-ambiences) | [Original WAV](https://opengameart.org/sites/default/files/park_ambience_wind.wav) |
| `forest.mp3` | Birds by a copse before rain from **Park ambiences**, **Thimras**, Adelaide, South Australia | [Park ambiences](https://opengameart.org/content/park-ambiences) | [Original WAV](https://opengameart.org/sites/default/files/park_ambience_birds.wav) |
| `alpine.mp3` | **mountain wind heavy strong gusts Swiss Alps.flac**, **kyles** | [Freesound 454092](https://freesound.org/people/kyles/sounds/454092/) | [Author page's HQ MP3 preview](https://cdn.freesound.org/previews/454/454092_612689-hq.mp3) |
| `desert.mp3` | **Strong wind blowing and howling in the middle of the desert of Atacama, in the "moon valley" (Chile)**, **felix.blume** | [Freesound 146914](https://freesound.org/people/felix.blume/sounds/146914/) | [Author page's HQ MP3 preview](https://cdn.freesound.org/previews/146/146914_1661766-hq.mp3) |
| `lagoon.mp3` | **Gentle waves on a lake**, **TheFlyFishingFilmmaker**; waves against rocks in Eastern Washington | [Freesound 614299](https://freesound.org/people/TheFlyFishingFilmmaker/sounds/614299/) | [Author page's HQ MP3 preview](https://cdn.freesound.org/previews/614/614299_6501596-hq.mp3) |
| `cavern.mp3` | **Many drops of water in a big cave (Karstic system Ojo Guareña, Burgos, Spain)**, **nomadas**; Cacique hall, recorded with Sony PCM-D50 | [Freesound 609161](https://freesound.org/people/nomadas/sounds/609161/) | [Author page's HQ MP3 preview](https://cdn.freesound.org/previews/609/609161_938246-hq.mp3) |

Freesound downloads here use the public HQ preview encodings of those same CC0
recordings, rather than login-protected lossless masters. The file hashes in
`tools/render_ambience.py` pin the actual source bytes. OpenGameArt downloads use
the original attached WAVs. The public author pages and source descriptions were
also saved beside the external source cache during preparation.

## Changes made

Each source is trimmed to 43 seconds, with the start offsets and filter cutoffs
recorded in `tools/render_ambience.py` and `qa/audio-quality.json`. The script
applies a gentle high-pass to reduce microphone rumble and a low-pass to soften
the continuous bed. A 3-second equal-power circular overlap makes a 40-second
loop: its last samples return to the source position immediately preceding its
first samples. There is no built-in multi-second fade to silence at either end.
Only constant gain is applied after measuring loudness. The lagoon source's
occasional sharp wave transients are first softened with a lookahead limiter
(0.0625 amplitude ceiling, 5 ms attack, 120 ms release, no automatic makeup gain,
latency compensation enabled); the other five beds retain their
source dynamics.
The target is -26 LUFS integrated, with a conservative true peak ceiling. Files
are encoded as 44.1 kHz stereo, 112 kb/s MP3 with encoder gapless metadata.

The wind recordings have no extra bird layer. The forest recording contains the
recordist's actual birds. The cavern file uses an actual cave recording with
water drips and no outdoor birds or added music. Recording provenance and these
processing choices do not constitute a listening review of every source event.

## Rebuild and verify

Requirements: Python 3 with NumPy, `ffmpeg`, and `ffprobe` on PATH.

```powershell
python tools/render_ambience.py
```

The default download/cache folder is `../output_game_v4/audio-sources-v4_2/`;
pass `--cache <folder>` to use another location. Downloads are SHA256 checked
before processing. Original v4.1 game MP3s were preserved outside this repository
at `../output_game_v4/audio-before-v4_2/` before replacement. When that folder is
present, the report includes before/after measurements. The script reproduces
the exact trim/filter/gain/encode operations and writes `qa/audio-quality.json`.
The recorded FFmpeg version and delivered hashes provide a reference; encoder
output may vary between FFmpeg/libmp3lame versions.

The report checks decoded duration, finite samples, loudness, true/sample peak,
edge energy, spectral concentration, and boundary sample discontinuity relative
to native sample-to-sample changes. These are objective diagnostics only.
They cannot establish perceived naturalness, absence of unwanted field events,
or browser/device loop timing. Listening over several loop wraps and user
acceptance remain pending.

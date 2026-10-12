# MARNYS · Beauty In & Out — score + SFX, cue-locked to film/index.html (composition time = output time)
# Music: "Peace" by Diego Nava (Mixkit, free licence), entered at 29.6 s so its drop (32.0 s) lands on the
# push through the mirror at 2.40 s. 120 BPM → every cut in the film sits on this beat grid (2.4 + 0.5 n).
#   python mix.py            → build/mix.wav, build/music_only.wav, build/sfx_only.wav (48 kHz, pre-loudness)
import subprocess, numpy as np, soundfile as sf
from scipy import signal

SR = 48000
DUR = 18.4
MUSIC_IN = 29.6
N = int(SR * DUR)
HERE = __file__.rsplit('\\', 1)[0].rsplit('/', 1)[0]


def load_music():
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(MUSIC_IN), '-t', str(DUR + 0.5), '-i', f'{HERE}/music/mixkit-487_Peace_DiegoNava.mp3',
                          '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True).stdout
    x = np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)[:N]
    if len(x) < N: x = np.vstack([x, np.zeros((N - len(x), 2))])
    t = np.arange(N) / SR
    g = np.clip(t / 0.06, 0, 1)                                   # no click at frame 1
    fo0, fo1 = DUR - 1.25, DUR - 0.02                             # fade on the phrase end
    g *= np.where(t < fo0, 1, np.cos(np.clip((t - fo0) / (fo1 - fo0), 0, 1) * np.pi / 2) ** 1.6)
    return x * g[:, None]


def load_sfx(name):
    y, sr = sf.read(f'{HERE}/sfx/{name}.wav', always_2d=True)
    if sr != SR: y = signal.resample_poly(y, SR, sr, axis=0)
    if y.shape[1] == 1: y = np.repeat(y, 2, 1)
    return y


def shimmer(dur=1.4, seed=1, lo=2400, hi=7800, n=34, spread=0.5):
    """Soft glass glint: a scatter of high sine partials with fast attacks and long decays, then a short room."""
    rng = np.random.default_rng(seed)
    m = int(SR * dur); t = np.arange(m) / SR; out = np.zeros((m, 2))
    for _ in range(n):
        f = np.exp(rng.uniform(np.log(lo), np.log(hi))); t0 = rng.uniform(0, spread); dec = rng.uniform(0.18, 0.6)
        env = np.where(t >= t0, (1 - np.exp(-(t - t0) / 0.004)) * np.exp(-(t - t0) / dec), 0)
        tone = np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * env * rng.uniform(0.3, 1)
        pan = rng.uniform(-0.8, 0.8)
        out[:, 0] += tone * np.sqrt((1 - pan) / 2); out[:, 1] += tone * np.sqrt((1 + pan) / 2)
    ir_t = np.arange(int(SR * 0.9)) / SR
    for ch in range(2):
        ir = rng.normal(0, 1, len(ir_t)) * np.exp(-ir_t / 0.28); ir[0] = 6
        out[:, ch] = signal.fftconvolve(out[:, ch], ir)[:m]
    b, a = signal.butter(2, 1800 / (SR / 2), 'high'); out = signal.lfilter(b, a, out, axis=0)
    return out / (np.max(np.abs(out)) + 1e-9) * 0.8


SFX = {k: load_sfx(k) for k in ['air_rise', 'chime', 'click', 'clicksoft', 'pop2', 'sw1', 'sw2', 'swt']}
SFX['glint'] = shimmer(1.5, seed=3)
SFX['glint_soft'] = shimmer(1.2, seed=8, n=22, spread=0.35)
SFX['pass'] = shimmer(1.8, seed=5, lo=1800, hi=9000, n=48, spread=0.25)

# (start time s, effect, target in-band lift over the music in dB, note).
# Gains are solved per event (after the kit's solve-sfx-gains): the effect must lift its own band by the target over
# the music at that moment, while the ear-sensitive 2–8 kHz band never lifts more than CAP dB.
CUES = [
    (0.92, 'glint_soft', 2.5, 'light runs across the mirror glass'),
    (1.68, 'air_rise', 4.0, 'air rises into the glass (peak on 2.40)'),
    (2.33, 'pass', 4.0, 'passing through the mirror'),
    (7.52, 'pop2', 3.0, 'hair ring'), (7.86, 'clicksoft', 2.5, 'hair pill lands'),
    (9.02, 'pop2', 3.0, 'skin ring'), (9.36, 'clicksoft', 2.5, 'skin pill lands'),
    (10.52, 'pop2', 3.0, 'nails ring'), (10.86, 'clicksoft', 2.5, 'nails pill lands'),
    (11.73, 'sw2', 4.0, 'the mirror closes around her'),
    (12.46, 'sw1', 3.5, 'pack rises'),
    (12.74, 'swt', 3.0, 'vial slides in'),
    (13.30, 'glint_soft', 2.5, 'light sweep on the pack'),
    (13.86, 'click', 3.0, '5,000 lands'),
    (15.10, 'sw2', 4.0, 'navy rises'),
    (16.10, 'chime', 4.0, 'logo'),
    (16.55, 'glint_soft', 2.5, 'glint on the end mirror'),
]
CAP = 4.0


def solve_gain(fx, t, music_mono, target):
    def pk(y, h=int(.05 * SR)): return max(10 * np.log10((y[i:i + h] ** 2).mean() + 1e-12) for i in range(0, max(1, len(y) - h), h // 2))
    m = fx.mean(1); F = np.abs(np.fft.rfft(m * np.hanning(len(m)))) ** 2; f = np.fft.rfftfreq(len(m), 1 / SR); c = np.cumsum(F) / F.sum()
    lo = max(f[np.searchsorted(c, .2)], 40); hi = min(max(f[np.searchsorted(c, .8)], lo * 2), SR / 2 - 200)
    sos = signal.butter(4, [lo, hi], btype='band', fs=SR, output='sos'); HB = signal.butter(4, [2000, 8000], btype='band', fs=SR, output='sos')
    pad = SR // 2; W = int(.3 * SR); i = int(t * SR)
    env = np.convolve(np.abs(m), np.ones(int(.01 * SR)) / int(.01 * SR), 'same')
    a = max(0, int(np.argmax(env)) - W // 2)          # judge the effect where it is loudest (rises peak late)
    base = np.concatenate([np.zeros(pad), music_mono, np.zeros(2 * SR)])[i:i + 2 * pad + len(m)]
    w0, w1 = pad + a, pad + a + W
    b0 = pk(signal.sosfilt(sos, base)[w0:w1]); h0 = pk(signal.sosfilt(HB, base)[w0:w1]); g = prev = .003
    for x in np.geomspace(.003, 2.0, 160):
        seg = base.copy(); seg[pad:pad + len(m)] += x * m[:len(seg) - pad]
        if pk(signal.sosfilt(HB, seg)[w0:w1]) - h0 > CAP: g = prev; break
        if pk(signal.sosfilt(sos, seg)[w0:w1]) - b0 >= target: g = x; break
        prev = x
    return 20 * np.log10(g)


def place(bus, x, t, gain_db):
    i = int(round(t * SR)); x = x[:max(0, N - i)] * 10 ** (gain_db / 20)
    bus[i:i + len(x)] += x


music = load_music() * 10 ** (-7.0 / 20)                        # mastered loud; sit it under the effects
mono = music.mean(1)
sfx = np.zeros((N, 2)); solved = []
cache = {}
for t, k, target, note in CUES:
    g = solve_gain(SFX[k], t, mono, target)
    cache.setdefault(k, []).append(g); solved.append((t, k, g, target, note))
# repeated sounds keep one level (median of their solved gains) so the series feels consistent
for idx, (t, k, g, target, note) in enumerate(solved):
    if len(cache[k]) > 1: solved[idx] = (t, k, float(np.median(cache[k])), target, note)
for t, k, g, _, _ in solved: place(sfx, SFX[k], t, g)
mix = music + sfx
for name, x in [('mix', mix), ('music_only', music), ('sfx_only', sfx)]:
    sf.write(f'{HERE}/build/{name}.wav', x.astype(np.float32), SR, subtype='FLOAT')
print('peaks dBFS:', {n: round(20 * np.log10(np.max(np.abs(x)) + 1e-9), 1) for n, x in [('mix', mix), ('music', music), ('sfx', sfx)]})
with open(f'{HERE}/build/cues.txt', 'w', encoding='utf8') as f:
    for t, k, g, target, note in solved: f.write(f'{t:6.2f}  {k:11s} gain {g:+6.1f} dB  (target lift {target:.1f} dB)  {note}' + '\n')
print(open(f'{HERE}/build/cues.txt', encoding='utf8').read())

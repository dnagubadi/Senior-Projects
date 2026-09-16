(() => {
  "use strict";

  const PALETTE_SIZE = 8;
  const IDLE_RGB = [226, 228, 236];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const els = {
    status: document.getElementById("status"),
    colorField: document.getElementById("colorField"),
    colorCore: document.getElementById("colorCore"),
    hexValue: document.getElementById("hexValue"),
    rgbValue: document.getElementById("rgbValue"),
    rValue: document.getElementById("rValue"),
    gValue: document.getElementById("gValue"),
    bValue: document.getElementById("bValue"),
    loudnessValue: document.getElementById("loudnessValue"),
    bassValue: document.getElementById("bassValue"),
    midValue: document.getElementById("midValue"),
    trebleValue: document.getElementById("trebleValue"),
    loudnessFill: document.getElementById("loudnessFill"),
    bassFill: document.getElementById("bassFill"),
    midFill: document.getElementById("midFill"),
    trebleFill: document.getElementById("trebleFill"),
    enableBtn: document.getElementById("enableBtn"),
    pauseBtn: document.getElementById("pauseBtn"),
    stopBtn: document.getElementById("stopBtn"),
    copyBtn: document.getElementById("copyBtn"),
    palette: document.getElementById("palette"),
    canvas: document.getElementById("waveCanvas"),
    ambient: document.querySelector(".ambient"),
  };

  const ctx2d = els.canvas.getContext("2d");

  const audio = {
    context: null,
    source: null,
    analyser: null,
    stream: null,
    timeData: null,
    freqData: null,
  };

  const smooth = {
    rms: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    centroid: 0,
    r: IDLE_RGB[0],
    g: IDLE_RGB[1],
    b: IDLE_RGB[2],
  };

  let rafId = 0;
  let paused = false;
  let live = false;
  let displayed = { r: IDLE_RGB[0], g: IDLE_RGB[1], b: IDLE_RGB[2] };
  let palette = [];
  let lastPaletteAt = 0;
  let copyResetId = 0;

  function clamp255(n) {
    return Math.max(0, Math.min(255, Math.round(n)));
  }

  function toHex(r, g, b) {
    return (
      "#" +
      [r, g, b]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()
    );
  }

  function ema(current, next, amount) {
    return current + (next - current) * amount;
  }

  function bandEnergy(data, sampleRate, fftSize, minHz, maxHz) {
    const binHz = sampleRate / fftSize;
    const start = Math.max(0, Math.floor(minHz / binHz));
    const end = Math.min(data.length - 1, Math.ceil(maxHz / binHz));
    if (end <= start) return 0;

    let sum = 0;
    for (let i = start; i <= end; i += 1) sum += data[i];
    return sum / ((end - start + 1) * 255);
  }

  function spectralCentroid(data, sampleRate, fftSize) {
    const binHz = sampleRate / fftSize;
    let magSum = 0;
    let weighted = 0;
    for (let i = 1; i < data.length; i += 1) {
      const mag = data[i];
      magSum += mag;
      weighted += mag * i * binHz;
    }
    if (magSum < 1) return 0;
    return Math.min(1, weighted / magSum / 8000);
  }

  function rmsFromTime(data) {
    let sum = 0;
    for (let i = 0; i < data.length; i += 1) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / data.length);
  }

  function contrastInk(r, g, b) {
    const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luma > 0.62 ? "#1c1c24" : "#f7f4ee";
  }

  function lift(value, gain) {
    return Math.min(1, Math.pow(Math.max(0, value) * gain, 0.55));
  }

  function hslToRgb(h, s, l) {
    const sat = Math.max(0, Math.min(1, s));
    const light = Math.max(0, Math.min(1, l));
    const hue = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * light - 1)) * sat;
    const hp = hue / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r1 = 0;
    let g1 = 0;
    let b1 = 0;
    if (hp < 1) [r1, g1, b1] = [c, x, 0];
    else if (hp < 2) [r1, g1, b1] = [x, c, 0];
    else if (hp < 3) [r1, g1, b1] = [0, c, x];
    else if (hp < 4) [r1, g1, b1] = [0, x, c];
    else if (hp < 5) [r1, g1, b1] = [x, 0, c];
    else [r1, g1, b1] = [c, 0, x];
    const m = light - c / 2;
    return [clamp255((r1 + m) * 255), clamp255((g1 + m) * 255), clamp255((b1 + m) * 255)];
  }

  /**
   * Map smoothed audio features to RGB.
   * Bass → red, mids → green, treble → blue. Bands are boosted so quiet
   * rooms still hue-shift, and saturation stays high so the field is
   * colorful instead of gray.
   */
  function featuresToRgb(features) {
    const loud = Math.min(1, lift(features.rms, 8.5));
    const bass = lift(features.bass, 6.2);
    const mid = lift(features.mid, 5.6);
    const treble = lift(features.treble, 6.8);
    const weight = bass + mid + treble;

    const hue =
      weight < 0.05
        ? 200 + features.centroid * 90
        : (bass * 8 + mid * 128 + treble * 218) / weight + features.centroid * 18;

    const sat = Math.min(0.95, 0.42 + loud * 0.4 + Math.min(0.28, weight * 0.35));
    const light = 0.5 + (1 - loud) * 0.16;

    return hslToRgb(hue, sat, light);
  }

  function setStatus(message) {
    els.status.textContent = message;
  }

  function paintColor(r, g, b, { pinned = false } = {}) {
    displayed = { r, g, b };
    const hex = toHex(r, g, b);
    const rgb = `rgb(${r}, ${g}, ${b})`;

    document.documentElement.style.setProperty("--live", hex);
    document.documentElement.style.setProperty("--ink", contrastInk(r, g, b));
    els.colorField.style.backgroundColor = rgb;
    els.colorCore.style.background = `radial-gradient(circle at 35% 28%, rgba(255,255,255,0.78), transparent 48%), ${rgb}`;
    els.hexValue.textContent = hex;
    els.rgbValue.textContent = rgb;
    els.rValue.textContent = String(r);
    els.gValue.textContent = String(g);
    els.bValue.textContent = String(b);
    els.colorField.setAttribute(
      "aria-label",
      pinned ? `Pinned color ${hex}` : `Live color field ${hex}`
    );
  }

  function setMeter(fillEl, labelEl, value) {
    const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
    fillEl.style.width = `${pct}%`;
    labelEl.textContent = `${pct}%`;
  }

  function rememberColor(r, g, b) {
    const hex = toHex(r, g, b);
    const now = performance.now();
    if (now - lastPaletteAt < 900) return;
    const last = palette[0];
    if (last) {
      const dist = Math.hypot(r - last.r, g - last.g, b - last.b);
      if (dist < 28) return;
    }
    lastPaletteAt = now;
    palette.unshift({ r, g, b, hex });
    palette = palette.slice(0, PALETTE_SIZE);
    renderPalette();
  }

  function renderPalette() {
    els.palette.innerHTML = "";
    for (let i = 0; i < PALETTE_SIZE; i += 1) {
      const color = palette[i];
      if (!color) {
        const empty = document.createElement("li");
        empty.className = "empty-swatch";
        empty.setAttribute("aria-hidden", "true");
        els.palette.appendChild(empty);
        continue;
      }
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "swatch";
      button.style.background = color.hex;
      button.title = `Copy ${color.hex}`;
      button.setAttribute("aria-label", `Copy color ${color.hex}`);
      button.addEventListener("click", () => {
        copyText(color.hex);
        if (paused || !live) paintColor(color.r, color.g, color.b, { pinned: true });
      });
      item.appendChild(button);
      els.palette.appendChild(item);
    }
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement("textarea");
        area.value = text;
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
      els.copyBtn.textContent = "Copied!";
      window.clearTimeout(copyResetId);
      copyResetId = window.setTimeout(() => {
        els.copyBtn.textContent = "Copy Hex";
      }, 1400);
    } catch {
      setStatus("Clipboard permission was denied, so the hex could not be copied.");
    }
  }

  function sizeCanvas() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const cssWidth = els.canvas.clientWidth || els.canvas.parentElement.clientWidth;
    const cssHeight = 128;
    els.canvas.width = Math.floor(cssWidth * dpr);
    els.canvas.height = Math.floor(cssHeight * dpr);
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawWaveform(data) {
    const width = els.canvas.clientWidth;
    const height = 128;
    ctx2d.clearRect(0, 0, width, height);
    ctx2d.fillStyle = "rgba(255,255,255,0.35)";
    ctx2d.fillRect(0, 0, width, height);

    ctx2d.beginPath();
    ctx2d.lineWidth = 2;
    ctx2d.strokeStyle = `rgba(${Math.max(40, displayed.r - 70)}, ${Math.max(40, displayed.g - 70)}, ${Math.max(40, displayed.b - 50)}, 0.9)`;

    const slice = width / data.length;
    for (let i = 0; i < data.length; i += 1) {
      const v = data[i] / 255;
      const x = i * slice;
      const y = v * height;
      if (i === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
    }
    ctx2d.stroke();
  }

  function analyze() {
    audio.analyser.getByteTimeDomainData(audio.timeData);
    audio.analyser.getByteFrequencyData(audio.freqData);

    const sampleRate = audio.context.sampleRate;
    const fftSize = audio.analyser.fftSize;
    const rms = rmsFromTime(audio.timeData);
    const bass = bandEnergy(audio.freqData, sampleRate, fftSize, 20, 250);
    const mid = bandEnergy(audio.freqData, sampleRate, fftSize, 250, 2000);
    const treble = bandEnergy(audio.freqData, sampleRate, fftSize, 2000, 8000);
    const centroid = spectralCentroid(audio.freqData, sampleRate, fftSize);

    const amount = reduceMotion ? 0.38 : 0.22;
    smooth.rms = ema(smooth.rms, rms, amount);
    smooth.bass = ema(smooth.bass, bass, amount);
    smooth.mid = ema(smooth.mid, mid, amount);
    smooth.treble = ema(smooth.treble, treble, amount);
    smooth.centroid = ema(smooth.centroid, centroid, amount);

    const [r, g, b] = featuresToRgb(smooth);
    const colorAmount = reduceMotion ? 0.5 : 0.28;
    smooth.r = ema(smooth.r, r, colorAmount);
    smooth.g = ema(smooth.g, g, colorAmount);
    smooth.b = ema(smooth.b, b, colorAmount);

    const out = [clamp255(smooth.r), clamp255(smooth.g), clamp255(smooth.b)];
    paintColor(out[0], out[1], out[2]);
    setMeter(els.loudnessFill, els.loudnessValue, Math.min(1, lift(smooth.rms, 8.5)));
    setMeter(els.bassFill, els.bassValue, lift(smooth.bass, 6.2));
    setMeter(els.midFill, els.midValue, lift(smooth.mid, 5.6));
    setMeter(els.trebleFill, els.trebleValue, lift(smooth.treble, 6.8));
    rememberColor(out[0], out[1], out[2]);
    drawWaveform(audio.timeData);
  }

  function loop() {
    if (!live || paused) return;
    analyze();
    rafId = window.requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  async function enableMic() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus("This browser does not support microphone capture via getUserMedia.");
      return;
    }

    els.enableBtn.disabled = true;
    setStatus("Waiting for microphone permission…");

    try {
      await teardown(false);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
        },
        video: false,
      });

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const context = new AudioCtx();
      if (context.state === "suspended") await context.resume();

      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.32;
      // Intentionally not connected to destination — no speaker feedback.
      source.connect(analyser);

      audio.stream = stream;
      audio.context = context;
      audio.source = source;
      audio.analyser = analyser;
      audio.timeData = new Uint8Array(analyser.fftSize);
      audio.freqData = new Uint8Array(analyser.frequencyBinCount);

      live = true;
      paused = false;
      els.pauseBtn.disabled = false;
      els.stopBtn.disabled = false;
      els.pauseBtn.textContent = "Pause visualization";
      els.enableBtn.textContent = "Microphone on";
      setStatus("Listening. Color updates from live input; nothing is sent anywhere.");
      stopLoop();
      rafId = window.requestAnimationFrame(loop);
    } catch (error) {
      els.enableBtn.disabled = false;
      const name = error && error.name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setStatus("Microphone permission was denied. Enable it in the browser, then try again.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setStatus("No microphone was found. Connect one and try again.");
      } else {
        setStatus("Could not start the microphone. Check browser permissions and try again.");
      }
    }
  }

  function togglePause() {
    if (!live) return;
    paused = !paused;
    if (paused) {
      stopLoop();
      if (audio.context && audio.context.state === "running") {
        audio.context.suspend();
      }
      els.pauseBtn.textContent = "Resume visualization";
      setStatus("Visualization paused. The microphone stays available until you stop it.");
    } else {
      if (audio.context && audio.context.state === "suspended") {
        audio.context.resume();
      }
      els.pauseBtn.textContent = "Pause visualization";
      setStatus("Listening again.");
      stopLoop();
      rafId = window.requestAnimationFrame(loop);
    }
  }

  async function teardown(resetUi) {
    stopLoop();
    live = false;
    paused = false;

    if (audio.source) {
      try {
        audio.source.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    if (audio.stream) {
      audio.stream.getTracks().forEach((track) => track.stop());
    }
    if (audio.context) {
      try {
        await audio.context.close();
      } catch {
        /* already closed */
      }
    }

    audio.context = null;
    audio.source = null;
    audio.analyser = null;
    audio.stream = null;
    audio.timeData = null;
    audio.freqData = null;

    if (resetUi) {
      els.enableBtn.disabled = false;
      els.enableBtn.textContent = "Enable Microphone";
      els.pauseBtn.disabled = true;
      els.pauseBtn.textContent = "Pause visualization";
      els.stopBtn.disabled = true;
      setStatus("Microphone stopped. Click Enable Microphone to start again.");
    }
  }

  function onResize() {
    sizeCanvas();
    if (audio.timeData && (live || paused)) drawWaveform(audio.timeData);
  }

  els.enableBtn.addEventListener("click", enableMic);
  els.pauseBtn.addEventListener("click", togglePause);
  els.stopBtn.addEventListener("click", () => teardown(true));
  els.copyBtn.addEventListener("click", () => copyText(toHex(displayed.r, displayed.g, displayed.b)));
  window.addEventListener("resize", onResize);

  renderPalette();
  sizeCanvas();
  paintColor(IDLE_RGB[0], IDLE_RGB[1], IDLE_RGB[2]);
})();

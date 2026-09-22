(() => {
  const STORAGE_KEY = "catan-dojo-v1";
  const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
  const GROQ_MODEL = "llama-3.3-70b-versatile";
  const WIN_VP = 10;

  const SYSTEM_PROMPT = `You are Coach Atlas, an intense personal trainer for Settlers of Catan.
Voice: mix of calm martial-arts sensei and hard boxing coach. Controlled, intense, direct, strategic, motivating.
Short memorable lines. Challenge bad logic, explain the correction, then push the player forward.
Never use profanity, insults, humiliation, or personal attacks. Treat every Catan decision as championship preparation.
Example tone: "Breathe. Count the odds. You chose emotion over production." "You gave away leverage. Reset. Read the board." "Good recovery. Again." "You do not win by hoping for sixes. Build positions that survive bad rolls."

Teach: dice probability (6/8 best, then 5/9, 4/10, 3/11, 2/12), starting placements, resource diversity, expansion paths, road blocking, ports (especially 2:1 when pip-heavy), trading leverage, development cards (knights, VP, road building, year of plenty, monopoly), robber placement, timing, hidden information, and win-condition planning (10 VP: cities, longest road, largest army, VP cards).

Ask one question at a time unless the user is answering.
When giving critique, use this exact structure with those headings:
Verdict
Why
Better Line
Next Drill

Difficulty: {{DIFFICULTY}}. Rookie: scaffold thinking. Competitive: demand pip math and tempo. Elite: punish leaks, hidden-info, and win-race errors.
Keep replies concise. Championship room, not a lecture hall.`;

  const RANKS = [
    { xp: 0, name: "White Belt" },
    { xp: 40, name: "Iron Fist" },
    { xp: 90, name: "Hex Adept" },
    { xp: 160, name: "Robber Hunter" },
    { xp: 250, name: "Road Sensei" },
    { xp: 360, name: "Champion Contender" },
    { xp: 500, name: "Dojo Elite" },
  ];

  const SKILLS = ["placement", "probability", "trading", "expansion", "robber", "timing"];

  const DRILLS = {
    Rookie: [
      {
        skill: "probability",
        q: "Opening placement. One hex is an 8-forest, the other a 4-hills. A rival 6-forest sits one intersection away. Do you grab the 8/4 or fight for the 6? Say why in one breath.",
      },
      {
        skill: "placement",
        q: "You can start on 6-wood / 9-brick / 5-wheat, or 8-sheep / 10-ore / 3-wheat. Which seat, and what is your second-placement plan?",
      },
      {
        skill: "trading",
        q: "You need one brick for a settlement. Opponent will trade brick for two wheat. You have wheat to spare but they are at 7 VP. Do you take the trade?",
      },
      {
        skill: "robber",
        q: "You rolled a 7. Opponent A has 8 cards and a 6-ore. Opponent B has 3 cards on a 5-wheat you also touch. Where does the robber go?",
      },
    ],
    Competitive: [
      {
        skill: "expansion",
        q: "You have 4 roads toward a 2:1 wheat port. A rival can close the gap in one turn. Do you settle now on a 3-wheat, or spend the turn buying a knight to protect longest-road later?",
      },
      {
        skill: "timing",
        q: "Scores: you 6, Atlas 7 with largest army showing. You have ore-wheat-sheep in hand and a 5-road chain. City or development card? Clock is live.",
      },
      {
        skill: "probability",
        q: "Your production pips: wood 5, brick 3, wheat 4, sheep 2, ore 5. You can move a city onto 8-sheep or 9-ore. Which upgrade actually unsticks your engine?",
      },
      {
        skill: "trading",
        q: "Table is dry on brick. You sit on four brick and a 2:1 brick port. Two players need roads. How do you sell without handing someone longest road?",
      },
    ],
    Elite: [
      {
        skill: "timing",
        q: "Hidden VP suspicion: Atlas bought three devs in four turns and is not flipping knights. You are at 8 VP with longest road. Do you overbuild a city or hunt army?",
      },
      {
        skill: "robber",
        q: "Seven. You can starve Atlas’s 8-ore (they are one city from 10) or cutoff a third player’s 6-wood who holds the brick you need. Championship choice. Commit.",
      },
      {
        skill: "placement",
        q: "Second placement. Remaining: 5/9/10 wood-sheep-ore vs 6/4/11 brick-wheat-sheep with a 3:1. You already have wood-brick. Prove the pick with win-condition, not comfort.",
      },
      {
        skill: "expansion",
        q: "Road race. You can block Atlas from a 8-ore coastal city OR fork toward longest road. Atlas is at 6 VP with two knights. You are at 5. One road left in the budget this turn.",
      },
    ],
  };

  const TERRAIN = [
    { id: "forest", res: "wood" },
    { id: "hills", res: "brick" },
    { id: "pasture", res: "sheep" },
    { id: "fields", res: "wheat" },
    { id: "mountains", res: "ore" },
  ];

  const defaultState = () => ({
    xp: 0,
    streak: 0,
    lastDrillDay: "",
    skills: Object.fromEntries(SKILLS.map((s) => [s, 12])),
    completed: [],
    feedback: [],
    settings: {
      apiKey: "",
      difficulty: "Competitive",
      voiceOn: true,
      mute: false,
    },
    chat: [],
  });

  let state = load();
  let currentStation = null;
  let drill = null;
  let scenario = null;
  let chatHistory = [];
  let recognizing = false;
  let recognition = null;
  let speaking = false;
  let spar = null;
  let toastTimer = 0;

  const $ = (id) => document.getElementById(id);
  const intro = $("intro");
  const gym = $("gym");
  const hud = $("hud");
  const stationEl = $("station");
  const stationBody = $("station-body");
  const legal = $("legal");

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return { ...defaultState(), ...parsed, settings: { ...defaultState().settings, ...(parsed.settings || {}) } };
    } catch {
      return defaultState();
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function rankName(xp) {
    let name = RANKS[0].name;
    for (const r of RANKS) if (xp >= r.xp) name = r.name;
    return name;
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function bumpStreak() {
    const day = todayKey();
    if (state.lastDrillDay === day) return;
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const ykey = y.toISOString().slice(0, 10);
    state.streak = state.lastDrillDay === ykey ? state.streak + 1 : 1;
    state.lastDrillDay = day;
  }

  function grantXp(n, skill) {
    bumpStreak();
    state.xp += n;
    if (skill && state.skills[skill] != null) {
      state.skills[skill] = Math.min(100, state.skills[skill] + Math.ceil(n / 2));
    }
    save();
    renderHud();
  }

  function logFeedback(text, station) {
    state.feedback.unshift({ t: Date.now(), station, text: String(text).slice(0, 280) });
    state.feedback = state.feedback.slice(0, 12);
    save();
  }

  function completeDrill(title) {
    state.completed.unshift({ t: Date.now(), title });
    state.completed = state.completed.slice(0, 20);
    save();
  }

  function renderHud() {
    $("hud-rank").textContent = rankName(state.xp);
    $("hud-xp").textContent = String(state.xp);
    $("hud-streak").textContent = String(state.streak);
    $("hud-focus").textContent = currentStation ? stationMeta[currentStation].focus : "Gym floor";
    $("back-gym").hidden = !currentStation;
  }

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
  }

  function speak(text) {
    if (state.settings.mute || !state.settings.voiceOn || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\s+/g, " ").slice(0, 500));
    const voices = window.speechSynthesis.getVoices();
    const low = voices.find((v) => /male|daniel|alex|david|fred/i.test(v.name)) || voices[0];
    if (low) u.voice = low;
    u.rate = 0.95;
    u.pitch = 0.85;
    speaking = true;
    $("stop-speech").hidden = false;
    u.onend = () => {
      speaking = false;
      $("stop-speech").hidden = true;
    };
    window.speechSynthesis.speak(u);
  }

  function stopSpeak() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    speaking = false;
    $("stop-speech").hidden = true;
  }

  function speechSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function attachMic(inputEl, statusEl) {
    const mic = document.createElement("button");
    mic.type = "button";
    mic.className = "mic-btn";
    mic.textContent = "Mic";
    mic.setAttribute("aria-pressed", "false");
    if (!speechSupported()) {
      statusEl.innerHTML = '<p class="compat">Speech recognition is not available in this browser. Type your answers. Chrome or Edge recommended.</p>';
      return mic;
    }
    mic.addEventListener("click", () => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (recognizing && recognition) {
        recognition.stop();
        return;
      }
      recognition = new SR();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.onstart = () => {
        recognizing = true;
        mic.setAttribute("aria-pressed", "true");
        mic.textContent = "Listening";
        statusEl.textContent = "Mic live. Speak your line.";
      };
      recognition.onerror = () => {
        recognizing = false;
        mic.setAttribute("aria-pressed", "false");
        mic.textContent = "Mic";
        statusEl.innerHTML = '<span class="status-line error">Mic error. Type instead.</span>';
      };
      recognition.onend = () => {
        recognizing = false;
        mic.setAttribute("aria-pressed", "false");
        mic.textContent = "Mic";
      };
      recognition.onresult = (e) => {
        const said = e.results[0][0].transcript;
        inputEl.value = (inputEl.value ? inputEl.value + " " : "") + said;
        statusEl.textContent = "Captured. Submit when ready.";
      };
      recognition.start();
    });
    return mic;
  }

  function hasKey() {
    return Boolean(state.settings.apiKey && state.settings.apiKey.trim());
  }

  async function groqChat(extraMessages, opts = {}) {
    const sys = SYSTEM_PROMPT.replace("{{DIFFICULTY}}", state.settings.difficulty);
    const messages = [{ role: "system", content: sys }, ...chatHistory.slice(-10), ...extraMessages];
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${state.settings.apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: opts.temperature ?? 0.65,
        max_tokens: opts.max_tokens ?? 700,
        messages,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(res.status === 401 ? "API key rejected." : `Groq error ${res.status}: ${err.slice(0, 180)}`);
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Empty reply from Groq.");
    extraMessages.forEach((m) => chatHistory.push(m));
    chatHistory.push({ role: "assistant", content });
    chatHistory = chatHistory.slice(-16);
    return content;
  }

  function parseCritique(text) {
    const keys = ["Verdict", "Why", "Better Line", "Next Drill"];
    const out = {};
    let current = "body";
    out.body = "";
    text.split(/\n/).forEach((line) => {
      const hit = keys.find((k) => new RegExp(`^${k}\\s*:?\\s*$`, "i").test(line.trim()) || new RegExp(`^${k}\\s*:`, "i").test(line.trim()));
      if (hit) {
        current = hit;
        out[hit] = line.replace(new RegExp(`^${hit}\\s*:?\\s*`, "i"), "").trim();
      } else if (out[current] != null) {
        out[current] = (out[current] ? out[current] + "\n" : "") + line;
      } else {
        out.body += (out.body ? "\n" : "") + line;
      }
    });
    return out;
  }

  function renderCritique(text) {
    const p = parseCritique(text);
    if (!p.Verdict && !p.Why) {
      return `<div class="feedback-box">${escapeHtml(text)}</div>`;
    }
    return `<div class="verdict">
      ${["Verdict", "Why", "Better Line", "Next Drill"]
        .filter((k) => p[k])
        .map((k) => `<section><h4>${k}</h4><p>${escapeHtml(p[k].trim())}</p></section>`)
        .join("")}
    </div>`;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function roll2d6() {
    return 1 + Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6);
  }

  /* ---------- local fallbacks ---------- */
  function localDrillCritique(question, answer, skill) {
    const a = answer.toLowerCase();
    const mentionsOdds = /6|8|pip|odd|probab|five|nine/.test(a);
    const mentionsWin = /vp|point|longest|army|city|win/.test(a);
    const mentionsTradeTrap = /trade|leverage|seven|8 vp|hand/.test(a);
    let verdict = "Incomplete.";
    let why = "You named a move without naming the race. Championship players justify with pips, tempo, and who reaches 10 first.";
    let better = "State the production math, the threat on the board, then the line. One sentence each.";
    if (mentionsOdds && mentionsWin) {
      verdict = "Solid frame.";
      why = "You counted production and looked at the scoreboard. That is the dojo standard.";
      better = "Sharpen timing: say what you do if the next roll is a 7, not only if the plan works.";
    } else if (mentionsOdds) {
      verdict = "Half-count.";
      why = "Pips matter. Win-condition still missing. A rich 4-pip seat that cannot city will lose to a thinner engine that cities twice.";
      better = "Add the 10-point path in the same breath as the numbers.";
    } else if (mentionsTradeTrap || mentionsWin) {
      verdict = "Table-aware, number-blind.";
      why = "Politics without probability is emotion in a robe.";
      better = "Name the hex numbers you are protecting or abandoning.";
    }
    const next = pick(DRILLS[state.settings.difficulty]).q;
    return `Verdict\n${verdict}\nWhy\n${why}\nBetter Line\n${better}\nNext Drill\n${next}\n\n(Local coach. Add a Groq key in Settings for live Atlas.)`;
  }

  function generateScenario() {
    const nums = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
    shuffle(nums);
    const tiles = [];
    for (let i = 0; i < 7; i++) {
      const t = TERRAIN[i % TERRAIN.length];
      tiles.push({ terrain: t.id, res: t.res, num: nums[i] });
    }
    const ports = ["3:1", "2:1 wood", "2:1 wheat"];
    const youHand = {
      wood: rand(0, 3),
      brick: rand(0, 3),
      wheat: rand(0, 3),
      sheep: rand(0, 3),
      ore: rand(0, 3),
    };
    const phase = pick(["production", "trade", "build", "robber"]);
    const youVP = rand(4, 8);
    const oppVP = rand(4, 9);
    return {
      tiles,
      ports,
      you: {
        hand: youHand,
        vp: youVP,
        roads: rand(4, 9),
        settlements: rand(2, 4),
        cities: rand(0, 2),
        knights: rand(0, 3),
        seat: "NW coast, touching 6-wood and 5-wheat",
      },
      atlas: {
        vp: oppVP,
        roads: rand(3, 10),
        cities: rand(0, 2),
        knights: rand(0, 4),
        seat: "Ore-brick cluster, inland",
      },
      phase,
      prompt:
        phase === "robber"
          ? "You rolled a 7. Place the robber and name the steal. Why this cut?"
          : "Name the best action this turn. Build, trade, buy, or hold. Defend it.",
    };
  }

  function localScenarioAnalysis(sc, answer) {
    const pips = sc.tiles.reduce((s, t) => s + pipValue(t.num), 0);
    const ore = sc.tiles.filter((t) => t.res === "ore");
    const oreWeak = ore.reduce((s, t) => s + pipValue(t.num), 0) < 4;
    const a = answer.toLowerCase();
    let verdict = "Unfocused.";
    let why = `Board pips on your visible tiles total ${pips}. Atlas is at ${sc.atlas.vp} VP. Tempo is not optional.`;
    let better = "Lead with the constraint: brick, ore, or road space — then the action that unlocks the next VP.";
    if (sc.phase === "robber" && /ore|city|lead|8|6/.test(a)) {
      verdict = "Cut the engine.";
      why = "Starving the leader’s city resource is championship robber. Casual robber chases whoever annoyed you.";
      better = "Confirm they have cards to steal. A dry hand is a wasted 7.";
    } else if (oreWeak && /city|ore|dev|port/.test(a)) {
      verdict = "You saw the leak.";
      why = "Ore is thin. Cities and army stall. Fix the resource or change the win path to longest road / VP cards.";
      better = "If you cannot city, stop pretending you are a city player this game.";
    } else if (/trade|port/.test(a)) {
      verdict = "Market thinking.";
      why = "Ports and 4:1 are tools, not habits. Bank trades on a turn you can convert into a point.";
      better = "Only trade if the output is a settlement, city, or a dev that contests army.";
    }
    return `Verdict\n${verdict}\nWhy\n${why}\nBetter Line\n${better}\nNext Drill\nRebuild this position at ${state.settings.difficulty} pace. Name two follow-up turns, not one.`;
  }

  function pipValue(n) {
    return n === 7 ? 0 : 6 - Math.abs(7 - n);
  }

  function rand(a, b) {
    return a + Math.floor(Math.random() * (b - a + 1));
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ---------- stations ---------- */
  const stationMeta = {
    drills: {
      kicker: "Heavy Bag",
      title: "Strategy Drills",
      lead: "One question. Your reasoning. Then Atlas corrects the line.",
      focus: "Strategy drills",
    },
    tactics: {
      kicker: "Chalkboard",
      title: "Tactics Lab",
      lead: "Mock board. Best move. No hoping for sixes.",
      focus: "Tactics lab",
    },
    spar: {
      kicker: "Boxing Ring",
      title: "Sparring Match",
      lead: "Simplified Catan tempo vs Coach Atlas. Build, trade, survive.",
      focus: "Sparring",
    },
    record: {
      kicker: "Locker Room",
      title: "Training Record",
      lead: "What you earned. What still leaks.",
      focus: "Record",
    },
    coach: {
      kicker: "Coach Corner",
      title: "Coach Atlas",
      lead: "Advice, game review, custom drills. Talk or type.",
      focus: "Coach",
    },
    settings: {
      kicker: "Switchboard",
      title: "Settings",
      lead: "Key stays on this device. Difficulty sets the heat.",
      focus: "Settings",
    },
  };

  function openStation(id) {
    currentStation = id;
    gym.hidden = true;
    gym.setAttribute("aria-hidden", "true");
    stationEl.hidden = false;
    stationEl.removeAttribute("aria-hidden");
    document.body.classList.add("in-station");
    const m = stationMeta[id];
    $("station-kicker").textContent = m.kicker;
    $("station-title").textContent = m.title;
    $("station-lead").textContent = m.lead;
    renderHud();
    const renderers = { drills: renderDrills, tactics: renderTactics, spar: renderSpar, record: renderRecord, coach: renderCoach, settings: renderSettings };
    renderers[id]();
    $("station-title").focus?.();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }

  function backToGym() {
    stopSpeak();
    if (recognition && recognizing) recognition.stop();
    currentStation = null;
    stationEl.hidden = true;
    stationEl.setAttribute("aria-hidden", "true");
    gym.hidden = false;
    gym.removeAttribute("aria-hidden");
    document.body.classList.remove("in-station");
    stationBody.innerHTML = "";
    renderHud();
  }

  function voiceBar(input, status) {
    const row = document.createElement("div");
    row.className = "qa-row";
    const mic = attachMic(input, status);
    const stop = document.createElement("button");
    stop.type = "button";
    stop.className = "ghost-btn";
    stop.textContent = "Stop speaking";
    stop.addEventListener("click", stopSpeak);
    row.append(mic, stop);
    return row;
  }

  function renderDrills() {
    drill = pick(DRILLS[state.settings.difficulty]);
    stationBody.innerHTML = `
      <div class="panel">
        <h3>Coach drops the question</h3>
        <p id="drill-q" class="prompt-box"></p>
        <p class="status-line" id="drill-status"></p>
        <label class="sr-only" for="drill-a">Your answer</label>
        <textarea id="drill-a" placeholder="Speak or type your line. Count the odds."></textarea>
        <div id="drill-voice"></div>
        <div class="qa-row">
          <button type="button" class="primary-btn" id="drill-submit">Submit answer</button>
          <button type="button" class="ghost-btn" id="drill-skip">New question</button>
        </div>
      </div>
      <div class="panel" id="drill-out"><p class="empty">No critique yet. Hit the bag.</p></div>
    `;
    $("drill-q").textContent = drill.q;
    const ta = $("drill-a");
    const st = $("drill-status");
    $("drill-voice").append(voiceBar(ta, st));
    speak("Breathe. " + drill.q);
    $("drill-submit").onclick = () => submitDrill();
    $("drill-skip").onclick = () => renderDrills();
  }

  async function submitDrill() {
    const answer = $("drill-a").value.trim();
    const out = $("drill-out");
    const st = $("drill-status");
    if (!answer) {
      st.innerHTML = '<span class="status-line error">Empty stance. Give me a line.</span>';
      return;
    }
    out.innerHTML = '<p class="loading">Atlas is reading your stance…</p>';
    let text;
    try {
      if (hasKey()) {
        text = await groqChat([
          {
            role: "user",
            content: `Strategy drill (${drill.skill}, ${state.settings.difficulty}). Question: ${drill.q}\nPlayer answer: ${answer}\nCritique using Verdict / Why / Better Line / Next Drill.`,
          },
        ]);
      } else {
        text = localDrillCritique(drill.q, answer, drill.skill);
      }
      out.innerHTML = renderCritique(text);
      grantXp(8, drill.skill);
      completeDrill("Strategy: " + drill.skill);
      logFeedback(text, "drills");
      speak(text);
      st.textContent = hasKey() ? "Live coach." : "Local coach — add API key for Atlas live.";
    } catch (e) {
      out.innerHTML = `<p class="api-error">${escapeHtml(e.message)} Falling back to gym drills.</p>${renderCritique(localDrillCritique(drill.q, answer, drill.skill))}`;
      grantXp(5, drill.skill);
    }
  }

  function renderTactics() {
    scenario = generateScenario();
    stationBody.innerHTML = `
      <div class="panel board-card">
        <h3>Mock board</h3>
        <div class="chip-row">
          <span class="chip">Phase: ${escapeHtml(scenario.phase)}</span>
          <span class="chip">You ${scenario.you.vp} VP</span>
          <span class="chip">Atlas ${scenario.atlas.vp} VP</span>
          <span class="chip">Diff ${escapeHtml(state.settings.difficulty)}</span>
        </div>
        <div class="hex-map" id="hex-map"></div>
        <p>Ports: ${scenario.ports.join(" · ")}</p>
        <p>Your seat: ${escapeHtml(scenario.you.seat)}. Roads ${scenario.you.roads}, settlements ${scenario.you.settlements}, cities ${scenario.you.cities}, knights ${scenario.you.knights}.</p>
        <p>Atlas: ${escapeHtml(scenario.atlas.seat)}. Roads ${scenario.atlas.roads}, cities ${scenario.atlas.cities}, knights ${scenario.atlas.knights}.</p>
        <p>Hand — wood ${scenario.you.hand.wood}, brick ${scenario.you.hand.brick}, wheat ${scenario.you.hand.wheat}, sheep ${scenario.you.hand.sheep}, ore ${scenario.you.hand.ore}.</p>
        <p><strong>${escapeHtml(scenario.prompt)}</strong></p>
      </div>
      <div class="panel">
        <p class="status-line" id="tac-status"></p>
        <label for="tac-a">Your move</label>
        <textarea id="tac-a" placeholder="Best move. Then why it survives a bad roll."></textarea>
        <div id="tac-voice"></div>
        <div class="qa-row">
          <button type="button" class="primary-btn" id="tac-go">Analyze</button>
          <button type="button" class="ghost-btn" id="tac-new">New board</button>
        </div>
      </div>
      <div class="panel" id="tac-out"><p class="empty">Chalk is waiting.</p></div>
    `;
    const map = $("hex-map");
    scenario.tiles.forEach((t) => {
      const d = document.createElement("div");
      d.className = "hex " + t.terrain;
      d.innerHTML = `${t.num}<br>${t.res}`;
      map.append(d);
    });
    scenario.ports.forEach((p) => {
      const d = document.createElement("div");
      d.className = "hex port";
      d.textContent = p;
      map.append(d);
    });
    const ta = $("tac-a");
    $("tac-voice").append(voiceBar(ta, $("tac-status")));
    speak("Board is set. " + scenario.prompt);
    $("tac-go").onclick = submitTactics;
    $("tac-new").onclick = renderTactics;
  }

  async function submitTactics() {
    const answer = $("tac-a").value.trim();
    const out = $("tac-out");
    if (!answer) {
      $("tac-status").innerHTML = '<span class="status-line error">No move. The clock is running.</span>';
      return;
    }
    out.innerHTML = '<p class="loading">Atlas is tracing roads…</p>';
    const brief = JSON.stringify(scenario);
    let text;
    try {
      if (hasKey()) {
        text = await groqChat([
          {
            role: "user",
            content: `Tactics Lab board-state: ${brief}\nPlayer move: ${answer}\nAnalyze. Use Verdict / Why / Better Line / Next Drill.`,
          },
        ]);
      } else {
        text = localScenarioAnalysis(scenario, answer);
      }
      out.innerHTML = renderCritique(text);
      grantXp(10, "timing");
      completeDrill("Tactics board");
      logFeedback(text, "tactics");
      speak(text);
    } catch (e) {
      out.innerHTML = `<p class="api-error">${escapeHtml(e.message)}</p>${renderCritique(localScenarioAnalysis(scenario, answer))}`;
      grantXp(6, "timing");
    }
  }

  /* ---------- sparring ---------- */
  function newSpar() {
    const d = state.settings.difficulty;
    const youTiles = [
      { n: 6, r: "wood" },
      { n: 5, r: "brick" },
      { n: 9, r: "wheat" },
      { n: 4, r: "sheep" },
      { n: 8, r: "ore" },
    ];
    const atlasTiles =
      d === "Rookie"
        ? [
            { n: 3, r: "wood" },
            { n: 10, r: "brick" },
            { n: 5, r: "wheat" },
            { n: 11, r: "sheep" },
            { n: 9, r: "ore" },
          ]
        : d === "Elite"
          ? [
              { n: 8, r: "wood" },
              { n: 6, r: "brick" },
              { n: 5, r: "wheat" },
              { n: 9, r: "sheep" },
              { n: 10, r: "ore" },
            ]
          : [
              { n: 6, r: "wood" },
              { n: 4, r: "brick" },
              { n: 8, r: "wheat" },
              { n: 5, r: "sheep" },
              { n: 10, r: "ore" },
            ];
    const blankRes = () => ({ wood: 0, brick: 0, wheat: 0, sheep: 0, ore: 0 });
    return {
      turn: 1,
      actor: "you",
      lastRoll: null,
      robber: null,
      log: ["Bell. First round. Place your mind on production."],
      you: { res: { wood: 1, brick: 1, wheat: 1, sheep: 1, ore: 0 }, roads: 2, settlements: 2, cities: 0, knights: 0, devs: 0, vpCards: 0, tiles: youTiles },
      atlas: { res: { wood: 1, brick: 1, wheat: 0, sheep: 1, ore: 1 }, roads: 2, settlements: 2, cities: 0, knights: 0, devs: 0, vpCards: 0, tiles: atlasTiles },
      longest: null,
      army: null,
      over: false,
      winner: null,
    };
  }

  function countCards(p) {
    return Object.values(p.res).reduce((a, b) => a + b, 0);
  }

  function vpOf(side) {
    const p = spar[side];
    let vp = p.settlements + p.cities * 2 + p.vpCards;
    if (spar.longest === side) vp += 2;
    if (spar.army === side) vp += 2;
    return vp;
  }

  function updateAwards() {
    const yr = spar.you.roads;
    const ar = spar.atlas.roads;
    if (yr >= 5 && yr > ar) spar.longest = "you";
    else if (ar >= 5 && ar > yr) spar.longest = "atlas";
    const yk = spar.you.knights;
    const ak = spar.atlas.knights;
    if (yk >= 3 && yk > ak) spar.army = "you";
    else if (ak >= 3 && ak > yk) spar.army = "atlas";
  }

  function produce(n) {
    if (n === 7) return;
    ["you", "atlas"].forEach((side) => {
      spar[side].tiles.forEach((t) => {
        if (t.n === n && spar.robber !== `${side}-${t.r}`) spar[side].res[t.r] += 1;
      });
    });
  }

  function robberHit() {
    ["you", "atlas"].forEach((side) => {
      if (countCards(spar[side]) > 7) {
        const dump = Math.floor(countCards(spar[side]) / 2);
        const keys = ["wood", "brick", "wheat", "sheep", "ore"];
        let left = dump;
        keys.forEach((k) => {
          while (left > 0 && spar[side].res[k] > 0) {
            spar[side].res[k]--;
            left--;
          }
        });
        spar.log.push(`${side === "you" ? "You" : "Atlas"} discarded down after the 7.`);
      }
    });
  }

  function canAfford(p, cost) {
    return Object.keys(cost).every((k) => p.res[k] >= cost[k]);
  }
  function pay(p, cost) {
    Object.keys(cost).forEach((k) => (p.res[k] -= cost[k]));
  }

  const COSTS = {
    road: { wood: 1, brick: 1 },
    settlement: { wood: 1, brick: 1, wheat: 1, sheep: 1 },
    city: { wheat: 2, ore: 3 },
    dev: { wheat: 1, sheep: 1, ore: 1 },
  };

  function tryBuild(side, kind) {
    const p = spar[side];
    if (kind === "road") {
      if (!canAfford(p, COSTS.road)) return "No wood-brick. Roads are not wishes.";
      pay(p, COSTS.road);
      p.roads++;
      return "Road down.";
    }
    if (kind === "settlement") {
      if (p.settlements + p.cities >= 5) return "No more settlement slots in this gym ruleset.";
      if (!canAfford(p, COSTS.settlement)) return "Missing a resource for the settlement.";
      pay(p, COSTS.settlement);
      p.settlements++;
      return "Settlement planted.";
    }
    if (kind === "city") {
      if (p.settlements < 1) return "No settlement to upgrade.";
      if (!canAfford(p, COSTS.city)) return "City needs wheat-wheat-ore-ore-ore.";
      pay(p, COSTS.city);
      p.settlements--;
      p.cities++;
      return "City rises.";
    }
    if (kind === "dev") {
      if (!canAfford(p, COSTS.dev)) return "Dev card needs wheat, sheep, ore.";
      pay(p, COSTS.dev);
      p.devs++;
      const roll = Math.random();
      if (roll < 0.45) {
        p.knights++;
        return "Knight in the hole.";
      }
      if (roll < 0.6) {
        p.vpCards++;
        return "Hidden point. Keep your face still.";
      }
      p.res.wood++;
      p.res.brick++;
      return "Road-building energy: wood and brick flash in.";
    }
    return "Unknown action.";
  }

  function bankTrade(side, from, to) {
    const p = spar[side];
    if (p.res[from] < 4) return "Need four of a kind for the bank.";
    if (from === to) return "That trade goes nowhere.";
    p.res[from] -= 4;
    p.res[to] += 1;
    return `Bank: 4 ${from} for 1 ${to}.`;
  }

  function playKnight(side, targetRes) {
    const p = spar[side];
    if (p.knights < 1 && p.devs < 1) return "No knight ready.";
    const foe = side === "you" ? "atlas" : "you";
    spar.robber = `${foe}-${targetRes}`;
    const keys = ["wood", "brick", "wheat", "sheep", "ore"];
    const steal = keys.find((k) => spar[foe].res[k] > 0);
    if (steal) {
      spar[foe].res[steal]--;
      p.res[steal]++;
    }
    if (p.knights < 1) p.knights++;
    return `Knight pins ${targetRes}. ${steal ? "Card stolen." : "Empty pockets."}`;
  }

  function checkWin() {
    updateAwards();
    const y = vpOf("you");
    const a = vpOf("atlas");
    if (y >= WIN_VP) {
      spar.over = true;
      spar.winner = "you";
      spar.log.push("Ten. You take the round. Do not get drunk on it.");
      grantXp(25, "timing");
      completeDrill("Spar win");
    } else if (a >= WIN_VP) {
      spar.over = true;
      spar.winner = "atlas";
      spar.log.push("Atlas hits ten. Study the last three turns. Again.");
      grantXp(8, "timing");
      completeDrill("Spar loss");
    }
  }

  function atlasThink() {
    const p = spar.atlas;
    const notes = [];
    if (canAfford(p, COSTS.city) && p.settlements > 0) {
      notes.push(tryBuild("atlas", "city"));
      notes.push("Cities compress the race. I city when the ore is real, not when I feel brave.");
    } else if (canAfford(p, COSTS.settlement) && p.settlements + p.cities < 5) {
      notes.push(tryBuild("atlas", "settlement"));
      notes.push("New seat. Diversity before greed.");
    } else if (canAfford(p, COSTS.dev) && (state.settings.difficulty !== "Rookie" || p.cities > 0)) {
      notes.push(tryBuild("atlas", "dev"));
      notes.push("Army and hidden points are closed-guard work.");
    } else if (canAfford(p, COSTS.road) && p.roads < 8) {
      notes.push(tryBuild("atlas", "road"));
      notes.push("Roads are not vanity. They are the longest-road knife and the block.");
    } else if (p.res.wood >= 4) {
      notes.push(bankTrade("atlas", "wood", p.res.ore < 2 ? "ore" : "wheat"));
      notes.push("I do not sit on dead wood. Convert or lose tempo.");
    } else if (p.res.sheep >= 4) {
      notes.push(bankTrade("atlas", "sheep", "ore"));
    } else {
      notes.push("Hold. Next roll must complete a cost. Patience is a punch.");
    }
    if (p.knights > 0 && vpOf("you") >= vpOf("atlas")) {
      notes.push(playKnight("atlas", "ore"));
      notes.push("Robber on your ore. I cut the city path when you smell like a finish.");
    }
    return notes.filter(Boolean).join(" ");
  }

  function endYouTurn() {
    if (spar.over) return;
    checkWin();
    if (spar.over) {
      paintSpar();
      return;
    }
    spar.actor = "atlas";
    const n = roll2d6();
    spar.lastRoll = n;
    spar.log.push(`Atlas rolls ${n}.`);
    if (n === 7) robberHit();
    else produce(n);
    const why = atlasThink();
    spar.log.push("Atlas: " + why);
    checkWin();
    spar.turn++;
    spar.actor = "you";
    if (!spar.over) {
      const n2 = roll2d6();
      spar.lastRoll = n2;
      spar.log.push(`Your roll: ${n2}.`);
      if (n2 === 7) {
        robberHit();
        spar.log.push("Seven. Discard if heavy. Then pin a resource with Knight or wait.");
      } else produce(n2);
    }
    paintSpar();
    speak(why);
  }

  function startYourRoll() {
    const n = roll2d6();
    spar.lastRoll = n;
    spar.log.push(`Your roll: ${n}.`);
    if (n === 7) {
      robberHit();
      spar.log.push("Seven. Discard if heavy.");
    } else produce(n);
  }

  function renderSpar() {
    if (!spar || spar.over) {
      spar = newSpar();
      startYourRoll();
    }
    paintSpar();
  }

  function paintSpar() {
    const y = spar.you;
    const resHtml = (p) =>
      `<div class="resources">${["wood", "brick", "wheat", "sheep", "ore"]
        .map((k) => `<div class="res">${k}<b>${p.res[k]}</b></div>`)
        .join("")}</div>`;
    stationBody.innerHTML = `
      <div class="panel">
        <div class="chip-row">
          <span class="chip">Turn ${spar.turn}</span>
          <span class="chip">Roll ${spar.lastRoll ?? "—"}</span>
          <span class="chip">You ${vpOf("you")} VP</span>
          <span class="chip">Atlas ${vpOf("atlas")} VP</span>
          <span class="chip">${spar.longest ? "Longest: " + spar.longest : "No longest"}</span>
          <span class="chip">${spar.army ? "Army: " + spar.army : "No army"}</span>
        </div>
        <h3>Your corner</h3>
        ${resHtml(y)}
        <p>Roads ${y.roads} · Settlements ${y.settlements} · Cities ${y.cities} · Knights ${y.knights} · Hidden VP ${y.vpCards}</p>
        <p>Tiles: ${y.tiles.map((t) => t.n + " " + t.r).join(" · ")}</p>
        <div class="actions-grid" id="spar-actions"></div>
      </div>
      <div class="panel">
        <h3>Atlas</h3>
        <p>Visible: roads ${spar.atlas.roads}, settlements ${spar.atlas.settlements}, cities ${spar.atlas.cities}, knights ${spar.atlas.knights}. Cards ${countCards(spar.atlas)}.</p>
        <p>Tiles: ${spar.atlas.tiles.map((t) => t.n + " " + t.r).join(" · ")}</p>
      </div>
      <div class="panel">
        <h3>Round talk</h3>
        <div id="spar-log" class="chat-log"></div>
      </div>
    `;
    const log = $("spar-log");
    spar.log.slice(-10).forEach((line) => {
      const d = document.createElement("div");
      d.className = "log-item";
      d.textContent = line;
      log.append(d);
    });
    const box = $("spar-actions");
    const add = (label, fn, cls = "ghost-btn") => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = cls;
      b.textContent = label;
      b.disabled = spar.over || spar.actor !== "you";
      b.onclick = fn;
      box.append(b);
    };
    if (spar.over) {
      box.innerHTML = `<p><strong>${spar.winner === "you" ? "You take the round." : "Atlas wins the round."}</strong></p>`;
      add("Rematch", () => {
        spar = newSpar();
        startYourRoll();
        paintSpar();
      }, "primary-btn");
      return;
    }
    add("Build road", () => act(() => tryBuild("you", "road")));
    add("Settlement", () => act(() => tryBuild("you", "settlement")));
    add("City", () => act(() => tryBuild("you", "city")));
    add("Buy dev", () => act(() => tryBuild("you", "dev")));
    add("Knight on ore", () => act(() => playKnight("you", "ore")));
    add("4:1 wood→ore", () => act(() => bankTrade("you", "wood", "ore")));
    add("4:1 sheep→brick", () => act(() => bankTrade("you", "sheep", "brick")));
    add("4:1 wheat→brick", () => act(() => bankTrade("you", "wheat", "brick")));
    add("End round", () => endYouTurn(), "primary-btn");
  }

  function act(fn) {
    const msg = fn();
    spar.log.push("You: " + msg);
    toast(msg);
    checkWin();
    paintSpar();
  }

  function renderRecord() {
    const weak = [...SKILLS].sort((a, b) => state.skills[a] - state.skills[b]).slice(0, 2);
    const strong = [...SKILLS].sort((a, b) => state.skills[b] - state.skills[a]).slice(0, 2);
    stationBody.innerHTML = `
      <div class="record-grid">
        <div class="stat-card"><span>Rank</span><strong>${escapeHtml(rankName(state.xp))}</strong></div>
        <div class="stat-card"><span>XP</span><strong>${state.xp}</strong></div>
        <div class="stat-card"><span>Streak</span><strong>${state.streak} days</strong></div>
        <div class="stat-card"><span>Drills logged</span><strong>${state.completed.length}</strong></div>
      </div>
      <div class="panel">
        <h3>Skills</h3>
        <p>Strongest: ${strong.join(", ")}. Leaking: ${weak.join(", ")}.</p>
        ${SKILLS.map(
          (s) =>
            `<div class="log-item">${s}<div class="skill-bar" aria-label="${s} ${state.skills[s]}"><i style="width:${state.skills[s]}%"></i></div></div>`
        ).join("")}
      </div>
      <div class="panel">
        <h3>Completed work</h3>
        ${
          state.completed.length
            ? state.completed.map((c) => `<div class="log-item">${escapeHtml(c.title)} · ${new Date(c.t).toLocaleString()}</div>`).join("")
            : '<p class="empty">No drills finished. The bag is still swinging.</p>'
        }
      </div>
      <div class="panel">
        <h3>Recent feedback</h3>
        ${
          state.feedback.length
            ? state.feedback.map((f) => `<div class="log-item">${escapeHtml(f.station)} — ${escapeHtml(f.text)}</div>`).join("")
            : '<p class="empty">Atlas has not marked you yet.</p>'
        }
      </div>
    `;
  }

  function renderCoach() {
    stationBody.innerHTML = `
      <div class="panel" id="coach-log"></div>
      <div class="panel">
        <p class="status-line" id="coach-status">${hasKey() ? "Live line open." : "Local Atlas. Add a Groq key for full conversation."}</p>
        <label for="coach-in">Message to Atlas</label>
        <textarea id="coach-in" placeholder="Ask for a review, a custom drill, or a placement argument."></textarea>
        <div id="coach-voice"></div>
        <div class="qa-row">
          <button type="button" class="primary-btn" id="coach-send">Send</button>
          <button type="button" class="ghost-btn" id="coach-clear">Clear chat</button>
        </div>
      </div>
    `;
    paintCoachLog();
    const ta = $("coach-in");
    $("coach-voice").append(voiceBar(ta, $("coach-status")));
    $("coach-send").onclick = sendCoach;
    $("coach-clear").onclick = () => {
      state.chat = [];
      chatHistory = [];
      save();
      paintCoachLog();
    };
    if (!state.chat.length) {
      const open = "Gloves on. Tell me the board or the leak. I will not flatter you.";
      state.chat.push({ role: "atlas", text: open });
      save();
      paintCoachLog();
      speak(open);
    }
  }

  function paintCoachLog() {
    const log = $("coach-log");
    if (!log) return;
    if (!state.chat.length) {
      log.innerHTML = '<p class="empty">Corner is quiet.</p>';
      return;
    }
    log.innerHTML = state.chat
      .map(
        (m) =>
          `<div class="msg ${m.role === "atlas" ? "atlas" : "you"}"><div class="who">${m.role === "atlas" ? "Atlas" : "You"}</div>${escapeHtml(m.text)}</div>`
      )
      .join("");
    log.scrollTop = log.scrollHeight;
  }

  function localCoachReply(text) {
    const t = text.toLowerCase();
    if (/place|start|opening/.test(t)) {
      return "Opening is not pretty hexes. It is pip sum, color spread, and a second seat that still cities. Take 6/8/5 over a rainbow 3/11/4. Then point your roads at the port that matches your flood resource.";
    }
    if (/trade/.test(t)) {
      return "Never sell the brick that completes someone else’s 9 or 10. Trade from surplus after you can still act this turn. If they are at 8 VP, the price is not wheat. The price is the game.";
    }
    if (/robber|seven/.test(t)) {
      return "Robber goes on the leader’s city resource, or on the pip that unsticks a rival engine. Stealing from a 2-card hand is a wasted punch.";
    }
    if (/longest|road/.test(t)) {
      return "Longest road is a knife, not a lifestyle. Build it when it is cheaper than a city, or when it blocks their 2:1. Do not donate the chain with a polite gap.";
    }
    return "Breathe. Count pips. Name the 10-point path. If your last three turns did not create a point or a threat, you were busy, not dangerous. Again — what is the constraint on your board?";
  }

  async function sendCoach() {
    const ta = $("coach-in");
    const text = ta.value.trim();
    if (!text) return;
    ta.value = "";
    state.chat.push({ role: "you", text });
    save();
    paintCoachLog();
    const st = $("coach-status");
    st.innerHTML = '<span class="loading">Atlas is cutting the noise…</span>';
    let reply;
    try {
      if (hasKey()) {
        reply = await groqChat([{ role: "user", content: text }]);
      } else {
        reply = localCoachReply(text);
      }
    } catch (e) {
      reply = localCoachReply(text) + "\n(" + e.message + ")";
      st.innerHTML = `<span class="status-line error">${escapeHtml(e.message)}</span>`;
    }
    state.chat.push({ role: "atlas", text: reply });
    state.chat = state.chat.slice(-24);
    logFeedback(reply, "coach");
    grantXp(3, "timing");
    save();
    paintCoachLog();
    speak(reply);
    if (hasKey()) st.textContent = "Live line open.";
    else st.textContent = "Local Atlas. Add a Groq key for full conversation.";
  }

  function renderSettings() {
    stationBody.innerHTML = `
      <div class="panel">
        <h3>Groq API key</h3>
        <p>Stored only in localStorage on this device. Never sent anywhere except Groq chat completions.</p>
        <label for="api-key">API key</label>
        <input type="password" id="api-key" autocomplete="off" value="${escapeHtml(state.settings.apiKey)}" />
        <div class="settings-row">
          <button type="button" class="primary-btn" id="save-key">Save key</button>
          <button type="button" class="ghost-btn" id="clear-key">Clear key</button>
        </div>
        <p class="status-line" id="key-status">${hasKey() ? "Key on file." : "No key — local drills active."}</p>
      </div>
      <div class="panel">
        <h3>Difficulty</h3>
        <select id="diff">
          <option>Rookie</option>
          <option>Competitive</option>
          <option>Elite</option>
        </select>
      </div>
      <div class="panel">
        <h3>Voice</h3>
        <p class="compat">${speechSupported() ? "Microphone recognition available." : "This browser cannot do Speech Recognition. Type instead. Chrome or Edge recommended."}</p>
        <p>Speech synthesis: ${window.speechSynthesis ? "available" : "not available"}.</p>
        <label><input type="checkbox" id="voice-on" /> Coach voice replies</label><br />
        <label><input type="checkbox" id="mute" /> Mute all speech</label>
      </div>
      <div class="panel">
        <h3>Progress</h3>
        <button type="button" class="danger-btn" id="reset">Reset all progress</button>
      </div>
    `;
    $("diff").value = state.settings.difficulty;
    $("voice-on").checked = state.settings.voiceOn;
    $("mute").checked = state.settings.mute;
    $("save-key").onclick = () => {
      state.settings.apiKey = $("api-key").value.trim();
      save();
      $("key-status").textContent = hasKey() ? "Key saved on this device." : "Empty key. Local mode.";
      toast("Settings locked in.");
    };
    $("clear-key").onclick = () => {
      state.settings.apiKey = "";
      $("api-key").value = "";
      save();
      $("key-status").textContent = "Key cleared. Local drills active.";
    };
    $("diff").onchange = () => {
      state.settings.difficulty = $("diff").value;
      save();
    };
    $("voice-on").onchange = () => {
      state.settings.voiceOn = $("voice-on").checked;
      save();
    };
    $("mute").onchange = () => {
      state.settings.mute = $("mute").checked;
      save();
      if (state.settings.mute) stopSpeak();
    };
    $("reset").onclick = () => {
      if (!confirm("Wipe rank, XP, chat, and the API key from this browser?")) return;
      const keepDiff = state.settings.difficulty;
      state = defaultState();
      state.settings.difficulty = keepDiff;
      chatHistory = [];
      spar = null;
      save();
      renderHud();
      renderSettings();
      toast("The dojo floor is clean.");
    };
  }

  function enterDojo() {
    intro.hidden = true;
    intro.setAttribute("aria-hidden", "true");
    gym.hidden = false;
    gym.removeAttribute("aria-hidden");
    hud.hidden = false;
    legal.hidden = false;
    document.body.classList.add("in-dojo");
    document.body.classList.remove("in-station");
    currentStation = null;
    renderHud();
    const first = document.querySelector(".hotspot");
    first?.focus();
    speak("Enter. The floor is live. Pick a station.");
  }

  function onKey(e) {
    if (e.key === "Escape" && currentStation) {
      e.preventDefault();
      backToGym();
    }
  }

  function init() {
    $("enter-dojo").addEventListener("click", enterDojo);
    $("back-gym").addEventListener("click", backToGym);
    $("stop-speech").addEventListener("click", stopSpeak);
    document.querySelectorAll(".hotspot").forEach((btn) => {
      btn.addEventListener("click", () => openStation(btn.dataset.station));
    });
    document.addEventListener("keydown", onKey);
    if (window.speechSynthesis) window.speechSynthesis.getVoices();
  }

  init();
})();

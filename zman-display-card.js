/**
 * Zman Display Card
 * A full-screen, living wall display: the sky follows the real zmanim, the sun
 * travels a "day arc" of today's zmanim, and on Erev Shabbos / Shabbos / Yom Tov
 * the whole screen turns to candlelight with the shul schedule.
 */

const ZDC_VERSION = "0.7.2";

console.info(
  `%c ZMAN-DISPLAY-CARD %c v${ZDC_VERSION} `,
  "color:#1a1206;background:#ffc46b;font-weight:700;border-radius:3px 0 0 3px;padding:2px 0 2px 6px;",
  "color:#ffc46b;background:#1a1206;font-weight:700;border-radius:0 3px 3px 0;padding:2px 6px 2px 0;"
);

const ZDC_DEFAULTS = {
  weather: "weather.home",
  hebrew_date: "sensor.yidcal_date",
  daf_yomi: "sensor.yidcal_daf_hayomi",
  holiday: "sensor.yidcal_holiday",
  parsha: "sensor.yidcal_parsha",
  parsha_fallback: "sensor.jewish_calendar_parshat_hashavua",
  upcoming_holiday: "sensor.yidcal_upcoming_holiday",
  upcoming_yomtov: "binary_sensor.yidcal_upcoming_yomtov",
  rosh_chodesh: "binary_sensor.yidcal_rosh_chodesh",
  shabbos_mevorchim: "binary_sensor.yidcal_shabbos_mevorchim",
  kiddush_levana: "binary_sensor.yidcal_kiddush_levana",
  candle_lighting: "sensor.yidcal_zman_erev",
  havdalah: "sensor.yidcal_zman_motzi",
  shul_schedule: "sensor.shul_zmanim",
  weather_alert: "",
  // Any of these "on" switches the display into Shabbos / Yom Tov mode.
  shabbos_mode: [
    "binary_sensor.yidcal_erev",
    "binary_sensor.yidcal_motzi",
    "binary_sensor.yidcal_no_melucha",
  ],
  // Order matters: the arc runs from the first zman to the last one.
  zmanim: [
    { name: "עלות השחר", entity: "sensor.yidcal_alos" },
    { name: "הנץ החמה", entity: "sensor.yidcal_netz" },
    { name: "חצות", entity: "sensor.yidcal_chatzos_hayom" },
    { name: "שקיעה", entity: "sensor.yidcal_shkia" },
  ],
  rooms: [],
  events: [],
  forecast_hours: 12,
  forecast_days: 7,
  alerts: [],
};

const ZDC_HEB_DAYS = ["יום א׳", "יום ב׳", "יום ג׳", "יום ד׳", "יום ה׳", "יום ו׳", "שבת קודש"];

const ZDC_WEATHER_ICONS = {
  "clear-night": "mdi:weather-night",
  cloudy: "mdi:weather-cloudy",
  exceptional: "mdi:alert-circle-outline",
  fog: "mdi:weather-fog",
  hail: "mdi:weather-hail",
  lightning: "mdi:weather-lightning",
  "lightning-rainy": "mdi:weather-lightning-rainy",
  partlycloudy: "mdi:weather-partly-cloudy",
  pouring: "mdi:weather-pouring",
  rainy: "mdi:weather-rainy",
  snowy: "mdi:weather-snowy",
  "snowy-rainy": "mdi:weather-snowy-rainy",
  sunny: "mdi:weather-sunny",
  windy: "mdi:weather-windy",
  "windy-variant": "mdi:weather-windy-variant",
};

const ZDC_BAD = new Set(["", "unknown", "unavailable", "none", "None"]);

const ZDC_SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ---------------------------------------------------------------- holiday themes
// Small SVG symbols (viewBox 0 0 40 40) for the floating decorations. "currentColor"
// parts take the colour picked for each floater.
const ZDC_SYM = {
  apple: `<path d="M20 12c-6-4-15-1-15 9 0 9 7 15 11 15 2 0 3-1 4-1s2 1 4 1c4 0 11-6 11-15 0-10-9-13-15-9z" fill="#d6283b"/><path d="M20 12c0-4 2-7 5-8" stroke="#6b3e1f" stroke-width="2" fill="none"/><path d="M21 9c3-4 8-4 10-2-3 3-7 3-10 2z" fill="#5cb85c"/><ellipse cx="13" cy="19" rx="2.5" ry="4" fill="#fff" opacity=".35"/>`,
  drop: `<path d="M20 4C14 14 10 20 10 26a10 10 0 0 0 20 0c0-6-4-12-10-22z" fill="currentColor"/><ellipse cx="16" cy="25" rx="2.5" ry="4" fill="#fff" opacity=".45"/>`,
  pom: `<circle cx="20" cy="24" r="13" fill="#b3123a"/><path d="M14 12l2-6 4 4 4-4 2 6z" fill="#8c0d2c"/><circle cx="15" cy="20" r="3.5" fill="#ff7a93" opacity=".4"/>`,
  leaf: `<path d="M6 34C6 16 18 6 34 6c0 16-10 28-28 28z" fill="currentColor"/><path d="M8 32L30 10" stroke="#000" stroke-opacity=".25" stroke-width="1.5"/>`,
  esrog: `<ellipse cx="20" cy="22" rx="11" ry="14" fill="#f2d129"/><path d="M20 8V3" stroke="#6b8e23" stroke-width="2"/><ellipse cx="16" cy="17" rx="3" ry="5" fill="#fffbd0" opacity=".5"/>`,
  confetti: `<rect x="15" y="8" width="10" height="24" rx="2" fill="currentColor"/>`,
  flag: `<path d="M10 3v35" stroke="#e8d7a8" stroke-width="2.5"/><path d="M11 4h23l-6 8 6 8H11z" fill="currentColor"/><path d="M19 8l3 5h-6z M19 16l3-5h-6z" fill="#fff" opacity=".8"/>`,
  dreidel: `<path d="M20 1v8" stroke="#dfe7ff" stroke-width="3" stroke-linecap="round"/><path d="M9 9h22v15L20 38 9 24z" fill="currentColor"/><path d="M20 9v29L9 24V9z" fill="#fff" opacity=".18"/>`,
  star: `<path d="M20 4L34 28H6z M20 36L6 12h28z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>`,
  mask: `<path d="M3 13c6-4 11-2 17 2 6-4 11-6 17-2-1 11-6 15-10 15-3 0-5-3-7-3s-4 3-7 3c-4 0-9-4-10-15z" fill="currentColor"/><ellipse cx="12.5" cy="17.5" rx="3.5" ry="2.5" fill="#1a1030"/><ellipse cx="27.5" cy="17.5" rx="3.5" ry="2.5" fill="#1a1030"/><path d="M3 13c-2-5 1-9 4-10" stroke="#ffd54f" stroke-width="1.5" fill="none"/>`,
  hamantasch: `<path d="M20 4L37 34H3z" fill="#d9a55b" stroke="#b07a35" stroke-width="2" stroke-linejoin="round"/><path d="M20 15l8 14H12z" fill="#4a1633"/>`,
  matzah: `<rect x="4" y="6" width="32" height="28" rx="3" fill="#e8cf9a"/><path d="M9 12h22M9 18h22M9 24h22M9 30h22" stroke="#a87c3f" stroke-width="1.6" stroke-dasharray="1.2 3"/><path d="M4 12l3 2-3 3M36 20l-3 2 3 3" stroke="#c9a567" fill="none"/>`,
  kos: `<path d="M10 4h20c0 10-4 16-10 16S10 14 10 4z" fill="#8e1b3a" stroke="#e2bf55" stroke-width="1.6"/><path d="M20 20v11M13 35h14" stroke="#e2bf55" stroke-width="2.6" stroke-linecap="round"/>`,
  flower: `<g fill="currentColor"><circle cx="20" cy="11" r="7"/><circle cx="29" cy="18" r="7"/><circle cx="25.5" cy="29" r="7"/><circle cx="14.5" cy="29" r="7"/><circle cx="11" cy="18" r="7"/></g><circle cx="20" cy="21" r="5" fill="#ffd54f"/>`,
  ember: `<circle cx="20" cy="20" r="7" fill="currentColor"/><circle cx="20" cy="20" r="3" fill="#fff6c8"/>`,
  grapes: `<path d="M20 6c2-3 5-4 8-3" stroke="#6b8e23" stroke-width="2" fill="none"/><g fill="currentColor"><circle cx="15" cy="12" r="5"/><circle cx="25" cy="12" r="5"/><circle cx="20" cy="20" r="5"/><circle cx="11" cy="20" r="5"/><circle cx="29" cy="20" r="5"/><circle cx="15" cy="28" r="5"/><circle cx="25" cy="28" r="5"/><circle cx="20" cy="35" r="4"/></g>`,
  mote: `<circle cx="20" cy="20" r="9" fill="currentColor" opacity=".35"/><circle cx="20" cy="20" r="4" fill="currentColor"/>`,
  frond: `<path d="M2 38 Q20 22 38 2" stroke="currentColor" stroke-width="2" fill="none"/>${[6, 11, 16, 21, 26, 31].map((t) => `<path d="M${t} ${40 - t * 1.05} l-6 -9 M${t} ${40 - t * 1.05} l9 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`).join("")}`,
  bow: `<path d="M12 3c15 8 15 26 0 34" fill="none" stroke="#c28a4a" stroke-width="3"/><path d="M12 3v34" stroke="#eee" stroke-width="1"/><path d="M6 20h28M29 15l5 5-5 5" stroke="#ddd" stroke-width="2" fill="none"/>`,
};

// Large signature pieces shown faintly across the top of the screen.
const ZDC_MOTIF = {
  // n = how many candles are lit tonight (lit from the right, like the real menorah).
  menorah: (n) => {
    const xs = [360, 320, 280, 240, 160, 120, 80, 40];
    const flame = (x, y) => `<g transform="translate(${x} ${y})"><ellipse cx="0" cy="-8" rx="16" ry="22" class="halo"/><path class="flame" d="M0 -26 C 7 -16 8 -8 0 0 C -8 -8 -7 -16 0 -26 Z"/><path class="flame core" d="M0 -14 C 3 -10 3 -5 0 -1 C -3 -5 -3 -10 0 -14 Z"/></g>`;
    let arms = "";
    for (let r = 40; r <= 160; r += 40) arms += `<path d="M${200 - r} 92 A ${r} ${r * 0.9} 0 0 0 ${200 + r} 92" class="arm"/>`;
    const cups = xs.map((x, i) => `<rect x="${x - 7}" y="66" width="14" height="26" rx="3" class="cand"/>${i < n ? flame(x, 64) : ""}`).join("");
    return `<svg viewBox="0 -10 400 290" class="motif menorah">${arms}
      <path d="M200 60 V 250" class="arm"/><path d="M150 262 Q 200 236 250 262 Z" class="base"/>
      <rect x="193" y="30" width="14" height="30" rx="3" class="cand"/>${n > 0 ? flame(200, 28) : ""}${cups}</svg>`;
  },
  // A tapered, flaring horn: the outline is built along a curved centreline.
  shofar: () => {
    const P = [[18, 120], [200, 168], [262, 36]];
    const at = (t) => {
      const u = 1 - t;
      const x = u * u * P[0][0] + 2 * u * t * P[1][0] + t * t * P[2][0];
      const y = u * u * P[0][1] + 2 * u * t * P[1][1] + t * t * P[2][1];
      const dx = 2 * u * (P[1][0] - P[0][0]) + 2 * t * (P[2][0] - P[1][0]);
      const dy = 2 * u * (P[1][1] - P[0][1]) + 2 * t * (P[2][1] - P[1][1]);
      const len = Math.hypot(dx, dy);
      const w = 5 + 36 * t * t;
      return { x, y, nx: -dy / len, ny: dx / len, w };
    };
    const up = [];
    const down = [];
    for (let i = 0; i <= 40; i++) {
      const p = at(i / 40);
      up.push(`${(p.x + p.nx * p.w).toFixed(1)} ${(p.y + p.ny * p.w).toFixed(1)}`);
      down.unshift(`${(p.x - p.nx * p.w).toFixed(1)} ${(p.y - p.ny * p.w).toFixed(1)}`);
    }
    const end = at(1);
    const ang = (Math.atan2(end.ny, end.nx) * 180) / Math.PI;
    const ridges = [0.3, 0.45, 0.6, 0.74, 0.86]
      .map((t) => { const p = at(t); return `<path d="M${(p.x + p.nx * p.w).toFixed(1)} ${(p.y + p.ny * p.w).toFixed(1)} L${(p.x - p.nx * p.w).toFixed(1)} ${(p.y - p.ny * p.w).toFixed(1)}" stroke="#8a5b24" stroke-opacity=".5" stroke-width="2.5"/>`; })
      .join("");
    return `<svg viewBox="0 0 320 190" class="motif shofar"><defs><linearGradient id="zdcHorn" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff4d6"/><stop offset=".55" stop-color="#e9bb62"/><stop offset="1" stop-color="#a26d2d"/></linearGradient></defs>
      <path d="M${up.join(" L")} L${down.join(" L")} Z" fill="url(#zdcHorn)"/>${ridges}
      <ellipse cx="${end.x.toFixed(1)}" cy="${end.y.toFixed(1)}" rx="${end.w.toFixed(1)}" ry="9" transform="rotate(${ang.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)})" fill="#5a3712" stroke="#f3d08a" stroke-width="3"/>
      <rect x="10" y="${(at(0).y - 6).toFixed(1)}" width="10" height="12" rx="3" fill="#d8a758"/></svg>`;
  },
  // Lulav (palm, aravos on the left, hadassim on the right, in a woven holder) and an esrog.
  lulav: () => {
    const hadas = [];
    for (let y = 196; y >= 86; y -= 14)
      for (const [dx, rot] of [[-7, -35], [7, 35], [0, 0]])
        hadas.push(`<ellipse cx="${146 + dx}" cy="${y - (dx ? 0 : 6)}" rx="4" ry="8" transform="rotate(${rot} ${146 + dx} ${y})" fill="#2f6b34"/>`);
    const aravos = [[-10, 60], [-4, 48], [3, 66]]
      .map(([rot, top]) => `<path d="M96 200 Q ${92 + rot / 2} ${(200 + top) / 2} ${94 + rot} ${top} Q ${100 + rot / 2} ${(200 + top) / 2} 98 200 Z" fill="#8db45e" transform="rotate(${rot} 96 200)"/>`)
      .join("");
    const leaflets = [60, 90, 120, 150, 180].map((y) => `<path d="M112 ${y} l-5 -14 M120 ${y} l5 -14" stroke="#4f7a2c" stroke-width="1.5"/>`).join("");
    return `<svg viewBox="0 0 260 300" class="motif lulav"><defs>
        <linearGradient id="zdcPalm" x1="0" x2="1"><stop offset="0" stop-color="#557f2e"/><stop offset=".5" stop-color="#8fb857"/><stop offset="1" stop-color="#557f2e"/></linearGradient>
        <radialGradient id="zdcEsrog" cx=".38" cy=".35"><stop offset="0" stop-color="#fff6a8"/><stop offset=".55" stop-color="#f2cf2a"/><stop offset="1" stop-color="#c79a12"/></radialGradient></defs>
      <path d="M108 292 L108 40 Q116 -6 124 40 L124 292 Z" fill="url(#zdcPalm)"/>${leaflets}
      <path d="M116 292 V20" stroke="#3f6423" stroke-width="1.5"/>
      ${aravos}<path d="M96 290 V120" stroke="#9c4a3a" stroke-width="2.5"/>
      <path d="M146 290 V80" stroke="#6d4a2a" stroke-width="2.5"/>${hadas.join("")}
      <rect x="86" y="206" width="72" height="42" rx="8" fill="#c9a25a"/>
      <path d="M90 214 h64 M90 227 h64 M90 240 h64" stroke="#8f6c2c" stroke-width="2"/>
      <path d="M98 206 l10 42 M114 206 l10 42 M130 206 l10 42 M146 206 l8 34" stroke="#e2c27a" stroke-width="2" opacity=".7"/>
      <g transform="rotate(-18 208 238)">
        <ellipse cx="208" cy="238" rx="34" ry="44" fill="url(#zdcEsrog)"/>
        ${[[196, 222], [214, 212], [222, 238], [200, 250], [216, 262], [188, 238]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#b88d10" opacity=".6"/>`).join("")}
        <path d="M208 194 v-8" stroke="#6b4a1f" stroke-width="4" stroke-linecap="round"/>
        <path d="M208 282 q10 12 22 8 q-8 -10 -22 -8z" fill="#5d8a35"/></g></svg>`;
  },
  torah: () => `<svg viewBox="0 0 300 200" class="motif torah">
      <rect x="40" y="18" width="30" height="170" rx="12" fill="#7a4a24"/><rect x="230" y="18" width="30" height="170" rx="12" fill="#7a4a24"/>
      <circle cx="55" cy="14" r="12" fill="#e2bf55"/><circle cx="245" cy="14" r="12" fill="#e2bf55"/>
      <rect x="70" y="30" width="160" height="146" fill="#f6ecd2"/>
      ${[48, 64, 80, 96, 112, 128, 144, 160].map((y) => `<path d="M86 ${y}h56M158 ${y}h56" stroke="#4b3a26" stroke-width="3" stroke-dasharray="7 4" opacity=".7"/>`).join("")}</svg>`,
  luchos: () => `<svg viewBox="0 0 320 190" class="motif luchos">
      <path d="M0 190 L 110 70 L 160 110 L 210 60 L 320 190 Z" fill="#2f5a3a" opacity=".8"/>
      <g transform="translate(108 6)"><path d="M0 110 V 32 a 26 26 0 0 1 52 0 V 110 Z M 54 110 V 32 a 26 26 0 0 1 52 0 V 110 Z" fill="#f3efe2" stroke="#d8c690" stroke-width="3"/>
      ${[40, 56, 72, 88].map((y) => `<path d="M10 ${y}h32M64 ${y}h32" stroke="#6f6245" stroke-width="3" opacity=".6"/>`).join("")}</g></svg>`,
  moon: () => `<svg viewBox="0 0 200 200" class="motif fullmoon"><circle cx="100" cy="100" r="92" fill="#fff4d6" opacity=".12"/><circle cx="100" cy="100" r="62" fill="#fff6dc"/><circle cx="80" cy="86" r="10" fill="#e9dcb8" opacity=".6"/><circle cx="118" cy="118" r="14" fill="#e9dcb8" opacity=".5"/><circle cx="118" cy="78" r="6" fill="#e9dcb8" opacity=".6"/></svg>`,
};

// Themes, checked in order against YidCal's holiday flags (sensor.yidcal_holiday attributes).
// acc = accent colours (light, main, deep) used for the Hebrew date, titles and highlights.
const ZDC_THEMES = [
  { key: "tishabav", on: ["תשעה באב", "תשעה באב נדחה"], acc: ["#e8e4dc", "#b9b1a3", "#8a8175"], edge: "kosel" },
  { key: "yomkippur", on: ["ערב יום כיפור", "יום הכיפורים"], acc: ["#ffffff", "#dfe9ff", "#a9c1ff"], float: { items: ["mote"], colors: ["#ffffff", "#e6eeff"], n: 26, move: "rise" } },
  { key: "roshhashana", on: ["ערב ראש השנה", "ראש השנה א׳", "ראש השנה ב׳", "ראש השנה א׳ וב׳"], acc: ["#fff4d8", "#ffd166", "#e8a33d"], motif: "shofar", float: { items: ["apple", "drop", "pom"], colors: ["#f4b41a"], n: 16, move: "drift" } },
  { key: "simchastorah", on: ["שמיני עצרת", "שמחת תורה", "שמיני עצרת/שמחת תורה"], acc: ["#ffffff", "#ffd54f", "#ff8a65"], motif: "torah", float: { items: ["flag", "confetti", "confetti", "star"], colors: ["#4fc3f7", "#ffd54f", "#ef5350", "#66bb6a", "#ba68c8", "#ffffff"], n: 30, move: "fall" } },
  { key: "sukkos", on: ["ערב סוכות", "סוכות (כל חג)", "סוכות א׳", "סוכות ב׳", "חול המועד סוכות", "שבת חול המועד סוכות", "הושענא רבה"], acc: ["#fff6dc", "#f2c14e", "#c98f2e"], motif: "lulav", edge: "schach", float: { items: ["leaf"], colors: ["#8a9a4a", "#a88f4e", "#6f8a3e"], n: 7, move: "drift" } },
  { key: "chanukah", on: ["חנוכה", "א׳ דחנוכה", "ב׳ דחנוכה", "ג׳ דחנוכה", "ד׳ דחנוכה", "ה׳ דחנוכה", "ו׳ דחנוכה", "ז׳ דחנוכה", "זאת חנוכה", "שבת חנוכה"], acc: ["#ffffff", "#9ecbff", "#e2bf55"], motif: "menorah", float: { items: ["dreidel", "star", "drop"], colors: ["#5c9dff", "#c9d6ff", "#e2bf55"], n: 18, move: "drift" } },
  { key: "tubishvat", on: ["חמשה עשר בשבט"], acc: ["#f5ffe8", "#b5e07a", "#e59ab8"], float: { items: ["flower", "leaf", "grapes", "leaf"], colors: ["#f8bbd0", "#8bc34a", "#7b3f8c", "#aed581"], n: 22, move: "fall" } },
  { key: "fast", on: ["תענית אסתר", "תענית אסתר מוקדם"], acc: ["#e7ecf5", "#aebbd1", "#7f8ca6"] },
  { key: "purim", on: ["פורים", "שושן פורים"], acc: ["#fff1ff", "#ffd54f", "#ff6ec7"], float: { items: ["mask", "confetti", "confetti", "hamantasch", "star"], colors: ["#ff6ec7", "#ffd54f", "#4dd0e1", "#b388ff", "#69f0ae", "#ff8a65"], n: 34, move: "fall" } },
  { key: "pesach", on: ["ערב פסח", "פסח (כל חג)", "פסח א׳", "פסח ב׳", "חול המועד פסח", "שבת חול המועד פסח", "שביעי של פסח", "אחרון של פסח", "שביעי/אחרון של פסח"], acc: ["#fff4e8", "#f3c969", "#d0506b"], edge: "sea", float: { items: ["matzah", "kos"], colors: ["#e8cf9a"], n: 12, move: "drift" } },
  { key: "lagbaomer", on: ["ל\"ג בעומר"], acc: ["#fff3d0", "#ffb347", "#ff6a2b"], edge: "fire", float: { items: ["ember", "ember", "ember", "bow"], colors: ["#ffb347", "#ff7b2b", "#ffd166"], n: 34, move: "rise" } },
  { key: "shavuos", on: ["ערב שבועות", "שבועות א׳", "שבועות ב׳", "שבועות א׳ וב׳"], acc: ["#fbfff2", "#c5e1a5", "#f48fb1"], motif: "luchos", edge: "garland", float: { items: ["flower", "flower", "leaf"], colors: ["#f8bbd0", "#fff59d", "#ce93d8", "#ffffff", "#81c784"], n: 22, move: "fall" } },
  { key: "tubav", on: ["ט\"ו באב"], acc: ["#fff6f8", "#f8bbd0", "#ce93d8"], motif: "moon", float: { items: ["flower", "grapes"], colors: ["#ffffff", "#f8bbd0", "#8e5aa8"], n: 14, move: "drift" } },
  { key: "fast", on: ["צום גדליה", "צום עשרה בטבת", "צום שבעה עשר בתמוז"], acc: ["#e7ecf5", "#aebbd1", "#7f8ca6"] },
];

// Deterministic pseudo-random numbers so a theme's layout is stable between renders.
function zdcRand(seed) {
  let s = 0;
  for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function zdcThemeHtml(theme, day) {
  const rnd = zdcRand(theme.key + day);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const svg = (name, color) => `<svg viewBox="0 0 40 40" style="color:${color}">${ZDC_SYM[name]}</svg>`;
  let html = `<div class="tbg"></div>`;
  const motif = theme.motif && ZDC_MOTIF[theme.motif];
  if (motif) html += `<div class="tmotif">${motif(day)}</div>`;
  if (theme.edge === "schach") {
    // Bamboo poles across the top, covered with palm fronds in dried greens and straw.
    let fronds = "";
    for (let i = 0; i < 34; i++) {
      const color = pick(["#5d7a36", "#6f8a3e", "#8a8f45", "#a08c4a", "#4d6b30", "#b39a55"]);
      fronds += `<i style="left:${((i / 34) * 104 - 2).toFixed(1)}%;top:${(-4 + rnd() * 4).toFixed(1)}%;width:${(50 + rnd() * 34).toFixed(0)}px;transform:rotate(${(rnd() * 70 - 35 + (i % 2 ? 180 : 0)).toFixed(0)}deg)">${svg("frond", color)}</i>`;
    }
    const pole = (y) => `<b class="pole" style="top:${y}%"></b>`;
    let hangs = "";
    for (let i = 0; i < 6; i++) {
      const item = ["pom", "grapes", "esrog", "pom", "grapes", "esrog"][i];
      hangs += `<b class="hang" style="left:${[31, 36, 41, 59, 63.5, 68][i] + rnd() * 3}%;--len:${(5 + rnd() * 6).toFixed(1)}%;animation-delay:-${(rnd() * 6).toFixed(1)}s">${svg(item, "#6b2f7a")}</b>`;
    }
    html += `<div class="tedge schach">${pole(1)}${fronds}${pole(4.5)}${hangs}</div>`;
  } else if (theme.edge === "garland") {
    let flowers = "";
    for (let i = 0; i < 40; i++) flowers += `<i style="left:${(i / 40) * 102 - 1}%;top:${(Math.sin(i / 2.2) * 1.2 + rnd()).toFixed(1)}%;width:${(26 + rnd() * 22).toFixed(0)}px">${svg(i % 3 ? "flower" : "leaf", pick(i % 3 ? ["#f8bbd0", "#fff59d", "#ce93d8", "#ffffff"] : ["#66bb6a", "#81c784"]))}</i>`;
    html += `<div class="tedge garland">${flowers}</div>`;
  } else if (theme.edge === "kosel") {
    let stones = "";
    for (let row = 0; row < 5; row++)
      for (let col = -1; col < 12; col++)
        stones += `<rect x="${col * 150 + (row % 2) * 75}" y="${row * 58}" width="146" height="54" rx="5" fill="hsl(38 ${12 + rnd() * 10}% ${22 + rnd() * 8}%)"/>`;
    html += `<div class="tedge kosel"><svg viewBox="0 0 1600 290" preserveAspectRatio="xMidYMax slice">${stones}</svg></div>`;
  } else if (theme.edge === "sea") {
    html += `<div class="tedge sea"><svg viewBox="0 0 1600 200" preserveAspectRatio="none">
      <path class="w1" d="M0 80 C 200 20 400 140 600 80 S 1000 20 1200 80 S 1500 140 1800 80 V200 H0Z"/>
      <path class="w2" d="M0 120 C 200 60 400 180 600 120 S 1000 60 1200 120 S 1500 180 1800 120 V200 H0Z"/></svg></div>`;
  } else if (theme.edge === "fire") {
    html += `<div class="tedge fire"></div>`;
  }
  const f = theme.float;
  if (f) {
    let fl = "";
    for (let i = 0; i < f.n; i++) {
      const size = (22 + rnd() * 34).toFixed(0);
      const dur = (f.move === "drift" ? 7 + rnd() * 8 : f.move === "rise" ? 14 + rnd() * 14 : 12 + rnd() * 12).toFixed(1);
      const y = f.move === "drift" ? `top:${(8 + rnd() * 84).toFixed(1)}%;` : "";
      fl += `<i class="fl ${f.move}" style="left:${(rnd() * 98).toFixed(1)}%;${y}width:${size}px;height:${size}px;--r:${(rnd() * 720 - 360).toFixed(0)}deg;--x:${(rnd() * 120 - 60).toFixed(0)}px;--o:${(0.45 + rnd() * 0.45).toFixed(2)};animation-duration:${dur}s;animation-delay:-${(rnd() * dur).toFixed(1)}s">${svg(pick(f.items), pick(f.colors))}</i>`;
    }
    html += `<div class="floats">${fl}</div>`;
  }
  return html;
}

// Arc geometry: a half-ellipse (centre 500,300, radii 440 x 240) from t=0 (left) to t=1 (right).
const arcPoint = (t) => {
  const a = Math.PI * (1 - Math.min(1, Math.max(0, t)));
  return { x: 500 + 440 * Math.cos(a), y: 300 - 240 * Math.sin(a), a };
};

const arcPath = (t) => {
  const end = Math.min(1, Math.max(0, t));
  const steps = Math.max(2, Math.ceil(end * 90));
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const p = arcPoint((end * i) / steps);
    d += `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }
  return d;
};

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const pad = (n) => String(n).padStart(2, "0");

// Chance of rain and humidity for one forecast entry, each shown only when above 50%
// (the empty slot keeps every column the same height).
const over50 = (v) => (v != null && !isNaN(v) && v > 50 ? `${Math.round(v)}%` : "");
const rainHum = (f) => {
  const rain = over50(f.precipitation_probability);
  const hum = over50(f.humidity);
  return `<em class="rain">${rain && `☂ ${rain}`}</em><em class="hum">${hum && `💧${hum}`}</em>`;
};

const fmtTime = (d) => (d ? `${d.getHours() % 12 || 12}:${pad(d.getMinutes())}` : "--:--");

const fmtCountdown = (ms) => {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const hms = `${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  return d ? `${d}d ${hms}` : hms;
};

// Update `el` to match `html` in place: only changed text and attributes are
// touched, so icons and animations don't restart (no blinking on sensor updates).
// Attributes of elements marked data-live are left alone; the per-second updater owns them.
function morph(el, html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  morphChildren(el, tpl.content);
}

function morphChildren(from, to) {
  const a = [...from.childNodes];
  const b = [...to.childNodes];
  b.forEach((nb, i) => {
    const na = a[i];
    if (!na) from.appendChild(nb);
    else if (na.nodeType !== nb.nodeType || na.nodeName !== nb.nodeName) from.replaceChild(nb, na);
    else if (na.nodeType === 1) {
      if (!na.hasAttribute("data-live")) {
        for (const { name } of [...na.attributes]) if (!nb.hasAttribute(name)) na.removeAttribute(name);
        for (const { name, value } of nb.attributes) if (na.getAttribute(name) !== value) na.setAttribute(name, value);
      }
      morphChildren(na, nb);
    } else if (na.nodeValue !== nb.nodeValue) na.nodeValue = nb.nodeValue;
  });
  for (let i = b.length; i < a.length; i++) a[i].remove();
}

// Accepts ISO timestamps ("2026-09-24T22:50:00+00:00") and plain times ("6:50 PM" / "18:50").
function parseTime(value, now) {
  if (value == null || ZDC_BAD.has(String(value))) return null;
  const v = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
    const d = new Date(v);
    return isNaN(d) ? null : d;
  }
  const m = v.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/);
  if (!m) return null;
  let h = Number(m[1]);
  if (m[3]) h = (h % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0);
  const d = new Date(now);
  d.setHours(h, Number(m[2]), 0, 0);
  return d;
}

class ZmanDisplayCard extends HTMLElement {
  setConfig(config) {
    this._config = { ...ZDC_DEFAULTS, ...(config || {}) };
    this._dirty = true;
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    this._dirty = true;
    if (first) {
      this._build();
      this._render();
      this._subscribeForecast();
    }
  }

  getCardSize() {
    return 12;
  }

  getGridOptions() {
    return { columns: "full", rows: "auto" };
  }

  connectedCallback() {
    if (!this._timer) this._timer = setInterval(() => this._tick(), 1000);
    if (!this._onResize) {
      this._onResize = () => this._fit();
      window.addEventListener("resize", this._onResize);
      this._ro = new ResizeObserver(this._onResize);
      this._ro.observe(this);
    }
    if (this._hass && !this._unsubFc) this._subscribeForecast();
  }

  disconnectedCallback() {
    clearInterval(this._timer);
    this._timer = null;
    if (this._onResize) {
      window.removeEventListener("resize", this._onResize);
      this._ro?.disconnect();
      this._onResize = null;
    }
    for (const p of this._unsubFc || []) p.then((unsub) => unsub && unsub()).catch(() => {});
    this._unsubFc = null;
  }

  _subscribeForecast() {
    const ent = this._config?.weather;
    const conn = this._hass?.connection;
    if (!ent || !conn || this._unsubFc) return;
    const sub = (type, key) =>
      conn
        .subscribeMessage((msg) => {
          this[key] = msg.forecast || [];
          this._dirty = true;
        }, { type: "weather/subscribe_forecast", entity_id: ent, forecast_type: type })
        .catch(() => null);
    this._unsubFc = [sub("hourly", "_hourly"), sub("daily", "_daily")];
  }

  // ---------------------------------------------------------------- helpers
  _state(id) {
    return id ? this._hass?.states[id] : undefined;
  }

  _val(id) {
    const s = this._state(id);
    return s && !ZDC_BAD.has(s.state) ? s.state : "";
  }

  _on(id) {
    return this._state(id)?.state === "on";
  }

  _isShabbosMode() {
    const cfg = this._config;
    if (cfg.force_mode === "shabbos") return true;
    if (cfg.force_mode === "weekday") return false;
    return [].concat(cfg.shabbos_mode || []).some((id) => this._on(id));
  }

  _zmanim(now) {
    return (this._config.zmanim || [])
      .map((z) => {
        const st = this._state(z.entity);
        const raw = z.attribute ? st?.attributes?.[z.attribute] : st?.state;
        return { name: z.name || st?.attributes?.friendly_name || z.entity, time: parseTime(raw, now) };
      })
      .filter((z) => z.time)
      .sort((a, b) => a.time - b.time);
  }

  // ---------------------------------------------------------------- build
  _build() {
    if (!document.getElementById("zdc-fonts")) {
      const link = document.createElement("link");
      link.id = "zdc-fonts";
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@500;700;900&family=Rubik:wght@300;400;500;700;800&display=swap";
      document.head.appendChild(link);
    }
    const root = this.shadowRoot || this.attachShadow({ mode: "open" });
    let stars = "";
    for (let i = 0; i < 90; i++) {
      const size = Math.random() < 0.15 ? 3 : Math.random() < 0.5 ? 2 : 1;
      stars += `<i style="left:${(Math.random() * 100).toFixed(2)}%;top:${(Math.random() * 70).toFixed(2)}%;width:${size}px;height:${size}px;animation-delay:${(Math.random() * 6).toFixed(2)}s;animation-duration:${(3 + Math.random() * 5).toFixed(2)}s"></i>`;
    }
    root.innerHTML = `<style>${ZDC_STYLE}</style>
      <div class="stage" id="stage">
        <div class="sky">
          <div class="layer night"></div><div class="layer dawn"></div>
          <div class="layer day"></div><div class="layer dusk"></div>
          <div class="layer candle"></div>
          <div class="theme" id="theme"></div>
          <div class="stars">${stars}<b class="shoot"></b></div>
          <div class="haze"></div>
        </div>
        <div class="content">
          <header>
            <div class="clock">
              <div class="hm"><span id="hm">--:--</span><span class="ss" id="ss">00</span></div>
              <div class="gdate" id="gdate"></div>
            </div>
            <div class="alertwrap" id="alerts"></div>
            <div class="hebrew" id="hebrew"></div>
          </header>
          <main id="main"></main>
          <footer id="foot"></footer>
        </div>
      </div>`;
    this._el = {
      stage: root.getElementById("stage"),
      hm: root.getElementById("hm"),
      ss: root.getElementById("ss"),
      gdate: root.getElementById("gdate"),
      hebrew: root.getElementById("hebrew"),
      alerts: root.getElementById("alerts"),
      main: root.getElementById("main"),
      theme: root.getElementById("theme"),
      foot: root.getElementById("foot"),
    };
    this._html = {};
  }

  // Lay the stage out at a fixed design width and scale it to exactly fill the
  // space the card has (card width x remaining window height), so it never scrolls.
  _fit(force = false) {
    const stage = this._el?.stage;
    const w = this.clientWidth;
    if (!stage || !w) return;
    const top = Math.max(0, this.getBoundingClientRect().top + window.scrollY);
    const h = Number(this._config.height) || Math.max(320, window.innerHeight - top);
    const key = `${w}x${h}`;
    if (key === this._fitKey && !force) return;
    this._fitKey = key;
    const aspect = w / h;
    const dw = aspect < 1 ? 900 : 1600;
    this.style.height = `${h}px`;
    stage.style.width = `${dw}px`;
    stage.style.height = `${dw / aspect}px`;
    stage.style.setProperty("--H", `${dw / aspect}px`);
    // zoom (not transform: scale) so text and icons are laid out at the real pixel size and stay sharp.
    stage.style.zoom = w / dw;
    stage.classList.toggle("portrait", aspect < 1);
    this._fitMain();
  }

  // Size the middle section (the Shabbos schedule) to fill the space it has:
  // find the largest zoom (0.4x-1.4x) at which it still fits. Zoom re-flows the
  // text, so growing it wraps rather than overflowing sideways.
  _fitMain() {
    const main = this._el?.main;
    const child = main?.firstElementChild;
    if (!child || child.classList.contains("arcwrap")) return;
    const box = main.getBoundingClientRect();
    const fits = (z) => {
      child.style.zoom = z;
      const r = child.getBoundingClientRect();
      const hero = child.querySelector(".shab-hero");
      return r.height <= box.height + 1 && r.width <= box.width + 1 && (!hero || hero.scrollWidth <= hero.clientWidth + 1);
    };
    let lo = 0.4;
    let hi = 1.4;
    if (fits(hi)) lo = hi;
    else for (let i = 0; i < 7; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) lo = mid;
      else hi = mid;
    }
    child.style.zoom = lo.toFixed(3);
  }

  _set(key, html) {
    if (this._html[key] === html) return false;
    this._html[key] = html;
    morph(this._el[key], html);
    return true;
  }

  // ---------------------------------------------------------------- render
  _tick() {
    if (!this._el) return;
    const now = new Date();
    if (this._dirty || now.getSeconds() === 0) this._render();
    else this._fit();
    this._el.hm.textContent = `${now.getHours() % 12 || 12}:${pad(now.getMinutes())}`;
    this._el.ss.textContent = pad(now.getSeconds());
    this._updateLive(now);
  }

  _render() {
    if (!this._el || !this._hass) return;
    this._dirty = false;
    const now = new Date();
    const shabbos = this._isShabbosMode();
    const zmanim = this._zmanim(now);

    const portrait = this._el.stage.classList.contains("portrait");
    const th = this._theme();
    this._el.stage.className = `stage ${shabbos ? "shabbos" : ""} phase-${this._phase(now, zmanim)}${portrait ? " portrait" : ""}${th ? ` themed theme-${th.theme.key}` : ""}`;
    const themeId = th ? `${th.theme.key}${th.day}` : "";
    if (themeId !== this._themeId) {
      this._themeId = themeId;
      this._set("theme", th ? zdcThemeHtml(th.theme, th.day) : "");
      ["--a1", "--a2", "--a3"].forEach((v, i) => (th ? this._el.stage.style.setProperty(v, th.theme.acc[i]) : this._el.stage.style.removeProperty(v)));
    }
    this._el.gdate.textContent = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

    this._set("hebrew", this._hebrewHtml(now));
    this._set("alerts", this._alertsHtml());
    const mainChanged = this._set("main", shabbos ? this._shabbosHtml(now) : this._arcHtml(now, zmanim));
    this._set("foot", this._footHtml(now));
    this._fit(mainChanged);
    this._updateLive(now);
  }

  _phase(now, zmanim) {
    if (!zmanim.length) {
      const h = now.getHours();
      return h < 6 || h >= 20 ? "night" : h < 8 ? "dawn" : h < 18 ? "day" : "dusk";
    }
    const first = zmanim[0].time;
    const last = zmanim[zmanim.length - 1].time;
    const len = last - first;
    if (now < first || now > last) return "night";
    const t = (now - first) / len;
    return t < 0.12 ? "dawn" : t < 0.86 ? "day" : "dusk";
  }

  _hebrewHtml(now) {
    const c = this._config;
    const pills = [];
    const holiday = this._val(c.holiday);
    if (holiday) pills.push(["✨", holiday, "gold"]);
    if (this._on(c.rosh_chodesh)) pills.push(["🌒", "ראש חודש", "sky"]);
    if (this._on(c.shabbos_mevorchim)) pills.push(["🌙", "שבת מברכים", "sky"]);
    if (this._on(c.kiddush_levana)) pills.push(["🌕", "קידוש לבנה", "moon"]);
    const upcoming = this._val(c.upcoming_holiday).split(",")[0].trim();
    if (this._on(c.upcoming_yomtov) && upcoming) pills.push(["⏳", `בקרוב: ${upcoming}`, "mint"]);
    const daf = this._val(c.daf_yomi);
    return `
      <div class="hdate">${esc(this._val(c.hebrew_date))}</div>
      ${this._shabbosName() ? `<div class="hparsha">${esc(this._shabbosName())}</div>` : ""}
      <div class="hday">${ZDC_HEB_DAYS[now.getDay()]}${daf ? ` <span class="dot">•</span> דף היומי <b>${esc(daf)}</b>` : ""}</div>
      ${pills.length ? `<div class="pills">${pills.map(([i, t, k]) => `<span class="pill ${k}">${i} ${esc(t)}</span>`).join("")}</div>` : ""}`;
  }

  // "פרשת …" when there is one; otherwise the Yom Tov that falls on this Shabbos.
  _shabbosName() {
    const c = this._config;
    const parsha = this._val(c.parsha) || this._val(c.parsha_fallback);
    if (parsha) return `פרשת ${parsha}`;
    if (!this._on(c.upcoming_yomtov) && !this._val(c.holiday)) return "";
    const yt = this._val(c.holiday) || this._val(c.upcoming_holiday);
    const name = yt
      .split(",")
      .map((x) => x.replace(/\(.*?\)/g, "").trim())
      .find((x) => x && !x.startsWith("ערב"));
    return name ? `שבת ${name}` : "";
  }

  // Title for the candle-lighting panel, from YidCal (not the shul schedule):
  // today's holiday, else this week's parsha, else the upcoming Yom Tov.
  _shabbosTitle() {
    const c = this._config;
    const firstName = (list) =>
      list
        .split(",")
        .map((x) => x.replace(/\(.*?\)/g, "").trim())
        .find((x) => x && !x.startsWith("ערב"));
    const holiday = firstName(this._val(c.holiday));
    if (holiday) return holiday;
    const parsha = this._val(c.parsha) || this._val(c.parsha_fallback);
    if (parsha) return `שבת פרשת ${parsha}`;
    const upcoming = this._on(c.upcoming_yomtov) && firstName(this._val(c.upcoming_holiday));
    return upcoming || "שבת קודש";
  }

  // Today's holiday theme from YidCal's holiday flags (config `theme` forces one,
  // `holiday_themes: false` turns them off). For Chanukah, day = candles lit.
  _theme() {
    const c = this._config;
    if (c.holiday_themes === false) return null;
    const attrs = this._state(c.holiday)?.attributes || {};
    const isOn = (k) => String(attrs[k]).toLowerCase() === "true";
    const theme = c.theme ? ZDC_THEMES.find((t) => t.key === c.theme) : ZDC_THEMES.find((t) => t.on.some(isOn));
    if (!theme) return null;
    let day = 0;
    if (theme.key === "chanukah") {
      const nights = ["א׳ דחנוכה", "ב׳ דחנוכה", "ג׳ דחנוכה", "ד׳ דחנוכה", "ה׳ דחנוכה", "ו׳ דחנוכה", "ז׳ דחנוכה", "זאת חנוכה"];
      day = Number(c.theme_day) || nights.findIndex(isOn) + 1 || 1;
    }
    return { theme, day };
  }

  _alertsHtml() {
    const items = (this._config.alerts || []).filter((a) => {
      const st = this._state(a.entity);
      if (!st) return false;
      if (a.state !== undefined) return [].concat(a.state).map(String).includes(st.state);
      if (a.state_not !== undefined) return ![].concat(a.state_not).map(String).includes(st.state) && !ZDC_BAD.has(st.state);
      return st.state === "on";
    });
    const wa = this._val(this._config.weather_alert);
    if (wa && wa !== "off") items.unshift({ icon: "mdi:alert", name: wa, color: "red" });
    if (!items.length) return "";
    return `<div class="alerts">${items
      .map((a) => {
        const extra = a.value_entity ? this._val(a.value_entity) : a.show_state ? this._val(a.entity) : "";
        const vs = a.value_entity ? this._state(a.value_entity) : null;
        const unit = vs?.attributes?.unit_of_measurement || "";
        let value = extra ? `${extra}${unit ? " " + unit : ""}` : "";
        // A timestamp (e.g. the washer's finish time) becomes a live countdown.
        const end = vs?.attributes?.device_class === "timestamp" && extra ? new Date(extra) : null;
        if (end && !isNaN(end)) {
          if (end <= new Date()) value = "";
          else return `<span class="alert ${esc(a.color || "amber")}"><ha-icon icon="${esc(a.icon || "mdi:alert-circle")}"></ha-icon>${esc(a.name || "")} <b class="cd" data-t="${end.getTime()}">${fmtCountdown(end - new Date()).replace(/^00:/, "")}</b></span>`;
        } else if (unit === "min" && !isNaN(parseFloat(extra))) {
          const m = Math.round(parseFloat(extra));
          value = `${Math.floor(m / 60)}:${pad(m % 60)}`;
        }
        return `<span class="alert ${esc(a.color || "amber")}"><ha-icon icon="${esc(a.icon || "mdi:alert-circle")}"></ha-icon>${esc(a.name || "")}${value ? ` <b>${esc(value)}</b>` : ""}</span>`;
      })
      .join("")}</div>`;
  }

  _arcHtml(now, zmanim) {
    if (zmanim.length < 2) return `<div class="empty">Configure at least two zmanim to draw the day arc.</div>`;
    const first = zmanim[0].time;
    const len = zmanim[zmanim.length - 1].time - first;
    const next = zmanim.find((z) => z.time > now);
    let prev = null;
    const marks = zmanim
      .map((z) => {
        const p = arcPoint((z.time - first) / len);
        const dx = Math.cos(p.a);
        const dy = -Math.sin(p.a);
        // Label outside the arc; if it would collide with the previous label, flip it inside.
        const place = (o) => [p.x + dx * (o + 50 * Math.abs(dx) * Math.sign(o)), p.y + dy * o - 8];
        let off = 38;
        let [lx, ly] = place(off);
        if (prev && Math.hypot(lx - prev.x, ly - prev.y) < 120) {
          off = -80;
          [lx, ly] = place(off);
        }
        prev = { x: lx, y: ly };
        const past = z.time <= now;
        const isNext = next && z === next;
        return `<g class="mark ${past ? "past" : ""} ${isNext ? "next" : ""}">
          <line x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${(p.x + dx * (off - 16 * Math.sign(off))).toFixed(1)}" y2="${(p.y + dy * (off - 16 * Math.sign(off))).toFixed(1)}" class="lead"/>
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${isNext ? 9 : 6}"></circle>
          <text x="${lx.toFixed(1)}" y="${(ly - 14).toFixed(1)}" class="lname">${esc(z.name)}</text>
          <text x="${lx.toFixed(1)}" y="${(ly + 12).toFixed(1)}" class="ltime">${fmtTime(z.time)}</text>
        </g>`;
      })
      .join("");
    return `
      <div class="arcwrap">
        <svg viewBox="-110 -20 1220 350" class="arc" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="zdcProg" x1="0" x2="1">
              <stop offset="0" stop-color="#ff9a5a"/><stop offset=".5" stop-color="#ffd27a"/><stop offset="1" stop-color="#ff7b54"/>
            </linearGradient>
            <radialGradient id="zdcSun"><stop offset="0" stop-color="#fffbe8"/><stop offset=".45" stop-color="#ffd76a"/><stop offset="1" stop-color="#ff9b3d"/></radialGradient>
            <filter id="zdcGlow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="10"/></filter>
          </defs>
          <line x1="20" y1="300" x2="980" y2="300" class="horizon"/>
          <path d="${arcPath(1)}" class="track"/>
          <path id="prog" d="M60 300" class="prog" data-live/>
          ${marks}
          <g id="sun" class="sun" data-live>
            <circle r="46" class="sunglow" filter="url(#zdcGlow)"></circle>
            <g class="rays">${Array.from({ length: 12 }, (_, i) => `<rect x="-2" y="-40" width="4" height="12" rx="2" transform="rotate(${i * 30})"/>`).join("")}</g>
            <circle r="20" fill="url(#zdcSun)"></circle>
          </g>
          <g id="moon" class="moon" transform="translate(500 110)" data-live>
            <circle r="40" class="moonglow" filter="url(#zdcGlow)"></circle>
            <path d="M 12 -26 A 28 28 0 1 0 12 26 A 22 22 0 1 1 12 -26 Z"></path>
          </g>
        </svg>
        <div class="nextbox">
          ${next
            ? `<div class="nlabel">הזמן הבא</div><div class="nname">${esc(next.name)}</div>
               <div class="ncount" id="ncd" data-t="${next.time.getTime()}">--:--:--</div>
               <div class="nat">at ${fmtTime(next.time)}</div>`
            : `<div class="nname">לילה טוב</div><div class="nat">${esc(zmanim[zmanim.length - 1].name)} ${fmtTime(zmanim[zmanim.length - 1].time)}</div>`}
        </div>
      </div>`;
  }

  _shabbosHtml(now) {
    const c = this._config;
    const sched = this._state(c.shul_schedule);
    const title = this._shabbosTitle();
    const erev = parseTime(this._val(c.candle_lighting), now);
    const motzi = parseTime(this._val(c.havdalah), now);
    const target = erev && erev > now ? ["הדלקת נרות בעוד", erev] : motzi && motzi > now ? ["מוצאי בעוד", motzi] : null;
    const days = [...(sched?.attributes?.days || [])].sort((a, b) => (a.day_order ?? 0) - (b.day_order ?? 0));
    const flame = (x) => `<g transform="translate(${x} 0)">
        <ellipse cx="0" cy="40" rx="46" ry="60" class="halo"/>
        <path class="flame" d="M0 0 C 14 18 16 34 0 52 C -16 34 -14 18 0 0 Z"/>
        <path class="flame core" d="M0 22 C 6 30 6 40 0 50 C -6 40 -6 30 0 22 Z"/>
        <rect x="-3" y="48" width="6" height="10" rx="2" class="wick"/>
        <rect x="-20" y="58" width="40" height="150" rx="8" class="wax"/>
        <rect x="-32" y="206" width="64" height="16" rx="6" class="holder"/>
      </g>`;
    return `
      <div class="shab" data-live>
        <div class="shab-hero">
          <svg viewBox="0 0 300 230" class="candles">${flame(95)}${flame(205)}</svg>
          <div class="stitle">${esc(title)}</div>
          <div class="stimes">
            <div class="st"><span>🕯️ הדלקת נרות</span><b>${fmtTime(erev)}</b><small>${erev ? ZDC_HEB_DAYS[erev.getDay()] : ""}</small></div>
            <div class="st"><span>🍷 מוצאי</span><b>${fmtTime(motzi)}</b><small>${motzi ? ZDC_HEB_DAYS[motzi.getDay()] : ""}</small></div>
          </div>
          ${target ? `<div class="scd"><span>${target[0]}</span><b id="scd" data-t="${target[1].getTime()}">--:--:--</b></div>` : ""}
        </div>
        <div class="sched">
          ${days.length
            ? days
                .map(
                  (d) => `<section class="sday">
                    <h3>${esc(d.day_label)}</h3>
                    ${(d.zmanim || [])
                      .map(
                        (z) => `<div class="srow"><span class="sname">${esc(z.name)}${z.notes ? `<small>${esc(z.notes)}</small>` : ""}</span><b>${esc(String(z.time || "").replace(/\s*[AP]M$/i, ""))}</b></div>`
                      )
                      .join("")}
                  </section>`
                )
                .join("")
            : `<div class="empty">אין זמנים</div>`}
        </div>
      </div>`;
  }

  _footHtml(now) {
    const c = this._config;
    const tiles = [];

    const w = this._state(c.weather);
    if (w) {
      const a = w.attributes || {};
      const icon = (cond) => ZDC_WEATHER_ICONS[cond] || "mdi:weather-cloudy";
      const hours = (this._hourly || []).filter((f) => new Date(f.datetime) > now).slice(0, c.forecast_hours);
      const days = (this._daily || []).slice(0, c.forecast_days);
      const today = days[0];
      tiles.push(`<div class="tile weather">
        <div class="wnow">
          <ha-icon icon="${icon(w.state)}"></ha-icon>
          <div><div class="wtemp">${a.temperature != null ? Math.round(a.temperature) : "--"}°</div>
          <div class="wcond">${esc(String(w.state).replace("partlycloudy", "partly cloudy").replace(/-/g, " "))}${a.humidity != null ? ` · 💧${Math.round(a.humidity)}%` : ""}</div></div>
          ${today ? `<div class="whilo"><span>▲ ${Math.round(today.temperature)}°</span><span>▼ ${Math.round(today.templow ?? today.temperature)}°</span></div>` : ""}
        </div>
        ${hours.length ? `<div class="hours">${hours
          .map((f) => {
            const d = new Date(f.datetime);
            return `<div class="hr"><small>${d.getHours() % 12 || 12}${d.getHours() < 12 ? "a" : "p"}</small><ha-icon icon="${icon(f.condition)}"></ha-icon><b>${Math.round(f.temperature)}°</b>${rainHum(f)}</div>`;
          })
          .join("")}</div>` : ""}
        ${days.length ? `<div class="days">${days
          .map((f, i) => {
            const d = new Date(f.datetime);
            const low = f.templow ?? f.temperature;
            return `<div class="dy"><span class="dn">${i === 0 ? "Today" : ZDC_SHORT_DAYS[d.getDay()]}</span><ha-icon icon="${icon(f.condition)}"></ha-icon>
              <span class="dhi">${Math.round(f.temperature)}°</span>
              <span class="bar"></span>
              <span class="dlo">${Math.round(low)}°</span>
              ${rainHum(f)}</div>`;
          })
          .join("")}</div>` : ""}
        ${this._tickerHtml(hours, days, icon)}
      </div>`);
    }

    if ((c.rooms || []).length) {
      const cols = Math.ceil(c.rooms.length / (c.rooms.length > 4 ? 2 : 1));
      tiles.push(`<div class="tile rooms" style="--cols:${cols};--n:${c.rooms.length}">${c.rooms
        .map((r) => {
          const t = parseFloat(this._val(r.entity));
          const h = parseFloat(this._val(r.humidity));
          const cls = isNaN(t) ? "na" : t < 66 ? "cold" : t < 73 ? "ok" : t < 77 ? "warm" : "hot";
          let mode = "";
          if (r.climate) {
            const cl = this._state(r.climate);
            const st = cl?.state;
            const modeIcons = { cool: "❄️", heat: "🔥", dry: "💨", fan_only: "🌀", auto: "♻️", heat_cool: "♻️" };
            mode = !cl || ZDC_BAD.has(st)
              ? `<em class="mode off">offline</em>`
              : st === "off"
                ? `<em class="mode off">off</em>`
                : `<em class="mode on">${modeIcons[st] || ""} ${cl.attributes?.temperature != null ? Math.round(cl.attributes.temperature) + "°" : esc(st)}</em>`;
          }
          return `<div class="room ${cls}"><ha-icon icon="${esc(r.icon || "mdi:thermometer")}"></ha-icon><span>${esc(r.name)}</span><b>${isNaN(t) ? "--" : Math.round(t)}°</b>${isNaN(h) ? "" : `<small>${Math.round(h)}%</small>`}${mode}</div>`;
        })
        .join("")}</div>`);
    }

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const events = (c.events || [])
      .map((e) => {
        const [y, m, d] = String(e.date).split("-").map(Number);
        return { ...e, days: Math.round((new Date(y, m - 1, d) - today) / 86400000), when: new Date(y, m - 1, d) };
      })
      .filter((e) => e.days >= 0)
      .sort((a, b) => a.days - b.days)
      .slice(0, c.events_max || undefined);
    if (events.length) {
      tiles.push(`<div class="tile events">${events
        .map(
          (e, i) => `<div class="ev c${i % 4}"><div class="evn">${e.days === 0 ? "🎉" : e.days}<small>${e.days === 0 ? "TODAY" : e.days === 1 ? "DAY" : "DAYS"}</small></div>
            <div class="evt"><b>${esc(e.icon || "")} ${esc(e.name)}</b><small>${e.when.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</small></div></div>`
        )
        .join("")}</div>`);
    }
    return `<div class="tiles n${tiles.length}">${tiles.join("")}</div>`;
  }

  // Shabbos-mode forecast: two fixed rows (hourly on top, daily below), all visible at once.
  _tickerHtml(hours, days, icon) {
    if (!hours.length && !days.length) return "";
    const row = (label, items) =>
      items.length ? `<div class="frow"><span class="tlabel">${label}</span><div class="fitems" style="--n:${items.length}">${items.join("")}</div></div>` : "";
    const hourItems = hours.map((f) => {
      const d = new Date(f.datetime);
      return `<span class="ti"><small>${d.getHours() % 12 || 12}${d.getHours() < 12 ? "a" : "p"}</small><ha-icon icon="${icon(f.condition)}"></ha-icon><b>${Math.round(f.temperature)}°</b>${rainHum(f)}</span>`;
    });
    const dayItems = days.map((f, i) => {
      const d = new Date(f.datetime);
      return `<span class="ti"><small>${i === 0 ? "Today" : ZDC_SHORT_DAYS[d.getDay()]}</small><ha-icon icon="${icon(f.condition)}"></ha-icon><b>${Math.round(f.temperature)}°<i>${Math.round(f.templow ?? f.temperature)}°</i></b>${rainHum(f)}</span>`;
    });
    return `<div class="ticker">${row("Hourly", hourItems)}${row("7 days", dayItems)}</div>`;
  }

  // Per-second updates that must not re-create DOM (keeps animations smooth).
  _updateLive(now) {
    const root = this.shadowRoot;
    if (!root) return;
    for (const id of ["ncd", "scd"]) {
      const el = root.getElementById(id);
      if (el) el.textContent = fmtCountdown(Number(el.dataset.t) - now);
    }
    for (const el of root.querySelectorAll(".cd")) {
      const left = Number(el.dataset.t) - now;
      if (left <= 0) this._dirty = true;
      el.textContent = fmtCountdown(left).replace(/^00:/, "");
    }
    const sun = root.getElementById("sun");
    if (!sun) return;
    const zmanim = this._zmanim(now);
    if (zmanim.length < 2) return;
    const first = zmanim[0].time;
    const t = (now - first) / (zmanim[zmanim.length - 1].time - first);
    const day = t >= 0 && t <= 1;
    const p = arcPoint(t);
    sun.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    sun.style.opacity = day ? 1 : 0;
    root.getElementById("moon").style.opacity = day ? 0 : 1;
    root.getElementById("prog").setAttribute("d", arcPath(t));
  }
}

const ZDC_STYLE = `
:host { display:block; position:relative; overflow:hidden; }
.stage { --a1:#fff3d6; --a2:#ffc46b; --a3:#ff9a5a; position:absolute; top:0; left:0; overflow:hidden; transform-origin:0 0; color:#f7f1e6;
  font-family:'Rubik', 'Heebo', system-ui, sans-serif; border-radius:var(--ha-card-border-radius, 0); }
.sky, .layer, .stars, .haze { position:absolute; inset:0; }
.layer { opacity:0; transition:opacity 20s ease; }
.night { background:radial-gradient(120% 90% at 50% 110%, #1c2150 0%, #0b0f2a 55%, #04060f 100%); }
.dawn { background:linear-gradient(180deg, #1b1d4d 0%, #5b3a78 40%, #d9737a 75%, #ffb36b 100%); }
.day { background:linear-gradient(180deg, #0b2a5c 0%, #1f5596 55%, #3f7fbf 100%); }
.dusk { background:linear-gradient(180deg, #1a1440 0%, #4b2268 35%, #b4466a 70%, #f2945a 100%); }
.candle { background:radial-gradient(90% 70% at 30% 35%, rgba(255,170,70,.30), transparent 60%),
  radial-gradient(120% 120% at 50% 120%, #2a1406 0%, #140a04 55%, #070302 100%); }
.phase-night .night, .phase-dawn .dawn, .phase-day .day, .phase-dusk .dusk { opacity:1; }
.shabbos .layer { opacity:0; } .shabbos .candle { opacity:1; }
.stars { opacity:0; transition:opacity 20s ease; }
.phase-night .stars { opacity:1; } .phase-dawn .stars, .phase-dusk .stars { opacity:.35; } .shabbos .stars { opacity:.45; }
.stars i { position:absolute; border-radius:50%; background:#fff; box-shadow:0 0 6px #fff; animation:twinkle 4s ease-in-out infinite; }
@keyframes twinkle { 0%,100% { opacity:.25; } 50% { opacity:1; } }
.shoot { position:absolute; top:12%; left:70%; width:140px; height:2px; border-radius:2px;
  background:linear-gradient(90deg, #fff, transparent); opacity:0; transform:rotate(-20deg); animation:shoot 17s linear infinite 4s; }
@keyframes shoot { 0%,92% { opacity:0; transform:translate(0,0) rotate(-20deg); } 93% { opacity:1; } 100% { opacity:0; transform:translate(-420px,150px) rotate(-20deg); } }
.haze { background:radial-gradient(60% 40% at 50% 100%, rgba(255,190,120,.10), transparent 70%); }

.content { position:relative; z-index:1; display:flex; flex-direction:column; gap:12px; padding:30px 34px; height:100%; box-sizing:border-box; }
header { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; flex-wrap:wrap; }
.hm { font-weight:300; font-size:200px; line-height:.9; letter-spacing:-3px; text-shadow:0 0 40px rgba(255,210,150,.35); font-variant-numeric:tabular-nums; }
.ss { font-size:.32em; font-weight:500; letter-spacing:0; margin-left:10px; color:var(--a2); vertical-align:top; display:inline-block; margin-top:.35em; }
.gdate { margin-top:6px; font-size:26px; color:rgba(247,241,230,.75); letter-spacing:.5px; }
.hebrew { direction:rtl; text-align:right; }
.hdate { font-family:'Frank Ruhl Libre', serif; font-weight:900; font-size:70px; line-height:1.05;
  background:linear-gradient(180deg, var(--a1), var(--a2) 60%, var(--a3)); -webkit-background-clip:text; background-clip:text; color:transparent;
  filter:drop-shadow(0 0 18px rgba(255,170,80,.35)); }
.hparsha { margin-top:4px; font-family:'Frank Ruhl Libre', serif; font-weight:700; font-size:42px; color:#e6c7ff; text-shadow:0 0 18px rgba(200,150,255,.45); }
.hday { margin-top:6px; font-size:24px; color:rgba(247,241,230,.8); }
.hday b { color:#e6c7ff; font-weight:600; } .dot { color:var(--a2); margin:0 6px; }
.pills { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; justify-content:flex-start; }
.pill { padding:5px 14px; border-radius:999px; font-size:17px; font-weight:500;
  background:rgba(20,20,36,.6); border:1px solid rgba(255,255,255,.18); }
.pill.gold { color:#ffd88a; border-color:rgba(255,200,110,.5); box-shadow:0 0 14px rgba(255,190,90,.25); }
.pill.violet { color:#e6c7ff; border-color:rgba(206,160,255,.45); }
.pill.sky { color:#a8ecff; border-color:rgba(130,220,255,.45); }
.pill.moon { color:#fff6b0; border-color:rgba(255,245,160,.45); box-shadow:0 0 14px rgba(255,245,160,.2); }
.pill.mint { color:#b8f5c8; border-color:rgba(150,240,180,.45); }

.alertwrap { flex:1; align-self:center; }
.alerts { display:flex; flex-wrap:wrap; gap:10px; justify-content:center; }
.alert { display:inline-flex; align-items:center; gap:8px; padding:8px 16px; border-radius:14px; font-size:18px;
  background:rgba(20,16,30,.8); border:1px solid; }
.alert .cd { font-variant-numeric:tabular-nums; }
.alert ha-icon { --mdc-icon-size:22px; }
.alert.red { color:#ff8a80; border-color:rgba(255,120,110,.6); } .alert.amber { color:#ffd180; border-color:rgba(255,200,110,.55); }
.alert.blue { color:#8fd3ff; border-color:rgba(120,200,255,.55); } .alert.pink { color:#ff9ec7; border-color:rgba(255,150,200,.55); }

footer { position:relative; z-index:2; }
main { flex:1; display:flex; align-items:center; justify-content:center; min-height:0; overflow:hidden; container-type:size; }
main > * { flex:none; }
.arcwrap { position:relative; width:min(100cqw, calc(100cqh * 1220 / 350)); aspect-ratio:1220 / 350; container-type:inline-size; }
.arc { width:100%; height:100%; display:block; overflow:visible; }
.horizon { stroke:rgba(255,255,255,.18); stroke-width:1.5; }
.track { fill:none; stroke:rgba(255,255,255,.28); stroke-width:3; stroke-dasharray:2 10; stroke-linecap:round; }
.prog { fill:none; stroke:url(#zdcProg); stroke-width:6; stroke-linecap:round; filter:drop-shadow(0 0 8px rgba(255,180,90,.7)); }
.lead { stroke:rgba(255,255,255,.18); stroke-width:1.5; }
.mark circle { fill:#1a1430; stroke:#ffd27a; stroke-width:3; }
.mark.past circle { fill:#ffd27a; }
.mark.next circle { fill:#fff; stroke:#ff9a5a; stroke-width:4; animation:beat 1.6s ease-in-out infinite; transform-box:fill-box; transform-origin:center; }
@keyframes beat { 0%,100% { transform:scale(1); } 50% { transform:scale(1.35); } }
.mark text { text-anchor:middle; fill:#f7f1e6; }
.lname { font-family:'Frank Ruhl Libre', serif; font-size:21px; font-weight:700; direction:rtl; unicode-bidi:plaintext; }
.ltime { font-size:22px; font-weight:500; fill:#ffd27a !important; }
.mark.past text { opacity:.45; }
.mark.next .lname { fill:#fff; } .mark.next .ltime { fill:#ffb36b !important; font-weight:800; }
.sun { transition:transform 1s linear, opacity 3s; }
.sunglow { fill:#ffb347; opacity:.75; }
.rays { fill:#ffd76a; animation:spin 30s linear infinite; transform-box:view-box; transform-origin:0 0; }
@keyframes spin { to { transform:rotate(360deg); } }
.moon { transition:opacity 3s; opacity:0; } .moon path { fill:#fff4c9; } .moonglow { fill:#fff4c9; opacity:.35; }
.nextbox { position:absolute; left:50%; bottom:2%; transform:translateX(-50%); text-align:center; direction:rtl; width:60%; }
.nlabel { font-size:1.15cqw; font-weight:500; color:var(--a2); }
.nname { font-family:'Frank Ruhl Libre', serif; font-weight:900; font-size:3.4cqw; line-height:1.1; }
.ncount { direction:ltr; font-variant-numeric:tabular-nums; font-weight:300; font-size:3cqw; letter-spacing:2px; color:#fff; text-shadow:0 0 24px rgba(255,190,110,.6); }
.nat { direction:ltr; color:rgba(247,241,230,.6); font-size:1.05cqw; }

.shab { width:100%; transform-origin:center center; box-sizing:border-box; display:grid; grid-template-columns:minmax(300px, 0.75fr) 1.9fr; gap:28px; align-items:center; direction:rtl; }
.shab-hero { text-align:center; }
.candles { width:min(200px, 55%); height:auto; overflow:visible; }
.halo { fill:rgba(255,170,70,.28); filter:blur(14px); animation:halo 3s ease-in-out infinite; transform-box:fill-box; transform-origin:center; }
.flame { fill:#ffb347; transform-box:fill-box; transform-origin:50% 100%; animation:flicker 1.3s ease-in-out infinite alternate; filter:drop-shadow(0 0 10px #ff9a3d); }
.flame.core { fill:#fff6d6; animation-duration:.9s; }
.wick { fill:#3a2a1a; } .wax { fill:#f5ecdc; } .holder { fill:#c9a24a; }
@keyframes flicker { 0% { transform:scale(1,1) skewX(0deg); } 30% { transform:scale(.96,1.06) skewX(2deg); } 60% { transform:scale(1.03,.95) skewX(-2deg); } 100% { transform:scale(.98,1.04) skewX(1deg); } }
@keyframes halo { 0%,100% { opacity:.7; transform:scale(1); } 50% { opacity:1; transform:scale(1.12); } }
.stitle { font-family:'Frank Ruhl Libre', serif; font-weight:900; font-size:74px; line-height:1.05; margin-top:6px;
  background:linear-gradient(180deg, var(--a1), var(--a2) 55%, var(--a3)); -webkit-background-clip:text; background-clip:text; color:transparent;
  filter:drop-shadow(0 0 22px rgba(255,160,60,.45)); }
.stimes { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:18px; }
.st { padding:12px 6px; border-radius:22px; background:rgba(40,24,10,.75); border:1px solid rgba(255,190,110,.35); display:flex; flex-direction:column; gap:2px; }
.st span { font-size:20px; color:rgba(255,236,210,.85); }
.st b { direction:ltr; font-size:50px; letter-spacing:-1px; font-weight:700; color:#fff3e0; line-height:1.05; }
.st small { color:rgba(255,236,210,.6); font-size:16px; }
.scd { margin-top:14px; max-width:100%; box-sizing:border-box; flex-wrap:wrap; justify-content:center; display:inline-flex; align-items:baseline; column-gap:10px; padding:8px 18px; border-radius:999px;
  background:linear-gradient(90deg, rgba(255,180,90,.25), rgba(255,120,80,.15)); border:1px solid rgba(255,180,90,.5); box-shadow:0 0 30px rgba(255,150,70,.3); }
.scd span { color:#ffd9a8; font-size:18px; white-space:nowrap; }
.scd b { direction:ltr; font-variant-numeric:tabular-nums; font-size:32px; font-weight:500; color:#fff; white-space:nowrap; }
.sched { column-width:280px; column-gap:14px; }
.sday { break-inside:avoid; margin-bottom:14px; padding:14px 18px 10px; border-radius:22px; background:rgba(25,14,6,.8); border:1px solid rgba(255,190,110,.25); }
.sday h3 { margin:0 0 8px; font-family:'Frank Ruhl Libre', serif; font-size:26px; color:var(--a2); border-bottom:1px solid rgba(255,190,110,.25); padding-bottom:6px; }
.srow { display:flex; justify-content:space-between; align-items:baseline; gap:10px; padding:5px 0; border-bottom:1px dashed rgba(255,255,255,.07); }
.srow:last-child { border-bottom:0; }
.sname { font-size:18px; display:flex; flex-direction:column; }
.sname small { color:rgba(255,236,210,.5); font-size:.78em; }
.srow b { direction:ltr; font-variant-numeric:tabular-nums; color:#fff3e0; font-size:20px; white-space:nowrap; }
/* Shabbos: compact header, the schedule in the middle, and a large bottom row
   with weather (scrolling hourly + 7-day strip) and room temperatures. */
.ticker { display:none; }
.shabbos .content { gap:10px; padding:20px 28px; }
.shabbos .hm { font-size:118px; }
.shabbos .gdate { font-size:20px; margin-top:2px; }
.shabbos .hdate { font-size:50px; }
.shabbos .hparsha { font-size:32px; margin-top:0; }
.shabbos .hday { font-size:19px; margin-top:2px; }
.shabbos .pills { margin-top:6px; }
.shabbos .hours, .shabbos .days, .shabbos .tiles .events { display:none; }
.shabbos .tiles { grid-template-columns:minmax(0, 1.9fr) minmax(0, 1fr); gap:12px; }
.shabbos .tile { padding:12px 16px; border-radius:20px; }
.shabbos .weather { display:flex; align-items:center; gap:18px; }
.shabbos .wnow { flex:none; gap:10px; flex-direction:column; align-items:flex-start; }
.shabbos .wnow > div { display:flex; flex-direction:column; }
.shabbos .wnow ha-icon { display:none; }
.shabbos .wtemp { font-size:64px; font-weight:400; }
.shabbos .wcond { font-size:18px; }
.shabbos .whilo { flex-direction:row; gap:12px; font-size:22px; margin:0; }
.shabbos .ticker { display:flex; flex-direction:column; gap:6px; flex:1; min-width:0; }
.frow { display:flex; align-items:stretch; gap:8px; }
.frow + .frow { padding-top:6px; border-top:1px solid rgba(255,255,255,.08); }
.fitems { flex:1; display:grid; grid-template-columns:repeat(var(--n), minmax(0, 1fr)); gap:2px; }
.ti { display:flex; flex-direction:column; align-items:center; gap:0; line-height:1.1; }
.ti small { color:rgba(247,241,230,.75); font-size:16px; font-weight:500; } .ti ha-icon { --mdc-icon-size:30px; color:#cfe3ff; }
.ti b { font-size:23px; font-weight:600; white-space:nowrap; } .ti i { font-style:normal; color:#8fd3ff; font-size:17px; margin-left:4px; }
.ti em { font-style:normal; font-size:15px; line-height:1.15; min-height:1.15em; white-space:nowrap; }
.tlabel { writing-mode:vertical-rl; transform:rotate(180deg); font-size:12px; font-weight:600; letter-spacing:2px; text-transform:uppercase; color:var(--a2);
  text-align:center; padding:2px 3px; border-left:2px solid rgba(255,196,107,.45); }
.shabbos .rooms { gap:6px; }
.shabbos .room { flex:1 1 calc(100% / 4 - 6px); padding:6px 2px; gap:0; border-radius:14px; }
.shabbos .room ha-icon, .shabbos .room small { display:none; }
.shabbos .room b { font-size:40px; font-weight:600; } .shabbos .room span { font-size:15px; letter-spacing:.3px; color:rgba(247,241,230,.8); }
.shabbos .mode { font-size:13px; padding:0 6px; }

.tiles { display:grid; gap:16px; grid-template-columns:minmax(0, 1.75fr) minmax(0, 1fr) minmax(0, 1fr); align-items:stretch; }
.tiles.n1, .tiles.n2 { grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); }
.tile { padding:16px 18px; border-radius:24px; background:rgba(8,8,20,.72); border:1px solid rgba(255,255,255,.12);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.08); position:relative; overflow:hidden; contain:layout paint; }
.tile::before { content:""; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg, transparent, var(--a2), transparent);
  opacity:.6; }
.wnow { display:flex; align-items:center; gap:14px; }
.whilo { margin-inline-start:auto; display:flex; flex-direction:column; align-items:flex-end; font-size:22px; }
.whilo span:first-child { color:#ffb36b; } .whilo span:last-child { color:#8fd3ff; }
.wnow ha-icon { --mdc-icon-size:64px; color:#ffd27a; filter:drop-shadow(0 0 12px rgba(255,200,110,.5)); }
.wtemp { font-size:58px; font-weight:300; line-height:1; }
.wcond { text-transform:capitalize; color:rgba(247,241,230,.7); font-size:17px; }
.hours { display:grid; grid-template-columns:repeat(auto-fit, minmax(42px, 1fr)); margin-top:12px; gap:2px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,.08); }
.hr { display:flex; flex-direction:column; align-items:center; gap:2px; font-size:14px; }
.hr small { color:rgba(247,241,230,.6); } .hr ha-icon { --mdc-icon-size:24px; color:#cfe3ff; }
.hr em, .dy em { font-style:normal; font-size:13px; line-height:1.2; min-height:1.2em; white-space:nowrap; }
.days { display:grid; grid-auto-flow:column; grid-auto-columns:1fr; gap:4px; margin-top:10px; }
.dy { display:flex; flex-direction:column; align-items:center; gap:2px; font-size:16px; }
.dy .dn { color:rgba(247,241,230,.75); font-weight:500; } .dy ha-icon { --mdc-icon-size:24px; color:#cfe3ff; }
.dlo { color:#8fd3ff; } .dhi { color:#fff; font-weight:600; }
.bar { width:6px; height:34px; border-radius:3px; background:linear-gradient(0deg, #6fc3ff, #ffd27a, #ff9a5a); opacity:.85; }
em.rain { color:#8fd3ff; } em.hum { color:#b9e6c9; }
.rooms { display:flex; flex-wrap:wrap; gap:10px; align-content:stretch; }
.room { box-sizing:border-box; flex:1 1 calc(100% / var(--cols, 4) - 10px); min-width:60px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; padding:10px 4px; border-radius:18px; background:rgba(255,255,255,.04); border:1px solid transparent; }
.room span { font-size:14px; text-transform:uppercase; letter-spacing:1px; color:rgba(247,241,230,.6); }
.room b { font-size:38px; font-weight:500; line-height:1.05; }
.room small { font-size:14px; color:rgba(247,241,230,.5); }
.room ha-icon { --mdc-icon-size:29px; }
.room.cold { border-color:rgba(100,200,255,.4); } .room.cold ha-icon { color:#7fd0ff; }
.room.ok { border-color:rgba(130,220,150,.35); } .room.ok ha-icon { color:#8fe3a0; }
.room.warm { border-color:rgba(255,190,100,.45); } .room.warm ha-icon { color:#ffc46b; }
.room.hot { border-color:rgba(255,110,100,.55); } .room.hot ha-icon { color:#ff7b6b; }
.room.na ha-icon { color:#889; }
.mode { font-style:normal; font-size:11px; margin-top:2px; padding:1px 8px; border-radius:999px; }
.mode.on { background:rgba(120,200,255,.18); color:#8fe9ff; } .mode.off { background:rgba(255,255,255,.06); color:rgba(247,241,230,.45); }
.events { display:flex; flex-direction:column; gap:6px; }
.ev { display:flex; align-items:center; gap:14px; }
.evn { min-width:62px; text-align:center; font-size:28px; font-weight:800; line-height:1; }
.evn small { display:block; font-size:10px; letter-spacing:2px; font-weight:500; color:rgba(247,241,230,.55); margin-top:3px; }
.evt { display:flex; flex-direction:column; } .evt b { font-weight:500; font-size:18px; } .evt small { color:rgba(247,241,230,.55); font-size:12px; }
.ev.c0 .evn { color:#ff9ec7; text-shadow:0 0 14px rgba(255,150,200,.5); } .ev.c1 .evn { color:#8fe9ff; text-shadow:0 0 14px rgba(140,230,255,.5); }
.ev.c2 .evn { color:#d9a8ff; text-shadow:0 0 14px rgba(210,160,255,.5); } .ev.c3 .evn { color:#ffd27a; text-shadow:0 0 14px rgba(255,210,120,.5); }
.empty { opacity:.6; padding:40px; text-align:center; }

/* ---- holiday themes ---- */
.theme { opacity:0; transition:opacity 4s ease; overflow:hidden; pointer-events:none; }
.themed .theme { opacity:1; }
.stage.themed .stars { opacity:0; }
.stage.theme-sukkos .stars, .stage.theme-chanukah .stars, .stage.theme-lagbaomer .stars, .stage.theme-tubav .stars, .stage.theme-roshhashana .stars, .stage.theme-yomkippur .stars { opacity:.55; }
.theme > * { position:absolute; inset:0; }
.phase-day.themed .tbg { filter:brightness(1.2) saturate(1.1); }
.theme-roshhashana .tbg { background:radial-gradient(70% 50% at 50% 0%, rgba(255,209,102,.22), transparent 70%), radial-gradient(120% 100% at 50% 110%, #4a1030 0%, #1d0b2a 55%, #0a0514 100%); }
.theme-yomkippur .tbg { background:conic-gradient(from 150deg at 50% -8%, transparent 0deg, rgba(255,255,255,.07) 8deg, transparent 16deg, rgba(255,255,255,.05) 26deg, transparent 34deg, rgba(255,255,255,.07) 44deg, transparent 52deg, rgba(255,255,255,.05) 60deg, transparent 68deg),
  radial-gradient(80% 60% at 50% 0%, #465888 0%, #1c2548 50%, #0b1024 100%); }
.theme-sukkos .tbg { background:radial-gradient(60% 45% at 50% 105%, rgba(242,176,78,.28), transparent 70%), radial-gradient(45% 35% at 50% 30%, rgba(255,214,140,.12), transparent 70%), linear-gradient(180deg, #0f1a33 0%, #1d2440 45%, #33261f 80%, #3b2615 100%); }
.theme-simchastorah .tbg { background:radial-gradient(60% 50% at 50% 10%, rgba(255,213,79,.28), transparent 70%), linear-gradient(160deg, #1b2a7a 0%, #3a1c6e 50%, #12103a 100%); }
.theme-chanukah .tbg { background:radial-gradient(60% 45% at 50% 8%, rgba(255,190,90,.22), transparent 70%), radial-gradient(120% 100% at 50% 100%, #173a7a 0%, #0c1d45 55%, #050b1f 100%); }
.theme-tubishvat .tbg { background:radial-gradient(80% 60% at 30% 0%, rgba(248,187,208,.22), transparent 65%), linear-gradient(180deg, #24503a 0%, #1a3a2c 50%, #0e2119 100%); }
.theme-purim .tbg { background:radial-gradient(50% 40% at 20% 20%, rgba(255,110,199,.3), transparent 70%), radial-gradient(50% 40% at 80% 30%, rgba(77,208,225,.25), transparent 70%), linear-gradient(160deg, #3b0f5c 0%, #5a1459 50%, #1c0a33 100%); }
.theme-pesach .tbg { background:radial-gradient(70% 50% at 50% 0%, rgba(243,201,105,.2), transparent 70%), linear-gradient(180deg, #3a0f24 0%, #251233 55%, #0c1530 100%); }
.theme-lagbaomer .tbg { background:linear-gradient(180deg, #0a0c1f 0%, #1a0f1a 60%, #2a1208 100%); }
.theme-shavuos .tbg { background:radial-gradient(70% 50% at 50% 0%, rgba(255,255,255,.18), transparent 70%), linear-gradient(180deg, #2c5a44 0%, #1d4034 50%, #10261f 100%); }
.theme-tubav .tbg { background:radial-gradient(40% 35% at 50% 10%, rgba(255,244,214,.22), transparent 70%), linear-gradient(180deg, #2a1a4a 0%, #4a2350 55%, #1a0f2a 100%); }
.theme-tishabav .tbg { background:linear-gradient(180deg, #1a1a1c 0%, #121213 60%, #0a0a0a 100%); }
.theme-fast .tbg { background:linear-gradient(180deg, #1c2330 0%, #141a24 60%, #0b0f16 100%); }
.tmotif { display:flex; justify-content:center; align-items:flex-start; padding-top:1%; }
.motif { width:24%; height:auto; opacity:.5; filter:drop-shadow(0 0 30px rgba(255,210,140,.25)); }
.motif.menorah { width:22%; opacity:.9; }
.menorah .arm { fill:none; stroke:#e2bf55; stroke-width:7; stroke-linecap:round; } .menorah .base { fill:#e2bf55; } .menorah .cand { fill:#dfe7ff; }
.motif.shofar { width:22%; opacity:.8; } .motif.torah { width:17%; } .motif.luchos { width:22%; opacity:.55; } .motif.fullmoon { width:13%; opacity:.9; filter:drop-shadow(0 0 40px rgba(255,240,200,.5)); }
.tedge i { position:absolute; display:block; aspect-ratio:1; } .tedge i svg, .fl svg { width:100%; height:100%; display:block; }
.schach i { opacity:.8; }
.pole { position:absolute; left:-1%; right:-1%; height:14px; border-radius:7px; background:repeating-linear-gradient(90deg, #c8a45e 0 140px, #8a6a32 140px 146px), #c8a45e; box-shadow:inset 0 -4px 0 rgba(0,0,0,.25), inset 0 3px 0 rgba(255,240,200,.35); }
.theme-sukkos .tmotif { padding-top:5.5%; }
.motif.lulav { width:17%; opacity:.95; filter:drop-shadow(0 0 30px rgba(242,193,78,.3)); }
.hang { position:absolute; top:0; width:2px; height:var(--len); background:linear-gradient(#c8b27a, #8f7a45); transform-origin:top center; animation:swing 6s ease-in-out infinite alternate; }
.hang svg { position:absolute; top:100%; left:50%; width:44px; height:44px; transform:translateX(-50%); }
@keyframes swing { from { transform:rotate(-6deg); } to { transform:rotate(6deg); } }
.tedge.kosel { top:auto; height:26%; opacity:.5; } .kosel svg { width:100%; height:100%; display:block; }
.tedge.sea { top:auto; height:20%; } .sea svg { width:100%; height:100%; display:block; }
.sea .w1 { fill:rgba(70,130,210,.3); animation:wave 9s ease-in-out infinite alternate; } .sea .w2 { fill:rgba(40,90,170,.4); animation:wave 7s ease-in-out infinite alternate-reverse; }
@keyframes wave { from { transform:translateX(0); } to { transform:translateX(-160px); } }
.tedge.fire { top:auto; height:40%; background:radial-gradient(55% 90% at 50% 100%, rgba(255,150,50,.6), rgba(255,80,20,.22) 50%, transparent 75%); animation:fireglow 1.8s ease-in-out infinite alternate; }
@keyframes fireglow { from { opacity:.7; } to { opacity:1; } }
.floats { overflow:hidden; }
.fl { position:absolute; display:block; opacity:var(--o); animation-iteration-count:infinite; }
.fl.fall { top:-8%; animation-name:zfall; animation-timing-function:linear; }
.fl.rise { top:102%; animation-name:zrise; animation-timing-function:linear; }
.fl.drift { animation-name:zdrift; animation-timing-function:ease-in-out; animation-direction:alternate; }
@keyframes zfall { 0% { transform:translate(0, 0) rotate(0deg); } 50% { transform:translate(var(--x), calc(var(--H, 1300px) * .58)) rotate(calc(var(--r) / 2)); } 100% { transform:translate(0, calc(var(--H, 1300px) * 1.16)) rotate(var(--r)); } }
@keyframes zrise { 0% { transform:translate(0, 0) scale(1); opacity:0; } 10% { opacity:var(--o); } 100% { transform:translate(var(--x), calc(var(--H, 1300px) * -1.12)) scale(.5); opacity:0; } }
@keyframes zdrift { from { transform:translate(0, 0) rotate(-8deg); } to { transform:translate(var(--x), -40px) rotate(8deg); } }
.theme-lagbaomer .fl svg { filter:drop-shadow(0 0 6px #ff9a3d); } .theme-yomkippur .fl svg { filter:drop-shadow(0 0 8px #fff); }

.portrait .tiles { grid-template-columns:1fr 1fr; } .portrait .tiles .weather { grid-column:1 / -1; }
.portrait header { flex-direction:column; } .portrait .hebrew { align-self:stretch; }
.portrait .shab { grid-template-columns:1fr; }
`;

if (!customElements.get("zman-display-card")) customElements.define("zman-display-card", ZmanDisplayCard);
window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "zman-display-card")) window.customCards.push({
  type: "zman-display-card",
  name: "Zman Display Card",
  description: "Full-screen living wall display: sky that follows the zmanim, a day arc, Shabbos candlelight mode.",
  preview: false,
});

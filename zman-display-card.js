/**
 * Zman Display Card
 * A full-screen, living wall display: the sky follows the real zmanim, the sun
 * travels a "day arc" of today's zmanim, and on Erev Shabbos / Shabbos / Yom Tov
 * the whole screen turns to candlelight with the shul schedule.
 */

const ZDC_VERSION = "0.2.0";

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

const ZDC_SHORT_DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש״ק"];

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

const fmtTime = (d) => (d ? `${d.getHours() % 12 || 12}:${pad(d.getMinutes())}` : "--:--");

const fmtCountdown = (ms) => {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const hms = `${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  return d ? `${d}d ${hms}` : hms;
};

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
    if (this._hass && !this._unsubFc) this._subscribeForecast();
  }

  disconnectedCallback() {
    clearInterval(this._timer);
    this._timer = null;
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
      foot: root.getElementById("foot"),
    };
    this._html = {};
  }

  _set(key, html) {
    if (this._html[key] !== html) {
      this._html[key] = html;
      this._el[key].innerHTML = html;
    }
  }

  // ---------------------------------------------------------------- render
  _tick() {
    if (!this._el) return;
    const now = new Date();
    if (this._dirty || now.getSeconds() === 0) this._render();
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

    this._el.stage.className = `stage ${shabbos ? "shabbos" : ""} phase-${this._phase(now, zmanim)}`;
    this._el.gdate.textContent = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

    this._set("hebrew", this._hebrewHtml(now));
    this._set("alerts", this._alertsHtml());
    this._set("main", shabbos ? this._shabbosHtml(now) : this._arcHtml(now, zmanim));
    this._set("foot", this._footHtml(now));
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
        const unit = a.value_entity ? this._state(a.value_entity)?.attributes?.unit_of_measurement || "" : "";
        return `<span class="alert ${esc(a.color || "amber")}"><ha-icon icon="${esc(a.icon || "mdi:alert-circle")}"></ha-icon>${esc(a.name || "")}${extra ? ` <b>${esc(extra)}${esc(unit ? " " + unit : "")}</b>` : ""}</span>`;
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
          <path id="prog" d="M60 300" class="prog"/>
          ${marks}
          <g id="sun" class="sun">
            <circle r="46" class="sunglow" filter="url(#zdcGlow)"></circle>
            <g class="rays">${Array.from({ length: 12 }, (_, i) => `<rect x="-2" y="-40" width="4" height="12" rx="2" transform="rotate(${i * 30})"/>`).join("")}</g>
            <circle r="20" fill="url(#zdcSun)"></circle>
          </g>
          <g id="moon" class="moon" transform="translate(500 110)">
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
    let title = sched && !ZDC_BAD.has(sched.state) ? sched.state : this._val(c.holiday);
    if (!title) title = this._val(c.parsha) ? `שבת פרשת ${this._val(c.parsha)}` : "שבת קודש";
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
      <div class="shab">
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
      const lo = Math.min(...days.map((d) => d.templow ?? d.temperature));
      const hi = Math.max(...days.map((d) => d.temperature));
      const span = Math.max(1, hi - lo);
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
            return `<div class="hr"><small>${d.getHours() % 12 || 12}${d.getHours() < 12 ? "a" : "p"}</small><ha-icon icon="${icon(f.condition)}"></ha-icon><b>${Math.round(f.temperature)}°</b><em>${f.precipitation_probability ? f.precipitation_probability + "%" : ""}</em></div>`;
          })
          .join("")}</div>` : ""}
        ${days.length ? `<div class="days">${days
          .map((f, i) => {
            const d = new Date(f.datetime);
            const low = f.templow ?? f.temperature;
            return `<div class="dy"><span class="dn">${i === 0 ? "היום" : ZDC_SHORT_DAYS[d.getDay()]}</span><ha-icon icon="${icon(f.condition)}"></ha-icon>
              <span class="dhi">${Math.round(f.temperature)}°</span>
              <span class="bar"><i style="bottom:${(((low - lo) / span) * 100).toFixed(1)}%;top:${(((hi - f.temperature) / span) * 100).toFixed(1)}%"></i></span>
              <span class="dlo">${Math.round(low)}°</span>
              <em>${f.precipitation_probability ? "💧" + f.precipitation_probability + "%" : ""}</em></div>`;
          })
          .join("")}</div>` : ""}
      </div>`);
    }

    if ((c.rooms || []).length) {
      tiles.push(`<div class="tile rooms">${c.rooms
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

  // Per-second updates that must not re-create DOM (keeps animations smooth).
  _updateLive(now) {
    const root = this.shadowRoot;
    if (!root) return;
    for (const id of ["ncd", "scd"]) {
      const el = root.getElementById(id);
      if (el) el.textContent = fmtCountdown(Number(el.dataset.t) - now);
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
:host { display:block; }
.stage { position:relative; overflow:hidden; min-height:calc(100vh - var(--header-height, 56px)); color:#f7f1e6;
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

.content { position:relative; z-index:1; display:flex; flex-direction:column; gap:12px; padding:clamp(16px, 2.4vw, 36px); min-height:inherit; box-sizing:border-box; }
header { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; flex-wrap:wrap; }
.hm { font-weight:300; font-size:clamp(84px, 12.5vw, 220px); line-height:.9; letter-spacing:-3px; text-shadow:0 0 40px rgba(255,210,150,.35); font-variant-numeric:tabular-nums; }
.ss { font-size:.32em; font-weight:500; letter-spacing:0; margin-left:10px; color:#ffc46b; vertical-align:top; display:inline-block; margin-top:.35em; }
.gdate { margin-top:6px; font-size:clamp(16px, 1.6vw, 26px); color:rgba(247,241,230,.75); letter-spacing:.5px; }
.hebrew { direction:rtl; text-align:right; }
.hdate { font-family:'Frank Ruhl Libre', serif; font-weight:900; font-size:clamp(34px, 4.4vw, 72px); line-height:1.05;
  background:linear-gradient(180deg, #fff3d6, #ffc46b 60%, #ff9a5a); -webkit-background-clip:text; background-clip:text; color:transparent;
  filter:drop-shadow(0 0 18px rgba(255,170,80,.35)); }
.hparsha { margin-top:4px; font-family:'Frank Ruhl Libre', serif; font-weight:700; font-size:clamp(24px, 2.6vw, 44px); color:#e6c7ff; text-shadow:0 0 18px rgba(200,150,255,.45); }
.hday { margin-top:6px; font-size:clamp(16px, 1.5vw, 24px); color:rgba(247,241,230,.8); }
.hday b { color:#e6c7ff; font-weight:600; } .dot { color:#ffc46b; margin:0 6px; }
.pills { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; justify-content:flex-start; }
.pill { padding:5px 14px; border-radius:999px; font-size:clamp(13px, 1.1vw, 17px); font-weight:500; backdrop-filter:blur(8px);
  background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.18); }
.pill.gold { color:#ffd88a; border-color:rgba(255,200,110,.5); box-shadow:0 0 14px rgba(255,190,90,.25); }
.pill.violet { color:#e6c7ff; border-color:rgba(206,160,255,.45); }
.pill.sky { color:#a8ecff; border-color:rgba(130,220,255,.45); }
.pill.moon { color:#fff6b0; border-color:rgba(255,245,160,.45); box-shadow:0 0 14px rgba(255,245,160,.2); }
.pill.mint { color:#b8f5c8; border-color:rgba(150,240,180,.45); }

.alertwrap { flex:1; align-self:center; }
.alerts { display:flex; flex-wrap:wrap; gap:10px; justify-content:center; }
.alert { display:inline-flex; align-items:center; gap:8px; padding:8px 16px; border-radius:14px; font-size:clamp(14px, 1.2vw, 18px);
  background:rgba(20,16,30,.55); backdrop-filter:blur(10px); border:1px solid; animation:pulse 2.4s ease-in-out infinite; }
.alert ha-icon { --mdc-icon-size:22px; }
.alert.red { color:#ff8a80; border-color:rgba(255,120,110,.6); } .alert.amber { color:#ffd180; border-color:rgba(255,200,110,.55); }
.alert.blue { color:#8fd3ff; border-color:rgba(120,200,255,.55); } .alert.pink { color:#ff9ec7; border-color:rgba(255,150,200,.55); }
@keyframes pulse { 0%,100% { box-shadow:0 0 0 rgba(255,180,120,0); } 50% { box-shadow:0 0 22px rgba(255,180,120,.35); } }

main { flex:1; display:flex; align-items:center; justify-content:center; min-height:0; }
.arcwrap { position:relative; width:100%; max-width:1500px; }
.arc { width:100%; height:clamp(240px, calc(100vh - 720px), 520px); display:block; overflow:visible; }
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
.moon { transition:opacity 3s; } .moon path { fill:#fff4c9; } .moonglow { fill:#fff4c9; opacity:.35; }
.nextbox { position:absolute; left:50%; bottom:2%; transform:translateX(-50%); text-align:center; direction:rtl; width:60%; }
.nlabel { font-size:clamp(14px, 1.2vw, 19px); font-weight:500; color:#ffc46b; }
.nname { font-family:'Frank Ruhl Libre', serif; font-weight:900; font-size:clamp(30px, 3.6vw, 60px); line-height:1.1; }
.ncount { direction:ltr; font-variant-numeric:tabular-nums; font-weight:300; font-size:clamp(26px, 3vw, 52px); letter-spacing:2px; color:#fff; text-shadow:0 0 24px rgba(255,190,110,.6); }
.nat { direction:ltr; color:rgba(247,241,230,.6); font-size:clamp(13px, 1.1vw, 17px); }

.shab { width:100%; display:grid; grid-template-columns:minmax(300px, 0.9fr) 1.4fr; gap:28px; align-items:center; direction:rtl; }
.shab-hero { text-align:center; }
.candles { width:min(260px, 60%); height:auto; overflow:visible; }
.halo { fill:rgba(255,170,70,.28); filter:blur(14px); animation:halo 3s ease-in-out infinite; transform-box:fill-box; transform-origin:center; }
.flame { fill:#ffb347; transform-box:fill-box; transform-origin:50% 100%; animation:flicker 1.3s ease-in-out infinite alternate; filter:drop-shadow(0 0 10px #ff9a3d); }
.flame.core { fill:#fff6d6; animation-duration:.9s; }
.wick { fill:#3a2a1a; } .wax { fill:#f5ecdc; } .holder { fill:#c9a24a; }
@keyframes flicker { 0% { transform:scale(1,1) skewX(0deg); } 30% { transform:scale(.96,1.06) skewX(2deg); } 60% { transform:scale(1.03,.95) skewX(-2deg); } 100% { transform:scale(.98,1.04) skewX(1deg); } }
@keyframes halo { 0%,100% { opacity:.7; transform:scale(1); } 50% { opacity:1; transform:scale(1.12); } }
.stitle { font-family:'Frank Ruhl Libre', serif; font-weight:900; font-size:clamp(38px, 4.6vw, 80px); line-height:1.05; margin-top:6px;
  background:linear-gradient(180deg, #fff3d6, #ffc46b 55%, #ff8f4d); -webkit-background-clip:text; background-clip:text; color:transparent;
  filter:drop-shadow(0 0 22px rgba(255,160,60,.45)); }
.stimes { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:18px; }
.st { padding:14px 10px; border-radius:22px; background:rgba(255,190,110,.08); border:1px solid rgba(255,190,110,.35); backdrop-filter:blur(10px); display:flex; flex-direction:column; gap:2px; }
.st span { font-size:clamp(15px, 1.3vw, 20px); color:rgba(255,236,210,.85); }
.st b { direction:ltr; font-size:clamp(36px, 3.8vw, 64px); font-weight:700; color:#fff3e0; line-height:1.05; }
.st small { color:rgba(255,236,210,.6); font-size:clamp(13px, 1.1vw, 16px); }
.scd { margin-top:16px; display:inline-flex; align-items:baseline; gap:12px; padding:10px 22px; border-radius:999px;
  background:linear-gradient(90deg, rgba(255,180,90,.25), rgba(255,120,80,.15)); border:1px solid rgba(255,180,90,.5); box-shadow:0 0 30px rgba(255,150,70,.3); }
.scd span { color:#ffd9a8; font-size:clamp(15px, 1.3vw, 20px); }
.scd b { direction:ltr; font-variant-numeric:tabular-nums; font-size:clamp(24px, 2.4vw, 40px); font-weight:500; color:#fff; }
.sched { display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:14px; align-content:center; }
.sday { padding:14px 18px 10px; border-radius:22px; background:rgba(25,14,6,.55); border:1px solid rgba(255,190,110,.25); backdrop-filter:blur(12px); }
.sday h3 { margin:0 0 8px; font-family:'Frank Ruhl Libre', serif; font-size:clamp(18px, 1.6vw, 26px); color:#ffc46b; border-bottom:1px solid rgba(255,190,110,.25); padding-bottom:6px; }
.srow { display:flex; justify-content:space-between; align-items:baseline; gap:10px; padding:5px 0; border-bottom:1px dashed rgba(255,255,255,.07); }
.srow:last-child { border-bottom:0; }
.sname { font-size:clamp(14px, 1.15vw, 18px); display:flex; flex-direction:column; }
.sname small { color:rgba(255,236,210,.5); font-size:.78em; }
.srow b { direction:ltr; font-variant-numeric:tabular-nums; color:#fff3e0; font-size:clamp(15px, 1.25vw, 20px); white-space:nowrap; }

.tiles { display:grid; gap:16px; grid-template-columns:minmax(0, 1.75fr) minmax(0, 1fr) minmax(0, 1fr); align-items:stretch; }
.tiles.n1, .tiles.n2 { grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); }
.tile { padding:16px 18px; border-radius:24px; background:rgba(10,10,24,.42); border:1px solid rgba(255,255,255,.12);
  backdrop-filter:blur(14px) saturate(1.3); box-shadow:0 10px 40px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.08); position:relative; overflow:hidden; }
.tile::before { content:""; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg, transparent, #ffc46b, transparent);
  background-size:50% 100%; background-repeat:no-repeat; animation:sweep 6s ease-in-out infinite; }
@keyframes sweep { 0% { background-position:-60% 0; } 100% { background-position:160% 0; } }
.wnow { display:flex; align-items:center; gap:14px; }
.whilo { margin-inline-start:auto; display:flex; flex-direction:column; align-items:flex-end; font-size:clamp(16px, 1.4vw, 22px); }
.whilo span:first-child { color:#ffb36b; } .whilo span:last-child { color:#8fd3ff; }
.wnow ha-icon { --mdc-icon-size:64px; color:#ffd27a; filter:drop-shadow(0 0 12px rgba(255,200,110,.5)); }
.wtemp { font-size:clamp(40px, 3.6vw, 58px); font-weight:300; line-height:1; }
.wcond { text-transform:capitalize; color:rgba(247,241,230,.7); font-size:clamp(14px, 1.1vw, 17px); }
.hours { display:grid; grid-template-columns:repeat(auto-fit, minmax(42px, 1fr)); margin-top:12px; gap:2px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,.08); }
.hr { display:flex; flex-direction:column; align-items:center; gap:2px; font-size:14px; }
.hr small { color:rgba(247,241,230,.6); } .hr ha-icon { --mdc-icon-size:24px; color:#cfe3ff; } .hr em { font-style:normal; font-size:11px; color:#8fd3ff; min-height:13px; }
.days { display:grid; grid-template-columns:repeat(auto-fit, minmax(48px, 1fr)); gap:4px; margin-top:10px; direction:rtl; }
.dy { display:flex; flex-direction:column; align-items:center; gap:2px; font-size:clamp(13px, 1vw, 16px); }
.dy .dn { color:rgba(247,241,230,.75); font-weight:500; } .dy ha-icon { --mdc-icon-size:24px; color:#cfe3ff; }
.dlo { color:#8fd3ff; } .dhi { color:#fff; font-weight:600; }
.bar { position:relative; width:6px; height:34px; border-radius:3px; background:rgba(255,255,255,.08); }
.bar i { position:absolute; left:0; right:0; border-radius:3px; background:linear-gradient(0deg, #6fc3ff, #ffd27a, #ff9a5a); }
.dy em { font-style:normal; font-size:11px; color:#8fd3ff; min-height:13px; }
.rooms { display:grid; grid-template-columns:repeat(auto-fill, minmax(96px, 1fr)); gap:10px; align-content:start; }
.room { display:flex; flex-direction:column; align-items:center; padding:8px 4px; border-radius:16px; background:rgba(255,255,255,.04); border:1px solid transparent; }
.room span { font-size:12px; text-transform:uppercase; letter-spacing:1px; color:rgba(247,241,230,.6); }
.room b { font-size:clamp(22px, 1.9vw, 30px); font-weight:500; }
.room small { font-size:11px; color:rgba(247,241,230,.5); }
.room ha-icon { --mdc-icon-size:22px; }
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
.evt { display:flex; flex-direction:column; } .evt b { font-weight:500; font-size:clamp(14px, 1.15vw, 18px); } .evt small { color:rgba(247,241,230,.55); font-size:12px; }
.ev.c0 .evn { color:#ff9ec7; text-shadow:0 0 14px rgba(255,150,200,.5); } .ev.c1 .evn { color:#8fe9ff; text-shadow:0 0 14px rgba(140,230,255,.5); }
.ev.c2 .evn { color:#d9a8ff; text-shadow:0 0 14px rgba(210,160,255,.5); } .ev.c3 .evn { color:#ffd27a; text-shadow:0 0 14px rgba(255,210,120,.5); }
.empty { opacity:.6; padding:40px; text-align:center; }

@media (max-width: 1250px) {
  .tiles { grid-template-columns:1fr 1fr; } .tiles .weather { grid-column:1 / -1; }
}
@media (max-width: 900px) {
  .tiles { grid-template-columns:1fr; }
  .arc { height:auto; }
  header { flex-direction:column; } .hebrew { align-self:stretch; }
  .shab { grid-template-columns:1fr; }
  .nextbox { position:static; transform:none; width:100%; margin-top:8px; }
}
`;

if (!customElements.get("zman-display-card")) customElements.define("zman-display-card", ZmanDisplayCard);
window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "zman-display-card")) window.customCards.push({
  type: "zman-display-card",
  name: "Zman Display Card",
  description: "Full-screen living wall display: sky that follows the zmanim, a day arc, Shabbos candlelight mode.",
  preview: false,
});

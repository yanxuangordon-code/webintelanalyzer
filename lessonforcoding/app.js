// ─── CodePath App ────────────────────────────────────────
// All challenge runners route through window.runCode(lang, code)
// so Python challenges use the Python simulator, NOT the JS engine
// ────────────────────────────────────────────────────────

const LABELS = { python:"Python", html:"HTML", js:"JavaScript", cpp:"C++" };
const SUBS   = {
  python: "Simple syntax · AI, data, web",
  html:   "Structure · Every website uses this",
  js:     "Interactivity · Runs in every browser",
  cpp:    "Performance · Games & systems software"
};

let curLang  = null;
let curIdx   = 0;
let progress = {};   // { python: Set, html: Set, … }
let mcqState = {};   // { "py1-0": chosen, … }
let mcqScore = {};   // { "py1": { c:0, t:3 } }

// ── Init ──────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  loadProg();
  refreshBars();
});

// ── Progress ──────────────────────────────────────────────
function loadProg() {
  try {
    const raw = localStorage.getItem("cp2_prog");
    if (raw) { const p = JSON.parse(raw); Object.keys(p).forEach(k => progress[k] = new Set(p[k])); }
  } catch {}
}
function saveProg() {
  const out = {};
  Object.keys(progress).forEach(k => out[k] = [...progress[k]]);
  localStorage.setItem("cp2_prog", JSON.stringify(out));
}
function markDone(lang, idx) {
  if (!progress[lang]) progress[lang] = new Set();
  progress[lang].add(idx); saveProg(); refreshBars(); updateNavBar(lang);
}
function refreshBars() {
  ["python","html","js","cpp"].forEach(lang => {
    const total = (window.LESSONS && LESSONS[lang]) ? LESSONS[lang].length : 15;
    const done  = progress[lang] ? progress[lang].size : 0;
    const pct   = Math.round(done / total * 100);
    const b     = document.getElementById("bf-"+lang);
    const p     = document.getElementById("pct-"+lang);
    if (b) b.style.width = pct + "%";
    if (p) p.textContent = pct + "%";
  });
}
function updateNavBar(lang) {
  const total = LESSONS[lang].length;
  const done  = progress[lang] ? progress[lang].size : 0;
  const pct   = Math.round(done / total * 100);
  document.getElementById("npl").textContent    = `${LABELS[lang]} ${done}/${total}`;
  document.getElementById("npfill").style.width = pct + "%";
}

// ── View switching ─────────────────────────────────────────
function showView(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("on"));
  document.getElementById(id).classList.add("on");
  window.scrollTo(0, 0);
}
function goHome() {
  showView("vHome"); refreshBars();
  document.getElementById("psfill").style.width = "0";
  document.getElementById("npl").textContent = "";
  document.getElementById("npfill").style.width = "0";
}
function openLang(lang) {
  curLang = lang;
  document.getElementById("pkrname").textContent = LABELS[lang];
  document.getElementById("pkrsub").textContent  = SUBS[lang];
  renderPicker(lang);
  showView("vPicker");
  updateNavBar(lang);
}
function goBack() {
  renderPicker(curLang); showView("vPicker");
}

// ── Picker ────────────────────────────────────────────────
function renderPicker(lang) {
  const lessons = LESSONS[lang] || [];
  document.getElementById("lcards").innerHTML = lessons.map((l, i) => {
    const done = progress[lang] && progress[lang].has(i);
    const bcls = done ? "done" : l.runnable ? "run" : "read";
    const btxt = done ? "✓ Completed" : l.runnable ? "▶ Interactive" : "📖 Read-along";
    return `<div class="lpc ${done?"done":""}" onclick="openLesson('${lang}',${i})">
      <div class="lpcn">LESSON ${String(i+1).padStart(2,"0")}</div>
      <div class="lpct">${esc(l.title)}</div>
      <div class="lpcs">${esc(l.subtitle)}</div>
      <div class="lpcb ${bcls}">${btxt}</div>
    </div>`;
  }).join("");
}

// ── Open lesson ────────────────────────────────────────────
function openLesson(lang, idx) {
  curLang = lang; curIdx = idx;
  renderLesson(lang, idx);
  showView("vLesson");
  markDone(lang, idx);
  const total = LESSONS[lang].length;
  document.getElementById("psfill").style.width = ((idx+1)/total*100)+"%";
  localStorage.setItem("cp2_last", JSON.stringify({lang,idx}));
}
function prevL() { if (curIdx > 0) openLesson(curLang, curIdx-1); }
function nextL() {
  const ls = LESSONS[curLang];
  if (curIdx < ls.length-1) openLesson(curLang, curIdx+1);
  else showCongrats();
}

// ── Render lesson ──────────────────────────────────────────
function renderLesson(lang, idx) {
  const l  = LESSONS[lang][idx];
  const total = LESSONS[lang].length;

  // topbar
  const badge = document.getElementById("lbadge");
  badge.textContent = LABELS[lang]; badge.className = "lbadge " + lang;
  document.getElementById("lstep").textContent = `Lesson ${idx+1} of ${total}`;
  document.getElementById("bprev").disabled = idx === 0;
  const nb = document.getElementById("bnext");
  nb.textContent = idx === total-1 ? "🎉 Finish" : "Next ›";

  // content
  document.getElementById("ltitle").textContent = l.title;
  document.getElementById("lsub").textContent   = l.subtitle;
  document.getElementById("lintro").textContent = l.intro;

  // concepts
  document.getElementById("cgrid").innerHTML = (l.concepts||[]).map(c =>
    `<div class="cc"><div class="cci">${c.i}</div><div class="cct">${esc(c.t)}</div><div class="ccd">${esc(c.d)}</div></div>`
  ).join("");

  // code — join array with newlines, set via textContent (NO innerHTML!)
  const codeText = (l.code || []).join("\n");
  document.getElementById("cfn").textContent  = l.filename || "";
  document.getElementById("cpre").textContent = codeText;  // KEY: textContent prevents HTML parsing

  // breakdown
  document.getElementById("bkdn").innerHTML = (l.breakdown||[]).map(b =>
    `<div class="bi"><div class="bitok">${b.t}</div><div class="binote">${b.n}</div></div>`
  ).join("");

  // try-it section
  const tryEl = document.getElementById("trysec");
  if (l.runnable) {
    tryEl.style.display = "block";
    document.getElementById("codearea").value = l.starter || codeText;
    clrMain();
  } else {
    tryEl.style.display = "none";
  }

  // quiz
  renderMCQ(l, lang, idx);

  // challenges
  renderChallenges(l, lang, idx);
}

// ── Run main editor ────────────────────────────────────────
function runMain() {
  const code = document.getElementById("codearea").value.trim();
  const { out, err } = window.runCode(curLang, code);
  const box = document.getElementById("outbox");
  box.style.display = "block";
  box.className = "outbox" + (err ? " err" : "");
  box.textContent = out;
}
function clrMain() {
  const box = document.getElementById("outbox");
  box.style.display = "none"; box.textContent = "";
}

// ── Copy code ──────────────────────────────────────────────
function copyCode() {
  const l = LESSONS[curLang][curIdx];
  const text = (l.code || []).join("\n");
  navigator.clipboard.writeText(text).then(() => {
    const b = document.querySelector(".cpbtn");
    b.textContent = "✓ Copied!";
    setTimeout(() => b.textContent = "Copy", 1600);
  }).catch(() => {
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand("copy"); document.body.removeChild(ta);
  });
}

// ── MCQ Quiz ───────────────────────────────────────────────
function renderMCQ(l, lang, idx) {
  const mcqs = l.mcqs || [];
  const key  = l.id;
  if (!mcqScore[key]) mcqScore[key] = { c:0, t:mcqs.length };

  document.getElementById("mcqwrap").innerHTML = mcqs.map((q, qi) => {
    const qk  = `${key}-${qi}`;
    const ans = mcqState[qk];
    const optsHtml = q.opts.map((opt, oi) => {
      let cls = "";
      if (ans !== undefined) { if (oi===q.a) cls="ok"; else if (oi===ans) cls="no"; }
      return `<button class="mopt ${cls}" ${ans!==undefined?"disabled":""} onclick="answerQ('${key}',${qi},${oi},${q.a})">${esc(String(opt))}</button>`;
    }).join("");
    const res = ans !== undefined
      ? `<div class="mres" style="color:${ans===q.a?"var(--ac)":"#ff6b6b"}">${ans===q.a?"✅ Correct!":"❌ Correct answer highlighted in green."}</div>`
      : "";
    return `<div class="mblock"><div class="mq">${esc(q.q)}</div><div class="mopts">${optsHtml}</div>${res}</div>`;
  }).join("");

  updateQScore(key, mcqs.length);
}

function answerQ(key, qi, chosen, correct) {
  const qk = `${key}-${qi}`;
  if (mcqState[qk] !== undefined) return;
  mcqState[qk] = chosen;
  if (chosen === correct) mcqScore[key].c++;
  const l = LESSONS[curLang][curIdx];
  renderMCQ(l, curLang, curIdx);
}

function updateQScore(key, total) {
  const answered = Object.keys(mcqState).filter(k=>k.startsWith(key+"-")).length;
  const s = mcqScore[key];
  document.getElementById("qscore").textContent =
    s ? `${s.c}/${answered} correct (${total} questions)` : "";
}

// ── Coding Challenges ─────────────────────────────────────
function renderChallenges(l, lang, idx) {
  const sec = document.getElementById("chsec");
  const chs = l.challenges || [];
  if (!chs.length || !l.runnable) { sec.style.display="none"; return; }
  sec.style.display = "block";

  document.getElementById("chwrap").innerHTML = chs.map((ch, ci) =>
    `<div class="chcard" id="chc-${ci}">
      <div class="chtitle">${esc(ch.title)}</div>
      <div class="chprompt">${esc(ch.prompt)}</div>
      <textarea class="ched" id="che-${ci}" spellcheck="false" placeholder="Write your solution here…"></textarea>
      <div class="chftr">
        <button class="chrun" onclick="runChallenge(${ci})">▶ Run &amp; Check</button>
        <button class="chhint" onclick="toggleHint(${ci})">💡 Hint</button>
      </div>
      <div class="chhinttxt" id="chh-${ci}">${esc(ch.hint)}</div>
      <div class="chout"      id="cho-${ci}"></div>
    </div>`
  ).join("");
}

function toggleHint(ci) {
  const el = document.getElementById("chh-"+ci);
  el.style.display = el.style.display==="none"||!el.style.display ? "block" : "none";
}

function runChallenge(ci) {
  const l    = LESSONS[curLang][curIdx];
  const ch   = l.challenges[ci];
  const code = document.getElementById("che-"+ci).value.trim();
  const outEl= document.getElementById("cho-"+ci);

  if (!code) {
    outEl.style.display="block"; outEl.className="chout fail";
    outEl.textContent="⚠ Please write some code first!"; return;
  }

  // ── FIXED: use curLang so Python code goes to Python simulator ──
  const { out, err } = window.runCode(curLang, code);

  let passed = false;
  try { passed = ch.check(code, out); } catch {}

  outEl.style.display = "block";
  if (err && !passed) {
    outEl.className   = "chout fail";
    outEl.textContent = `⚠ Error: ${out}\n\n${ch.msg}`;
  } else if (passed) {
    outEl.className   = "chout pass";
    outEl.textContent = `✅ Correct!\n\nOutput:\n${out}`;
  } else {
    outEl.className   = "chout fail";
    outEl.textContent = `❌ Not quite.\n${ch.msg}\n\nYour output:\n${out}`;
  }
}

// ── Congrats ───────────────────────────────────────────────
function showCongrats() {
  const lang   = curLang;
  const others = ["python","html","js","cpp"].filter(l=>l!==lang);
  document.querySelector(".lmain").innerHTML = `
    <div style="text-align:center;padding:60px 20px">
      <div style="font-size:3.5rem;margin-bottom:18px">🎉</div>
      <h1 style="font-size:1.8rem;margin-bottom:10px">You finished ${LABELS[lang]}!</h1>
      <p style="color:var(--mt);font-size:.88rem;max-width:400px;margin:0 auto 28px;line-height:1.8">
        All ${LESSONS[lang].length} lessons complete. Keep practising and try another language!
      </p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        ${others.map(l=>`<button onclick="openLang('${l}')" style="font-family:var(--sn);font-weight:700;font-size:.82rem;padding:9px 20px;border-radius:6px;cursor:pointer;border:none;background:var(--${l==="html"?"ht":l==="cpp"?"cp":l});color:#000;transition:all .15s">${LABELS[l]} →</button>`).join("")}
        <button onclick="goHome()" style="font-family:var(--sn);font-weight:700;font-size:.82rem;padding:9px 18px;border-radius:6px;cursor:pointer;background:none;border:1px solid var(--bd);color:var(--mt)">← Home</button>
      </div>
    </div>`;
}

// ── Utility ────────────────────────────────────────────────
function esc(s) {
  if (typeof s !== "string") return String(s);
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

// ─── CodePath Runner ────────────────────────────────────
// FIX 1: Python code NEVER goes to JS engine
// FIX 2: No form submit, no Ctrl+P triggers anywhere
// FIX 3: Challenge runner uses same lang-aware dispatch
// ────────────────────────────────────────────────────────

// ── Public API ───────────────────────────────────────────
window.runCode = function(lang, code) {
  if (!code || !code.trim()) return { out: "(no code to run)", err: false };
  if (lang === "js")     return runJS(code);
  if (lang === "python") return { out: runPython(code), err: false };
  return {
    out: `ℹ ${lang === "cpp" ? "C++" : lang.toUpperCase()} cannot run in the browser.\n\nTo run this code:\n` +
         (lang === "cpp"
           ? "• Install g++\n• Save as main.cpp\n• Run: g++ main.cpp -o main && ./main"
           : "• Copy and paste into repl.it or an online compiler"),
    err: false
  };
};

// ── JavaScript runner ─────────────────────────────────────
function runJS(code) {
  const lines = [];
  const fakeConsole = {
    log:   (...a) => lines.push(a.map(fmt).join(" ")),
    warn:  (...a) => lines.push("⚠ " + a.map(fmt).join(" ")),
    error: (...a) => lines.push("✕ " + a.map(fmt).join(" ")),
    info:  (...a) => lines.push(a.map(fmt).join(" ")),
  };
  try {
    // Use Function constructor — scope it so no globals leak
    // Replace console references so they hit our fake object
    const wrapped = new Function("console", code);
    wrapped(fakeConsole);
    return { out: lines.join("\n") || "(no output)", err: false };
  } catch (e) {
    return { out: "⚠ " + e.message + (lines.length ? "\n\n" + lines.join("\n") : ""), err: true };
  }
}

function fmt(v) {
  if (v === null)         return "null";
  if (v === undefined)    return "undefined";
  if (Array.isArray(v))   return "[" + v.map(fmt).join(", ") + "]";
  if (typeof v === "object") { try { return JSON.stringify(v); } catch { return String(v); } }
  return String(v);
}

// ── Python simulator ──────────────────────────────────────
// Handles: print, variables, if/elif/else, for/while,
//          functions (def), lists, dicts, f-strings,
//          range(), len(), sum(), max(), min(), type(),
//          list methods: append/insert/remove/sort/pop/reverse
function runPython(src) {
  const lines = src.replace(/\r/g, "").split("\n");
  const output = [];
  const env = Object.create(null);

  // ── helpers ──
  function pyStr(v) {
    if (v === null || v === undefined) return "None";
    if (v === true)  return "True";
    if (v === false) return "False";
    if (Array.isArray(v)) return "[" + v.map(x => typeof x === "string" ? `'${x}'` : pyStr(x)).join(", ") + "]";
    if (typeof v === "object") {
      return "{" + Object.entries(v).map(([k, val]) => `'${k}': ${pyStr(val)}`).join(", ") + "}";
    }
    return String(v);
  }

  // Split comma args respecting brackets and quotes
  function splitArgs(s) {
    const parts = []; let depth = 0, cur = "", inStr = false, sc = "";
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inStr) { cur += c; if (c === sc && s[i-1] !== "\\") inStr = false; continue; }
      if (c === '"' || c === "'") { inStr = true; sc = c; cur += c; continue; }
      if (c === "[" || c === "{" || c === "(") { depth++; cur += c; continue; }
      if (c === "]" || c === "}" || c === ")") { depth--; cur += c; continue; }
      if (c === "," && depth === 0) { parts.push(cur.trim()); cur = ""; continue; }
      cur += c;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts;
  }

  // Evaluate a Python expression using current env
  function evalExpr(expr, localEnv) {
    expr = expr.trim();
    const scope = localEnv || env;

    // f-string
    if (/^f["']/.test(expr)) {
      const q = expr[1]; const inner = expr.slice(2, -1);
      return inner.replace(/\{([^}]+)\}/g, (_, e) => pyStr(evalExpr(e.trim(), scope)));
    }
    // String literals
    if ((expr.startsWith('"') && expr.endsWith('"')) ||
        (expr.startsWith("'") && expr.endsWith("'")))
      return expr.slice(1, -1);
    // Booleans / None
    if (expr === "True")  return true;
    if (expr === "False") return false;
    if (expr === "None")  return null;
    // Number literals
    if (/^-?\d+(\.\d+)?$/.test(expr)) return Number(expr);

    // Built-in calls
    const biMatch = /^(\w+)\((.*)?\)$/.exec(expr);
    if (biMatch) {
      const fn = biMatch[1], raw = biMatch[2] || "";
      if (fn === "len")   { const v = evalExpr(raw, scope); return Array.isArray(v) ? v.length : String(v).length; }
      if (fn === "int")   return Math.trunc(Number(evalExpr(raw, scope)));
      if (fn === "float") return Number(evalExpr(raw, scope));
      if (fn === "str")   return pyStr(evalExpr(raw, scope));
      if (fn === "bool")  { const v = evalExpr(raw, scope); return Boolean(v); }
      if (fn === "abs")   return Math.abs(Number(evalExpr(raw, scope)));
      if (fn === "type")  {
        const v = evalExpr(raw, scope);
        const t = v === null ? "NoneType" : v === true || v === false ? "bool" :
                  Array.isArray(v) ? "list" : typeof v === "object" ? "dict" :
                  typeof v === "number" ? (Number.isInteger(v) ? "int" : "float") : "str";
        return `<class '${t}'>`;
      }
      if (fn === "range") {
        const args = splitArgs(raw).map(a => Number(evalExpr(a, scope)));
        const [s, e, st] = args.length === 1 ? [0, args[0], 1] : args.length === 2 ? [args[0], args[1], 1] : args;
        const r = [];
        if (st > 0) for (let i = s; i < e; i += st) r.push(i);
        else        for (let i = s; i > e; i += st) r.push(i);
        return r;
      }
      if (fn === "sum")   { const v = evalExpr(raw, scope); return Array.isArray(v) ? v.reduce((a,b)=>a+b,0) : 0; }
      if (fn === "max")   { const v = evalExpr(raw, scope); return Array.isArray(v) ? Math.max(...v) : Number(v); }
      if (fn === "min")   { const v = evalExpr(raw, scope); return Array.isArray(v) ? Math.min(...v) : Number(v); }
      if (fn === "sorted"){ const v = evalExpr(raw, scope); return Array.isArray(v) ? [...v].sort((a,b)=>a-b) : []; }
      if (fn === "list")  { const v = evalExpr(raw, scope); return Array.isArray(v) ? [...v] : []; }
      if (fn === "print") { // nested print inside expr (rare but handle)
        const parts = splitArgs(raw).map(a => pyStr(evalExpr(a, scope)));
        output.push(parts.join(" ")); return null;
      }
      if (fn === "enumerate") {
        const v = evalExpr(raw, scope);
        return Array.isArray(v) ? v.map((item,i)=>[i,item]) : [];
      }
      if (fn === "zip") {
        const args = splitArgs(raw).map(a => evalExpr(a, scope));
        const len = Math.min(...args.map(a=>Array.isArray(a)?a.length:0));
        return Array.from({length:len}, (_,i)=>args.map(a=>a[i]));
      }
      // User-defined function call
      if (scope[fn] && typeof scope[fn] === "function") {
        const args = splitArgs(raw).map(a => evalExpr(a, scope));
        return scope[fn](...args);
      }
      if (env[fn] && typeof env[fn] === "function") {
        const args = splitArgs(raw).map(a => evalExpr(a, scope));
        return env[fn](...args);
      }
    }

    // List literal
    if (expr.startsWith("[") && expr.endsWith("]")) {
      const inner = expr.slice(1, -1).trim();
      return inner ? splitArgs(inner).map(x => evalExpr(x, scope)) : [];
    }
    // Dict literal
    if (expr.startsWith("{") && expr.endsWith("}")) {
      const inner = expr.slice(1, -1).trim();
      if (!inner) return {};
      const obj = {};
      splitArgs(inner).forEach(pair => {
        const ci = pair.indexOf(":");
        if (ci < 0) return;
        const k = evalExpr(pair.slice(0, ci).trim(), scope);
        const v = evalExpr(pair.slice(ci + 1).trim(), scope);
        obj[String(k)] = v;
      });
      return obj;
    }
    // Subscript: var[index]
    const subMatch = /^(.+)\[(.+)\]$/.exec(expr);
    if (subMatch) {
      const base = evalExpr(subMatch[1], scope);
      const key  = evalExpr(subMatch[2], scope);
      if (Array.isArray(base)) return base[key < 0 ? base.length + key : key];
      if (typeof base === "object" && base !== null) return base[String(key)];
      if (typeof base === "string") return base[key < 0 ? base.length + key : key];
      return undefined;
    }
    // Attribute / method: obj.attr
    const dotMatch = /^(\w+)\.(\w+)$/.exec(expr);
    if (dotMatch) {
      const obj = scope[dotMatch[1]] ?? env[dotMatch[1]];
      if (dotMatch[2] === "length" && Array.isArray(obj)) return obj.length;
      if (dotMatch[2] === "lower"  && typeof obj === "string") return () => obj.toLowerCase();
      if (dotMatch[2] === "upper"  && typeof obj === "string") return () => obj.toUpperCase();
      return undefined;
    }
    // Variable lookup
    if (/^\w+$/.test(expr)) return scope[expr] ?? env[expr];

    // Arithmetic / comparison — safe JS eval with variable substitution
    let js = expr
      .replace(/\*\*/g, "**")
      .replace(/\band\b/g, "&&").replace(/\bor\b/g, "||").replace(/\bnot\b/g, "!")
      .replace(/\bTrue\b/g, "true").replace(/\bFalse\b/g, "false").replace(/\bNone\b/g, "null");

    // Substitute vars (longest first to avoid partial matches)
    const allVars = { ...env, ...(localEnv||{}) };
    Object.keys(allVars).sort((a,b)=>b.length-a.length).forEach(name => {
      const v = allVars[name];
      if (typeof v === "function") return;
      const sub = typeof v === "string" ? JSON.stringify(v)
                : Array.isArray(v) ? JSON.stringify(v)
                : v === null ? "null" : String(v);
      js = js.replace(new RegExp("\\b" + name + "\\b", "g"), sub);
    });

    try { return new Function('"use strict"; return (' + js + ")")(); }
    catch { return expr; }
  }

  // ── Collect indented block ──
  function getBlock(srcLines, startI) {
    const block = []; let j = startI;
    while (j < srcLines.length) {
      const raw = srcLines[j];
      if (!raw.trim() || raw.startsWith("    ") || raw.startsWith("\t")) {
        if (raw.trim()) block.push(raw.replace(/^    /, "").replace(/^\t/, ""));
        j++;
      } else break;
    }
    return { block, end: j };
  }

  // ── Execute a list of lines in a given env ──
  function execLines(srcLines, localEnv, maxOps) {
    let ops = maxOps || 0;
    let i = 0;
    while (i < srcLines.length && ops < 800) {
      ops++;
      const rawLine = srcLines[i];
      const line    = rawLine.trim();
      if (!line || line.startsWith("#")) { i++; continue; }

      // print(...)
      if (/^print\s*\(/.test(line)) {
        const inner = line.slice(line.indexOf("(")+1, line.lastIndexOf(")"));
        const sep   = " ";
        const parts = inner ? splitArgs(inner).map(a => pyStr(evalExpr(a, localEnv))) : [];
        output.push(parts.join(sep));
        i++; continue;
      }

      // return
      if (/^return(\s|$)/.test(line)) {
        const expr = line.slice(6).trim();
        const val  = expr ? evalExpr(expr, localEnv) : null;
        throw { __return: val };
      }

      // break / continue
      if (line === "break")    throw { __break: true };
      if (line === "continue") throw { __continue: true };

      // for VAR in EXPR:
      const forM = /^for\s+(.+)\s+in\s+(.+):$/.exec(line);
      if (forM) {
        const varPart  = forM[1].trim();
        const iterable = evalExpr(forM[2], localEnv);
        const items    = Array.isArray(iterable) ? iterable : [];
        const { block, end } = getBlock(srcLines, i + 1);
        for (const item of items) {
          if (ops++ > 800) break;
          // Tuple/list unpacking: for k, v in …
          if (varPart.includes(",")) {
            const vars = varPart.split(",").map(v=>v.trim());
            vars.forEach((v,idx)=>{ localEnv[v] = Array.isArray(item)?item[idx]:item; });
          } else {
            localEnv[varPart] = item;
          }
          try { execLines(block, localEnv, ops); }
          catch(e) {
            if (e && e.__break)    break;
            if (e && e.__continue) continue;
            if (e && e.__return)   throw e;
          }
        }
        i = end; continue;
      }

      // while EXPR:
      const whileM = /^while\s+(.+):$/.exec(line);
      if (whileM) {
        const { block, end } = getBlock(srcLines, i + 1);
        let safety = 0;
        while (evalExpr(whileM[1], localEnv) && safety++ < 400 && ops++ < 800) {
          try { execLines(block, localEnv, ops); }
          catch(e) {
            if (e && e.__break)    break;
            if (e && e.__continue) continue;
            if (e && e.__return)   throw e;
          }
        }
        i = end; continue;
      }

      // def FUNCNAME(...):
      const defM = /^def\s+(\w+)\s*\(([^)]*)\)\s*:$/.exec(line);
      if (defM) {
        const fname  = defM[1];
        const params = defM[2] ? defM[2].split(",").map(p=>p.trim()).filter(Boolean) : [];
        const { block, end } = getBlock(srcLines, i + 1);
        // Parse default values from params
        const paramDefs = params.map(p => {
          const eq = p.indexOf("=");
          if (eq >= 0) return { name: p.slice(0,eq).trim(), def: p.slice(eq+1).trim() };
          return { name: p, def: null };
        });
        const capturedEnv = { ...localEnv };
        localEnv[fname] = function(...args) {
          const fnEnv = { ...capturedEnv };
          paramDefs.forEach((pd, idx) => {
            fnEnv[pd.name] = args[idx] !== undefined ? args[idx]
                           : pd.def ? evalExpr(pd.def, fnEnv) : null;
          });
          try { execLines(block, fnEnv, 0); return null; }
          catch(e) {
            if (e && e.__return !== undefined) return e.__return;
            throw e;
          }
        };
        env[fname] = localEnv[fname];
        i = end; continue;
      }

      // if / elif / else chain
      if (/^(if|elif|else)\b/.test(line)) {
        const chain = [];
        let j = i;
        while (j < srcLines.length) {
          const bl = srcLines[j].trim();
          let cond = null;
          if      (/^if\s+(.+):$/.test(bl))   cond = RegExp.$1;
          else if (/^elif\s+(.+):$/.test(bl))  cond = RegExp.$1;
          else if (/^else\s*:$/.test(bl))       cond = "__else__";
          else break;
          const { block, end } = getBlock(srcLines, j + 1);
          chain.push({ cond, block }); j = end;
          if (cond === "__else__") break;
        }
        for (const { cond, block } of chain) {
          if (cond === "__else__" || evalExpr(cond, localEnv)) {
            execLines(block, localEnv, ops); break;
          }
        }
        i = j; continue;
      }

      // class (skip body gracefully)
      if (/^class\s/.test(line)) {
        const { end } = getBlock(srcLines, i + 1);
        i = end; continue;
      }

      // import / from (skip)
      if (/^(import|from)\s/.test(line)) { i++; continue; }

      // try/except (run try, skip except)
      if (/^try\s*:$/.test(line)) {
        const { block: tryBlock, end: tryEnd } = getBlock(srcLines, i + 1);
        try { execLines(tryBlock, localEnv, ops); }
        catch(e) { if (e && (e.__return || e.__break || e.__continue)) throw e; }
        let j2 = tryEnd;
        while (j2 < srcLines.length && /^\s*(except|else|finally)/.test(srcLines[j2])) {
          const { end } = getBlock(srcLines, j2 + 1);
          j2 = end;
        }
        i = j2; continue;
      }

      // Method calls: obj.method(args)
      const methM = /^(\w+)\.(append|insert|remove|sort|reverse|pop|push_back|extend|clear|update)\s*\((.*)?\)$/.exec(line);
      if (methM) {
        const [, objName, method, rawArgs] = methM;
        const obj = localEnv[objName] ?? env[objName];
        const argList = rawArgs ? splitArgs(rawArgs).map(a=>evalExpr(a,localEnv)) : [];
        if (Array.isArray(obj)) {
          if (method === "append" || method === "push_back") obj.push(argList[0]);
          else if (method === "insert")  obj.splice(argList[0], 0, argList[1]);
          else if (method === "remove")  { const idx=obj.indexOf(argList[0]); if(idx>-1)obj.splice(idx,1); }
          else if (method === "sort")    obj.sort((a,b)=>typeof a==="string"?a.localeCompare(b):a-b);
          else if (method === "reverse") obj.reverse();
          else if (method === "pop")     obj.pop();
          else if (method === "clear")   obj.splice(0);
          else if (method === "extend")  { const ext=argList[0]; if(Array.isArray(ext)) ext.forEach(x=>obj.push(x)); }
        } else if (typeof obj === "object" && obj !== null) {
          if (method === "update") Object.assign(obj, argList[0]);
          if (method === "clear")  Object.keys(obj).forEach(k=>delete obj[k]);
        }
        i++; continue;
      }

      // Compound assignment: obj[key] = val
      const idxAssign = /^(\w+)\[(.+)\]\s*=\s*(.+)$/.exec(line);
      if (idxAssign) {
        const [, objName, keyExpr, valExpr] = idxAssign;
        const obj = localEnv[objName] ?? env[objName];
        const key = evalExpr(keyExpr, localEnv);
        const val = evalExpr(valExpr, localEnv);
        if (Array.isArray(obj)) obj[key] = val;
        else if (typeof obj === "object" && obj !== null) obj[String(key)] = val;
        i++; continue;
      }

      // del obj[key] / del var
      if (/^del\s+/.test(line)) {
        const target = line.slice(4).trim();
        const dm = /^(\w+)\[(.+)\]$/.exec(target);
        if (dm) {
          const obj = localEnv[dm[1]] ?? env[dm[1]];
          const key = evalExpr(dm[2], localEnv);
          if (Array.isArray(obj)) obj.splice(key,1);
          else if (obj) delete obj[String(key)];
        } else {
          delete localEnv[target]; delete env[target];
        }
        i++; continue;
      }

      // Variable assignment (simple or augmented)
      // Handles: a = expr  |  a += expr  |  a, b = x, y
      const augM = /^(\w+)\s*([\+\-\*\/\%\*\*\/\/]?=)\s*(.+)$/.exec(line);
      if (augM && augM[2] !== "==" && augM[2] !== "!=") {
        const [, name, op, exprStr] = augM;
        let val = evalExpr(exprStr, localEnv);
        if (op !== "=") {
          const cur = localEnv[name] ?? env[name] ?? 0;
          const o = op[0];
          if (o==="+") val = typeof cur==="string"||typeof val==="string" ? String(cur)+String(val) : cur+val;
          else if(o==="-") val=cur-val; else if(o==="*") val=cur*val;
          else if(o==="/") val=cur/val; else if(o==="%") val=cur%val;
        }
        localEnv[name] = val; env[name] = val;
        i++; continue;
      }

      // Tuple unpacking: a, b = expr  or  a, b = v1, v2
      const tupleM = /^([\w\s,]+)\s*=\s*(.+)$/.exec(line);
      if (tupleM && tupleM[1].includes(",")) {
        const names = tupleM[1].split(",").map(n=>n.trim());
        const rhs   = tupleM[2].trim();
        const vals  = rhs.includes(",")
          ? splitArgs(rhs).map(a => evalExpr(a, localEnv))
          : (() => { const v = evalExpr(rhs, localEnv); return Array.isArray(v) ? v : [v]; })();
        names.forEach((n,idx)=>{ localEnv[n]=vals[idx]; env[n]=vals[idx]; });
        i++; continue;
      }

      // Standalone expression (function call with side effects)
      if (/^\w+\s*\(/.test(line) || /^\w+\.\w+\s*\(/.test(line)) {
        try { evalExpr(line, localEnv); } catch {}
      }

      i++;
    }
  }

  try { execLines(lines, env, 0); }
  catch(e) { if (e && e.__return === undefined) output.push("⚠ " + String(e)); }

  return output.join("\n") || "(no output)";
}

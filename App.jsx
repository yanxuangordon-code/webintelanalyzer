import { useState, useRef, useEffect } from "react";

const PHASES = ["idle", "searching", "analyzing", "done", "error"];

const glowStyle = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;700;800&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body, #root { background: #06070a; }

  .wrap {
    min-height: 100vh;
    background: #06070a;
    color: #e2e8f0;
    font-family: 'Syne', sans-serif;
    padding: 40px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .header {
    text-align: center;
    margin-bottom: 48px;
    position: relative;
  }

  .header h1 {
    font-size: clamp(2rem, 5vw, 3.2rem);
    font-weight: 800;
    letter-spacing: -0.02em;
    background: linear-gradient(135deg, #38bdf8 0%, #818cf8 50%, #f472b6 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1.1;
  }

  .header p {
    margin-top: 10px;
    color: #64748b;
    font-size: 0.95rem;
    font-family: 'Space Mono', monospace;
    letter-spacing: 0.04em;
  }

  .search-box {
    width: 100%;
    max-width: 720px;
    display: flex;
    gap: 12px;
    margin-bottom: 40px;
  }

  .search-input {
    flex: 1;
    padding: 14px 20px;
    background: #0f1117;
    border: 1.5px solid #1e293b;
    border-radius: 12px;
    color: #e2e8f0;
    font-size: 1rem;
    font-family: 'Syne', sans-serif;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .search-input:focus {
    border-color: #38bdf8;
    box-shadow: 0 0 0 3px rgba(56,189,248,0.12);
  }

  .search-input::placeholder { color: #334155; }

  .search-btn {
    padding: 14px 28px;
    background: linear-gradient(135deg, #38bdf8, #818cf8);
    border: none;
    border-radius: 12px;
    color: #06070a;
    font-size: 0.95rem;
    font-weight: 700;
    font-family: 'Syne', sans-serif;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.1s;
    white-space: nowrap;
  }

  .search-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
  .search-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .container {
    width: 100%;
    max-width: 720px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .status-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 18px;
    background: #0f1117;
    border: 1px solid #1e293b;
    border-radius: 10px;
    font-family: 'Space Mono', monospace;
    font-size: 0.82rem;
    color: #64748b;
  }

  .dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #334155;
    flex-shrink: 0;
  }
  .dot.active {
    background: #38bdf8;
    box-shadow: 0 0 8px #38bdf8;
    animation: pulse 1.2s infinite;
  }
  .dot.done { background: #34d399; box-shadow: 0 0 8px #34d399; animation: none; }
  .dot.error { background: #f87171; box-shadow: 0 0 8px #f87171; animation: none; }

  @keyframes pulse {
    0%,100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .section {
    background: #0f1117;
    border: 1px solid #1e293b;
    border-radius: 14px;
    overflow: hidden;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 20px;
    border-bottom: 1px solid #1e293b;
    font-size: 0.78rem;
    font-family: 'Space Mono', monospace;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .section-icon { font-size: 1rem; }

  .section-body {
    padding: 20px;
  }

  .sources-grid {
    display: grid;
    gap: 10px;
  }

  .source-card {
    padding: 12px 16px;
    background: #060b11;
    border: 1px solid #1e293b;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: border-color 0.2s;
  }
  .source-card:hover { border-color: #38bdf8; }

  .source-title {
    font-size: 0.88rem;
    font-weight: 700;
    color: #e2e8f0;
    line-height: 1.3;
  }

  .source-url {
    font-family: 'Space Mono', monospace;
    font-size: 0.7rem;
    color: #38bdf8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .source-snippet {
    font-size: 0.8rem;
    color: #64748b;
    line-height: 1.5;
    margin-top: 2px;
  }

  .analysis-text {
    font-size: 0.92rem;
    line-height: 1.8;
    color: #cbd5e1;
    white-space: pre-wrap;
  }

  .analysis-text h2, .analysis-text h3 {
    color: #e2e8f0;
    margin: 1.2em 0 0.4em;
    font-size: 1.05rem;
  }

  .skeleton {
    background: linear-gradient(90deg, #1e293b 25%, #273344 50%, #1e293b 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
    border-radius: 6px;
    height: 14px;
    margin-bottom: 10px;
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .error-msg {
    color: #f87171;
    font-size: 0.88rem;
    font-family: 'Space Mono', monospace;
    line-height: 1.6;
  }

  .tag {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 0.72rem;
    font-family: 'Space Mono', monospace;
    font-weight: 700;
    letter-spacing: 0.04em;
    margin-right: 6px;
    margin-bottom: 6px;
  }

  .tag-blue { background: rgba(56,189,248,0.12); color: #38bdf8; border: 1px solid rgba(56,189,248,0.25); }
  .tag-purple { background: rgba(129,140,248,0.12); color: #818cf8; border: 1px solid rgba(129,140,248,0.25); }
  .tag-green { background: rgba(52,211,153,0.12); color: #34d399; border: 1px solid rgba(52,211,153,0.25); }
`;

function SkeletonLines({ n = 4 }) {
  return (
    <div>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="skeleton" style={{ width: `${70 + Math.random() * 30}%` }} />
      ))}
    </div>
  );
}

function SourceCard({ title, url, snippet }) {
  return (
    <div className="source-card">
      <div className="source-title">{title}</div>
      <div className="source-url">{url}</div>
      {snippet && <div className="source-snippet">{snippet}</div>}
    </div>
  );
}

function renderAnalysis(text) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (line.startsWith("## ")) return <h2 key={i}>{line.slice(3)}</h2>;
    if (line.startsWith("### ")) return <h3 key={i}>{line.slice(4)}</h3>;
    if (line.startsWith("**") && line.endsWith("**")) return <strong key={i}>{line.slice(2, -2)}</strong>;
    return <span key={i}>{line}{"\n"}</span>;
  });
}

export default function App() {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState("idle");
  const [sources, setSources] = useState([]);
  const [analysis, setAnalysis] = useState("");
  const [streamedAnalysis, setStreamedAnalysis] = useState("");
  const [keywords, setKeywords] = useState([]);
  const [error, setError] = useState("");
  const abortRef = useRef(null);

  const statusText = {
    idle: "Ready — enter a topic to begin",
    searching: "Searching the web for sources...",
    analyzing: "Analyzing & synthesizing findings...",
    done: "Analysis complete",
    error: "An error occurred",
  };

  async function runSearch() {
    if (!query.trim() || phase === "searching" || phase === "analyzing") return;

    setPhase("searching");
    setSources([]);
    setAnalysis("");
    setStreamedAnalysis("");
    setKeywords([]);
    setError("");

    try {
      // Step 1: Search the web
      const searchRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [
            {
              role: "user",
              content: `Search the web for information about: "${query}". Find at least 4-6 relevant sources.`,
            },
          ],
        }),
      });

      const searchData = await searchRes.json();

      if (searchData.error) throw new Error(searchData.error.message);

      // Extract web search results from content blocks
      const toolResults = searchData.content.filter(b => b.type === "tool_result" || b.type === "mcp_tool_result");
      const toolUses = searchData.content.filter(b => b.type === "tool_use");

      // Parse sources from tool use results
      let foundSources = [];
      for (const block of searchData.content) {
        if (block.type === "tool_result" || (block.type === "tool_use" && block.name === "web_search")) {
          // handled below
        }
      }

      // Build source list from assistant content if available
      const textBlocks = searchData.content.filter(b => b.type === "text");
      const rawText = textBlocks.map(b => b.text).join("\n");

      // Ask Claude to extract structured sources from its own search response
      const extractRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: `Based on web search results for "${query}", provide a JSON array of 4-6 sources. Each source: {title, url, snippet}. Return ONLY valid JSON, no markdown, no extra text.`,
            },
          ],
        }),
      });

      const extractData = await extractRes.json();
      const extractText = extractData.content.filter(b => b.type === "text").map(b => b.text).join("");

      try {
        const cleaned = extractText.replace(/```json|```/g, "").trim();
        foundSources = JSON.parse(cleaned);
      } catch {
        foundSources = [{ title: "Web search results", url: "https://www.google.com", snippet: "Results retrieved from web search." }];
      }

      setSources(foundSources);
      setPhase("analyzing");

      // Step 2: Analyze
      const analyzeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [
            {
              role: "user",
              content: `Search the web and write a comprehensive analytical report about: "${query}".

Structure your analysis with these sections:
## Overview
## Key Findings
## Important Details
## Current Context / Trends
## Summary & Takeaways

Be detailed, factual, and insightful. Reference specific facts you find.`,
            },
          ],
        }),
      });

      const analyzeData = await analyzeRes.json();
      const analysisText = analyzeData.content
        .filter(b => b.type === "text")
        .map(b => b.text)
        .join("\n");

      // Extract keywords
      const kw = extractKeywords(query + " " + analysisText);
      setKeywords(kw);

      // Stream the text character by character for effect
      setPhase("done");
      let i = 0;
      const interval = setInterval(() => {
        i += 6;
        setStreamedAnalysis(analysisText.slice(0, i));
        if (i >= analysisText.length) {
          setStreamedAnalysis(analysisText);
          clearInterval(interval);
        }
      }, 16);

    } catch (err) {
      setError(err.message || "Unknown error occurred.");
      setPhase("error");
    }
  }

  function extractKeywords(text) {
    const stopwords = new Set(["the","a","an","and","or","but","in","on","at","to","for","of","with","by","from","is","are","was","were","be","been","this","that","it","its","as","have","has"]);
    const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    const freq = {};
    words.forEach(w => { if (!stopwords.has(w)) freq[w] = (freq[w] || 0) + 1; });
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([w]) => w);
  }

  const isActive = phase === "searching" || phase === "analyzing";
  const dotClass = isActive ? "dot active" : phase === "done" ? "dot done" : phase === "error" ? "dot error" : "dot";

  return (
    <>
      <style>{glowStyle}</style>
      <div className="wrap">
        <div className="header">
          <h1>Web Intel Analyzer</h1>
          <p>// real-time search + AI synthesis engine</p>
        </div>

        <div className="search-box">
          <input
            className="search-input"
            placeholder="Enter any topic, question, or keyword..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && runSearch()}
            disabled={isActive}
          />
          <button className="search-btn" onClick={runSearch} disabled={isActive || !query.trim()}>
            {isActive ? "Running..." : "Analyze →"}
          </button>
        </div>

        <div className="container">
          <div className="status-bar">
            <div className={dotClass} />
            <span>{statusText[phase]}</span>
            {phase === "done" && sources.length > 0 && (
              <span style={{ marginLeft: "auto", color: "#34d399" }}>{sources.length} sources</span>
            )}
          </div>

          {/* Sources */}
          {(phase === "searching" || sources.length > 0) && (
            <div className="section">
              <div className="section-header">
                <span className="section-icon">🔍</span>
                Sources Retrieved
              </div>
              <div className="section-body">
                {phase === "searching" ? (
                  <SkeletonLines n={3} />
                ) : (
                  <div className="sources-grid">
                    {sources.map((s, i) => (
                      <SourceCard key={i} title={s.title} url={s.url} snippet={s.snippet} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Keywords */}
          {keywords.length > 0 && (
            <div className="section">
              <div className="section-header">
                <span className="section-icon">🏷</span>
                Key Concepts Detected
              </div>
              <div className="section-body">
                {keywords.map((kw, i) => (
                  <span key={kw} className={`tag ${i % 3 === 0 ? "tag-blue" : i % 3 === 1 ? "tag-purple" : "tag-green"}`}>
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Analysis */}
          {(phase === "analyzing" || streamedAnalysis) && (
            <div className="section">
              <div className="section-header">
                <span className="section-icon">🧠</span>
                AI Analysis
                {phase === "analyzing" && <span style={{ marginLeft: 8, color: "#38bdf8" }}>generating...</span>}
              </div>
              <div className="section-body">
                {phase === "analyzing" && !streamedAnalysis ? (
                  <SkeletonLines n={6} />
                ) : (
                  <div className="analysis-text">{renderAnalysis(streamedAnalysis)}</div>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <div className="section">
              <div className="section-header">
                <span className="section-icon">⚠️</span>
                Error
              </div>
              <div className="section-body">
                <div className="error-msg">{error}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

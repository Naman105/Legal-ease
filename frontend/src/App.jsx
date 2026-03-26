// =============================================================================
//  Legal-Ease — Frontend  (React + Vite)
//  STYLING ONLY UPDATE — Dark mesh gradient + 3D hover effects
//  All logic/data/API code unchanged
// =============================================================================

import { useState, useRef, useCallback, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import pdfWorker from "pdfjs-dist/build/pdf.worker?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const API_BASE = "http://127.0.0.1:8000";
const API_KEY  = "legal-ease-secret-123";
const HEADERS  = { "X-API-Key": API_KEY };

const LANGUAGES = [
  { code: "hi", label: "हिन्दी",   name: "Hindi",    flag: "🇮🇳" },
  { code: "ta", label: "தமிழ்",    name: "Tamil",    flag: "🇮🇳" },
  { code: "te", label: "తెలుగు",   name: "Telugu",   flag: "🇮🇳" },
  { code: "mr", label: "मराठी",    name: "Marathi",  flag: "🇮🇳" },
  { code: "kn", label: "ಕನ್ನಡ",    name: "Kannada",  flag: "🇮🇳" },
  { code: "gu", label: "ગુજરાતી",  name: "Gujarati", flag: "🇮🇳" },
  { code: "bn", label: "বাংলা",    name: "Bengali",  flag: "🇮🇳" },
  { code: "pa", label: "ਪੰਜਾਬੀ",  name: "Punjabi",  flag: "🇮🇳" },
];

const LANG_BCP47 = {
  hi:"hi-IN", ta:"ta-IN", te:"te-IN", mr:"mr-IN",
  kn:"kn-IN", gu:"gu-IN", bn:"bn-IN", pa:"pa-IN",
};

const RISK_CFG = {
  High:   { color:"#EF4444", bg:"rgba(239,68,68,0.12)", border:"rgba(239,68,68,0.3)", dark:"#DC2626" },
  Medium: { color:"#F59E0B", bg:"rgba(245,158,11,0.12)", border:"rgba(245,158,11,0.3)", dark:"#D97706" },
  Low:    { color:"#22C55E", bg:"rgba(34,197,94,0.12)", border:"rgba(34,197,94,0.3)", dark:"#059669" },
};

// ── GLOBAL CSS ────────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Noto+Sans+Devanagari:wght@400;700;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  /* RICH COLOR OVERRIDES */

  body {
    background: #06061a;
    font-family: 'Inter', 'Noto Sans Devanagari', system-ui, sans-serif;
    overflow-x: hidden;
  }

  /* ── Mesh background ── */
  .mesh-bg {
    background: #06061a;
    position: relative;
  }
  .mesh-bg::before {
    content: '';
    position: fixed;
    inset: 0;
    background:
      radial-gradient(ellipse 75% 65% at 15% 15%, rgba(109,40,217,0.80) 0%, transparent 55%),
      radial-gradient(ellipse 55% 70% at 85% 8%,  rgba(219,39,119,0.70) 0%, transparent 50%),
      radial-gradient(ellipse 65% 55% at 55% 88%, rgba(37,99,235,0.50)  0%, transparent 55%),
      radial-gradient(ellipse 45% 65% at 92% 55%, rgba(5,150,105,0.30)  0%, transparent 45%),
      radial-gradient(ellipse 70% 40% at 8%  72%, rgba(185,28,28,0.28)  0%, transparent 48%);
    pointer-events: none;
    z-index: 0;
    animation: meshShift 20s ease-in-out infinite alternate;
  }
  @keyframes meshShift {
    0%   { opacity: 1;    transform: scale(1)    rotate(0deg); }
    33%  { opacity: 0.9;  transform: scale(1.03) rotate(0.8deg); }
    66%  { opacity: 0.95; transform: scale(1.05) rotate(-0.5deg); }
    100% { opacity: 1;    transform: scale(1)    rotate(0deg); }
  }

  /* ── Noise overlay ── */
  .mesh-bg::after {
    content: '';
    position: fixed;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 0;
    opacity: 0.5;
  }

  /* ── Content above mesh ── */
  .above-mesh { position: relative; z-index: 1; }

  /* ── Keyframes ── */
  @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
  @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes pulse   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.98)} }
  @keyframes floatY  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
  @keyframes glow    { 0%,100%{box-shadow:0 0 20px rgba(139,92,246,0.3)} 50%{box-shadow:0 0 40px rgba(139,92,246,0.6),0 0 80px rgba(236,72,153,0.2)} }
  @keyframes borderGlow { 0%,100%{border-color:rgba(139,92,246,0.3)} 50%{border-color:rgba(236,72,153,0.5)} }
  @keyframes slideIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes twinkle { 0%,100%{opacity:0.1;transform:scale(1)} 50%{opacity:0.7;transform:scale(1.5)} }

  /* ── Gold shimmer text ── */
  .gold-text {
    background: linear-gradient(90deg, #f59e0b, #fbbf24, #fcd34d, #f59e0b);
    background-size: 250% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: shimmer 2.5s linear infinite;
    filter: drop-shadow(0 0 12px rgba(251,191,36,0.5));
  }
  .purple-text {
    background: linear-gradient(90deg, #c084fc, #e879f9, #f0abfc, #c084fc);
    background-size: 250% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: shimmer 2.5s linear infinite;
    filter: drop-shadow(0 0 16px rgba(192,132,252,0.55));
  }

  /* ── Glass card ── */
  .glass-card {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 20px;
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    transition: all 0.4s cubic-bezier(0.4,0,0.2,1);
    transform-style: preserve-3d;
  }
  .glass-card:hover {
    background: rgba(255,255,255,0.09);
    border-color: rgba(167,139,250,0.55);
    transform: translateY(-7px) rotateX(-2deg) rotateY(2deg);
    box-shadow: 0 30px 70px rgba(0,0,0,0.6), 0 0 40px rgba(109,40,217,0.25), inset 0 1px 0 rgba(255,255,255,0.15);
  }

  /* ── Feature card 3D ── */
  .feat-card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 18px;
    padding: 1.5rem;
    backdrop-filter: blur(20px);
    transition: all 0.35s cubic-bezier(0.4,0,0.2,1);
    cursor: default;
    perspective: 800px;
  }
  .feat-card:hover {
    background: rgba(255,255,255,0.09);
    border-color: rgba(167,139,250,0.6);
    transform: translateY(-10px) scale(1.03) rotateX(-3deg);
    box-shadow: 0 35px 80px rgba(0,0,0,0.6), 0 0 50px rgba(109,40,217,0.3), inset 0 1px 0 rgba(255,255,255,0.12);
  }
  .feat-card:hover .feat-icon {
    animation: floatY 2s ease-in-out infinite;
    filter: drop-shadow(0 0 16px rgba(192,132,252,0.8));
  }

  /* ── Nav glass ── */
  .nav-glass {
    background: rgba(6,6,26,0.82);
    backdrop-filter: blur(28px);
    -webkit-backdrop-filter: blur(28px);
    border-bottom: 1px solid rgba(255,255,255,0.09);
    box-shadow: 0 1px 0 rgba(109,40,217,0.3), 0 4px 24px rgba(0,0,0,0.4);
    position: sticky; top: 0; z-index: 100;
    height: 64px;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 2rem;
  }

  /* ── Primary button ── */
  .btn-primary {
    background: linear-gradient(135deg, #6d28d9, #9333ea, #db2777, #ec4899);
    background-size: 300% 300%;
    border: none; border-radius: 12px;
    padding: 12px 28px;
    color: white; font-weight: 700; font-size: 14px;
    cursor: pointer; display: inline-flex; align-items: center; gap: 8px;
    transition: all 0.3s;
    box-shadow: 0 4px 24px rgba(109,40,217,0.55), 0 0 0 1px rgba(255,255,255,0.08);
    animation: shimmer 4s linear infinite;
    position: relative; overflow: hidden;
  }
  .btn-primary::before {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.18), transparent 60%);
    opacity: 0; transition: opacity 0.3s;
  }
  .btn-primary:hover {
    transform: translateY(-3px) scale(1.03);
    box-shadow: 0 16px 48px rgba(109,40,217,0.65), 0 0 80px rgba(219,39,119,0.35), 0 0 0 1px rgba(255,255,255,0.12);
  }
  .btn-primary:hover::before { opacity: 1; }

  /* ── Outline button ── */
  .btn-outline {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 12px;
    padding: 12px 24px;
    color: rgba(255,255,255,0.85); font-weight: 600; font-size: 14px;
    cursor: pointer; display: inline-flex; align-items: center; gap: 8px;
    backdrop-filter: blur(8px);
    transition: all 0.3s;
  }
  .btn-outline:hover {
    background: rgba(139,92,246,0.12);
    border-color: rgba(139,92,246,0.5);
    color: white;
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(139,92,246,0.2);
  }

  /* ── Voice button ── */
  .btn-voice {
    background: rgba(139,92,246,0.1);
    border: 1px solid rgba(139,92,246,0.25);
    border-radius: 9px; padding: 7px 14px;
    color: #a78bfa; font-weight: 600; font-size: 12px;
    cursor: pointer; display: inline-flex; align-items: center; gap: 5px;
    transition: all 0.25s;
  }
  .btn-voice:hover {
    background: rgba(139,92,246,0.2);
    border-color: rgba(139,92,246,0.5);
    box-shadow: 0 0 16px rgba(139,92,246,0.25);
  }

  /* ── Tab buttons ── */
  .tab-btn {
    flex: 1; min-width: 110px;
    padding: 10px 14px; border-radius: 10px; border: none;
    font-weight: 600; font-size: 13px; cursor: pointer;
    transition: all 0.25s; white-space: nowrap;
    color: rgba(255,255,255,0.45);
    background: transparent;
  }
  .tab-btn:hover { color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.05); }
  .tab-btn.active {
    background: linear-gradient(135deg, rgba(124,58,237,0.3), rgba(236,72,153,0.2));
    color: white;
    border-bottom: 2px solid #a855f7;
    box-shadow: 0 4px 16px rgba(124,58,237,0.2);
  }

  /* ── Badge ── */
  .badge {
    display: inline-flex; align-items: center; gap: 5px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 999px; padding: 4px 14px;
    font-size: 12px; font-weight: 600;
    color: rgba(255,255,255,0.7);
    backdrop-filter: blur(8px);
    transition: all 0.25s;
  }
  .badge:hover { background: rgba(139,92,246,0.15); border-color: rgba(139,92,246,0.4); color: white; }

  /* ── Upload zone ── */
  .upload-zone {
    border: 2px dashed rgba(255,255,255,0.12);
    border-radius: 20px;
    background: rgba(255,255,255,0.02);
    backdrop-filter: blur(12px);
    transition: all 0.35s;
    cursor: pointer;
    animation: borderGlow 4s ease-in-out infinite;
  }
  .upload-zone:hover, .upload-zone.drag-over {
    border-color: rgba(139,92,246,0.6);
    background: rgba(139,92,246,0.06);
    box-shadow: 0 0 50px rgba(139,92,246,0.15), inset 0 0 30px rgba(139,92,246,0.05);
    transform: scale(1.005);
  }

  /* ── Clause card ── */
  .clause-card {
    background: rgba(255,255,255,0.03);
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.07);
    backdrop-filter: blur(12px);
    transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
    cursor: pointer;
  }
  .clause-card:hover {
    background: rgba(255,255,255,0.06);
    transform: translateX(4px);
    box-shadow: -4px 0 20px rgba(139,92,246,0.15);
  }

  /* ── Risk banner ── */
  .risk-banner {
    border-radius: 20px;
    padding: 2rem;
    position: relative; overflow: hidden;
    backdrop-filter: blur(20px);
    animation: slideIn 0.5s ease;
  }
  .risk-banner::before {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.05), transparent);
    pointer-events: none;
  }

  /* ── Input ── */
  .dark-input {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    color: white; font-family: inherit; font-size: 14px;
    padding: 13px 16px; outline: none; width: 100%;
    transition: all 0.25s;
    backdrop-filter: blur(8px);
  }
  .dark-input:focus {
    border-color: rgba(139,92,246,0.5);
    box-shadow: 0 0 20px rgba(139,92,246,0.15);
    background: rgba(255,255,255,0.06);
  }
  .dark-input::placeholder { color: rgba(255,255,255,0.3); }

  /* ── Textarea ── */
  .dark-textarea {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 14px;
    color: white; font-family: inherit; font-size: 14px;
    padding: 1rem; outline: none; width: 100%; resize: vertical;
    transition: all 0.25s; backdrop-filter: blur(8px);
  }
  .dark-textarea:focus {
    border-color: rgba(139,92,246,0.5);
    box-shadow: 0 0 20px rgba(139,92,246,0.12);
  }
  .dark-textarea::placeholder { color: rgba(255,255,255,0.25); }

  /* ── Stars ── */
  .star {
    position: fixed; border-radius: 50%; background: white; pointer-events: none; z-index: 0;
    animation: twinkle var(--d,3s) ease-in-out var(--delay,0s) infinite;
  }

  /* ── Logo ── */
  .logo-text {
    font-weight: 800; font-size: 22px; cursor: pointer;
    background: linear-gradient(135deg, #c084fc, #f0abfc, #f472b6, #818cf8);
    background-size: 300% auto;
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text; animation: shimmer 4s linear infinite;
    filter: drop-shadow(0 0 8px rgba(192,132,252,0.45));
  }

  /* ── Step card ── */
  .step-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px; padding: 1rem;
    transition: all 0.3s;
  }
  .step-card:hover {
    background: rgba(255,255,255,0.06);
    border-color: rgba(139,92,246,0.3);
    transform: translateY(-3px);
  }

  /* ── Lang option ── */
  .lang-opt {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px; padding: 1rem;
    display: flex; align-items: center; gap: 12px;
    cursor: pointer; transition: all 0.25s;
  }
  .lang-opt:hover {
    background: rgba(139,92,246,0.1);
    border-color: rgba(139,92,246,0.4);
    transform: translateY(-2px);
  }
  .lang-opt.selected {
    background: rgba(139,92,246,0.15);
    border-color: rgba(139,92,246,0.6);
    box-shadow: 0 0 20px rgba(139,92,246,0.2);
  }

  /* ── Chat bubbles ── */
  .chat-user {
    background: linear-gradient(135deg, rgba(124,58,237,0.3), rgba(236,72,153,0.2));
    border: 1px solid rgba(139,92,246,0.3);
    border-radius: 16px 16px 4px 16px;
  }
  .chat-ai {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px 16px 16px 4px;
  }

  /* ── Filter btn ── */
  .filter-btn {
    padding: 8px 18px; border-radius: 999px;
    font-weight: 600; font-size: 13px; cursor: pointer;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.04);
    color: rgba(255,255,255,0.6);
    transition: all 0.25s;
  }
  .filter-btn:hover { background: rgba(255,255,255,0.08); color: white; }
  .filter-btn.active-all {
    background: linear-gradient(135deg,#7c3aed,#a855f7);
    border-color: transparent; color: white;
    box-shadow: 0 4px 16px rgba(124,58,237,0.4);
  }
  .filter-btn.active-high { background:#EF4444; border-color:transparent; color:white; box-shadow:0 4px 16px rgba(239,68,68,0.4); }
  .filter-btn.active-medium { background:#F59E0B; border-color:transparent; color:white; box-shadow:0 4px 16px rgba(245,158,11,0.4); }
  .filter-btn.active-low { background:#22C55E; border-color:transparent; color:white; box-shadow:0 4px 16px rgba(34,197,94,0.4); }

  /* ── Pulse analyzing ── */
  .pulse-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px; padding: 12px 16px;
    display: flex; align-items: center; gap: 10px;
  }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
  ::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.3); border-radius: 3px; }

  /* ── Risk pill ── */
  .pill-high { background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); color:#f87171; border-radius:999px; padding:3px 12px; font-size:11px; font-weight:700; }
  .pill-medium { background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.3); color:#fbbf24; border-radius:999px; padding:3px 12px; font-size:11px; font-weight:700; }
  .pill-low { background:rgba(34,197,94,0.15); border:1px solid rgba(34,197,94,0.3); color:#4ade80; border-radius:999px; padding:3px 12px; font-size:11px; font-weight:700; }
`;

// ── Masker ────────────────────────────────────────────────────────────────────
function buildMasker() {
  const map = {}, cnt = {};
  function mask(text) {
    let t = text;
    const patterns = [
      { re: /\b[A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?\b/g, tag:"NAME" },
      { re: /\b\d{10}\b/g, tag:"PHONE" },
      { re: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, tag:"EMAIL" },
      { re: /\b[A-Z][a-zA-Z\s]+(?:Pvt\.?\s*Ltd\.?|LLC|Inc\.?|Corp\.?|LLP|Company)\b/g, tag:"COMPANY" },
      { re: /\b(?:GSTIN|PAN|Aadhaar|CIN)\s*[:\-]?\s*[A-Z0-9]{8,}\b/gi, tag:"ID" },
      { re: /\b(?:Account|A\/C)\s*(?:No\.?)?\s*:?\s*[\dX]{8,}\b/gi, tag:"BANK" },
      { re: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/g, tag:"DATE" },
      { re: /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g, tag:"DATE" },
      { re: /\b(?:Plot|Flat|House|Door)\s*No\.?\s*[\d\-]+[,\s]+[A-Z][a-zA-Z\s,]+\b/g, tag:"ADDRESS" },
    ];
    patterns.forEach(({ re, tag }) => {
      t = t.replace(re, (m) => {
        const ex = Object.entries(map).find(([, v]) => v === m);
        if (ex) return ex[0];
        cnt[tag] = (cnt[tag] || 0) + 1;
        const ph = `[${tag}_${cnt[tag]}]`;
        map[ph] = m; return ph;
      });
    });
    return t;
  }
  function rebuild(text) {
    let r = text || "";
    Object.entries(map).forEach(([ph, orig]) => { r = r.split(ph).join(orig); });
    return r;
  }
  function rebuildObj(obj) {
    if (!obj) return obj;
    if (typeof obj === "string") return rebuild(obj);
    if (Array.isArray(obj)) return obj.map(rebuildObj);
    if (typeof obj === "object") {
      const out = {};
      for (const [k, v] of Object.entries(obj)) out[k] = rebuildObj(v);
      return out;
    }
    return obj;
  }
  return { mask, rebuild, rebuildObj, getMap: () => ({ ...map }) };
}

function speak(text, langCode) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text.substring(0, 500));
  utt.lang  = LANG_BCP47[langCode] || "hi-IN";
  utt.rate  = 0.88; utt.pitch = 1;
  const voices = window.speechSynthesis.getVoices();
  const match  = voices.find(v => v.lang.startsWith(utt.lang.split("-")[0]));
  if (match) utt.voice = match;
  window.speechSynthesis.speak(utt);
}
const stopSpeak = () => window.speechSynthesis?.cancel();

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options, headers: { ...HEADERS, ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || "Request failed");
  }
  return res;
}
async function analyzeContract(maskedText, language) {
  const form = new FormData();
  form.append("file", new Blob([maskedText], { type:"text/plain" }), "contract.txt");
  form.append("language", language);
  const res = await apiFetch("/analyze", { method:"POST", body:form });
  return res.json();
}
async function chatQuestion(question, context, language) {
  const res = await apiFetch("/chat", {
    method:"POST", headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ question, context, language }),
  });
  return (await res.json()).answer;
}
async function fetchPDF(analysis, language) {
  const res = await apiFetch("/generate-pdf", {
    method:"POST", headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      summary: analysis.summary, legalOpinion: analysis.legalOpinion || "",
      clauses: analysis.clauses, recommendations: analysis.recommendations || [],
      redFlags: analysis.redFlags || [], language, overallRisk: analysis.overallRisk,
      keyParties: analysis.keyParties || "",
    }),
  });
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "ai-contract-analyzer-report.pdf"; a.click();
  URL.revokeObjectURL(url);
}

const SAMPLE = `SERVICE AGREEMENT

This Service Agreement ("Agreement") is entered into on January 15, 2024, between
Rajesh Kumar, residing at Plot No. 45, Sector 18, Noida, Uttar Pradesh ("Client")
and TechSolutions Pvt. Ltd., CIN U72900DL2018PTC123456, GSTIN 07AAACT1234F1Z5 ("Service Provider").

1. SERVICES
Service Provider shall provide software development services as described in Annexure A.
Scope of work may be modified unilaterally by Service Provider at any time without notice.

2. PAYMENT TERMS
Client shall pay Rs.50,000 per month, due within 3 days of invoice.
Late payment attracts interest at 36% per annum compounded monthly.
Service Provider may revise fees by up to 40% annually with 7 days notice.
All payments are non-refundable under any circumstances.

3. INTELLECTUAL PROPERTY
All work product, code, designs, and deliverables shall remain the exclusive property of
Service Provider. Client receives only a non-exclusive, revocable license to use deliverables.

4. LIMITATION OF LIABILITY
Service Provider's aggregate liability under this Agreement shall not exceed Rs. 5,000.
Client shall indemnify and hold harmless Service Provider from ALL losses, damages,
claims and expenses including unlimited consequential and indirect damages.

5. TERMINATION
Service Provider may terminate this Agreement immediately and without cause.
Client may terminate only on 180 days written notice AND payment of Rs. 3,00,000.

6. NON-COMPETE
Client shall not hire any employee of Service Provider for 5 years. Violation: Rs. 10,00,000 per instance.

7. GOVERNING LAW
This Agreement shall be governed exclusively by the laws of Singapore.
All disputes shall be resolved by arbitration seated in London under ICC Rules.`;

// ── Donut Chart ───────────────────────────────────────────────────────────────
function DonutChart({ high, medium, low }) {
  const total = high + medium + low;
  const risky = high + medium;
  const cx = 110, cy = 110, r = 72, sw = 26;
  const circ = 2 * Math.PI * r;
  const segs = [
    { count: low,    color: "#22C55E", label: "Low Risk" },
    { count: medium, color: "#F59E0B", label: "Medium Risk" },
    { count: high,   color: "#EF4444", label: "High Risk" },
  ];
  let cum = 0;
  const arcs = segs.map(seg => {
    const dash = total > 0 ? (seg.count / total) * circ : 0;
    const o = cum; cum += dash;
    return { ...seg, dash, gap: circ - dash, o };
  });
  return (
    <div className="glass-card" style={{ padding:"1.5rem", display:"flex", flexDirection:"column", alignItems:"center" }}>
      <div style={{ fontWeight:"700", fontSize:"16px", color:"white", alignSelf:"flex-start", marginBottom:"1.25rem" }}>
        📊 Risk Distribution
      </div>
      <svg width="220" height="220" viewBox="0 0 220 220">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} />
        {total > 0
          ? arcs.map((arc, i) => arc.dash > 2 && (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={arc.color} strokeWidth={sw}
              strokeDasharray={`${arc.dash-5} ${arc.gap+5}`}
              strokeDashoffset={-arc.o} strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition:"all 0.7s cubic-bezier(0.4,0,0.2,1)", filter:`drop-shadow(0 0 6px ${arc.color})` }} />
          ))
          : <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} />
        }
        <text x={cx} y={cy-6} textAnchor="middle" fontSize="38" fontWeight="900" fill="white">{risky}</text>
        <text x={cx} y={cy+16} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.4)" fontWeight="600" letterSpacing="0.8">RISKY CLAUSES</text>
      </svg>
      <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:"8px 16px", margin:"4px 0 1.25rem" }}>
        {segs.map(s => (
          <span key={s.label} style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"13px", color:"rgba(255,255,255,0.7)", fontWeight:"500" }}>
            <span style={{ width:"10px", height:"10px", borderRadius:"3px", background:s.color, display:"inline-block", boxShadow:`0 0 6px ${s.color}` }} />
            {s.label}
          </span>
        ))}
      </div>
      <div style={{ display:"flex", width:"100%", justifyContent:"space-around", paddingTop:"0.875rem", borderTop:"1px solid rgba(255,255,255,0.07)" }}>
        {segs.map(s => (
          <div key={s.label} style={{ textAlign:"center" }}>
            <div style={{ fontSize:"24px", fontWeight:"900", color:s.color, lineHeight:1, textShadow:`0 0 12px ${s.color}` }}>{s.count}</div>
            <div style={{ fontSize:"11px", color:"rgba(255,255,255,0.4)", marginTop:"4px" }}>{s.label.split(" ")[0]}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop:"1rem", width:"100%", padding:"10px 14px", borderRadius:"10px", textAlign:"center",
        background: high>0?"rgba(239,68,68,0.12)":medium>0?"rgba(245,158,11,0.12)":"rgba(34,197,94,0.12)",
        border:`1px solid ${high>0?"rgba(239,68,68,0.3)":medium>0?"rgba(245,158,11,0.3)":"rgba(34,197,94,0.3)"}`,
        fontSize:"13px", fontWeight:"700",
        color: high>0?"#f87171":medium>0?"#fbbf24":"#4ade80" }}>
        {high>0 ? `🚨 ${high} High Risk Clause${high>1?"s":""} — Seek Legal Advice`
          : medium>0 ? `⚠️ ${medium} Medium Risk — Review Before Signing`
          : "✅ Contract Appears Generally Safe"}
      </div>
    </div>
  );
}

// ── Stars ─────────────────────────────────────────────────────────────────────
function Stars() {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none" }}>
      {Array.from({ length: 50 }, (_, i) => {
        const sz = Math.random() * 2 + 0.5;
        return <div key={i} className="star" style={{
          width:sz, height:sz,
          top:`${Math.random()*100}%`, left:`${Math.random()*100}%`,
          "--d":`${2+Math.random()*4}s`, "--delay":`${Math.random()*5}s`,
        }} />;
      })}
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function LegalEase() {
  const [screen,         setScreen]         = useState("landing");
  const [contractText,   setContractText]   = useState("");
  const [language,       setLanguage]       = useState("hi");
  const [analysis,       setAnalysis]       = useState(null);
  const [masker,         setMasker]         = useState(null);
  const [maskedPreview,  setMaskedPreview]  = useState("");
  const [piiCount,       setPiiCount]       = useState(0);
  const [error,          setError]          = useState("");
  const [filterRisk,     setFilterRisk]     = useState("All");
  const [activeTab,      setActiveTab]      = useState("opinion");
  const [chatMessages,   setChatMessages]   = useState([]);
  const [chatInput,      setChatInput]      = useState("");
  const [chatLoading,    setChatLoading]    = useState(false);
  const [expandedClause, setExpandedClause] = useState(null);
  const [dragOver,       setDragOver]       = useState(false);
  const [speaking,       setSpeaking]       = useState(false);
  const [pdfLoading,     setPdfLoading]     = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { window.speechSynthesis?.getVoices(); }, []);
  const selectedLang = LANGUAGES.find(l => l.code === language);

  const handleFile = useCallback((file) => {
    if (file.type === "application/pdf") {
      const reader = new FileReader();
      reader.onload = async function () {
        const typedArray = new Uint8Array(this.result);
        const pdf = await pdfjsLib.getDocument(typedArray).promise;
        let text = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map(item => item.str).join(" ");
        }
        setContractText(text); setScreen("language");
      };
      reader.readAsArrayBuffer(file); return;
    }
    const reader = new FileReader();
    reader.onload = e => { setContractText(e.target.result); setScreen("language"); };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  }, [handleFile]);

  const handleAnalyze = async () => {
    if (!contractText) return;
    setError(""); setScreen("analyzing");
    try {
      const m = buildMasker();
      const masked = m.mask(contractText);
      setMasker(m);
      setMaskedPreview(masked.substring(0, 350) + "…");
      setPiiCount(Object.keys(m.getMap()).length);
      const raw = await analyzeContract(masked, language);
      console.log("API RESULT:", raw);
      if (!raw) throw new Error("Backend returned empty response");
      let result;
      if (typeof raw === "string") result = JSON.parse(raw);
      else if (raw.result) result = raw.result;
      else if (raw.data) result = raw.data;
      else if (raw.text) result = JSON.parse(raw.text);
      else result = raw;
      if (!result || !result.clauses) throw new Error("Invalid response from backend");
      const out = m.rebuildObj(result);
      out.clauses = out.clauses || [];
      out.recommendations = out.recommendations || [];
      out.redFlags = out.redFlags || [];
      out.legalOpinion = out.legalOpinion || "No legal opinion generated";
      setAnalysis(out); setScreen("dashboard");
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong");
      setScreen("upload");
    }
  };

  const handleChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const q = chatInput; setChatInput("");
    setChatMessages(p => [...p, { role:"user", text:q }]);
    setChatLoading(true);
    try {
      const ans = await chatQuestion(q, { summary:analysis.summary, legalOpinion:analysis.legalOpinion, clauses:analysis.clauses, overallRisk:analysis.overallRisk }, language);
      setChatMessages(p => [...p, { role:"ai", text:ans }]);
      speak(ans, language); setSpeaking(true);
    } catch { setChatMessages(p => [...p, { role:"ai", text:"Error occurred. Please retry." }]); }
    setChatLoading(false);
  };

  const toggleSpeak = (text) => {
    if (speaking) { stopSpeak(); setSpeaking(false); }
    else { speak(text, language); setSpeaking(true); }
  };

  const handlePDF = async () => {
    if (!analysis) return;
    setPdfLoading(true);
    try { await fetchPDF(analysis, language); }
    catch (e) { alert("PDF error: " + e.message); }
    setPdfLoading(false);
  };

  const filteredClauses = analysis?.clauses?.filter(c => filterRisk === "All" || c.risk === filterRisk) || [];
  const riskCounts = analysis
    ? { High:analysis.clauses.filter(c=>c.risk==="High").length, Medium:analysis.clauses.filter(c=>c.risk==="Medium").length, Low:analysis.clauses.filter(c=>c.risk==="Low").length }
    : { High:0, Medium:0, Low:0 };

  const dimText = "rgba(255,255,255,0.6)";
  const faintText = "rgba(255,255,255,0.35)";

  // ═══════════════ LANDING ═════════════════════════════════════════════════
  if (screen === "landing") return (
    <div className="mesh-bg" style={{ minHeight:"100vh", color:"white" }}>
      <style>{GLOBAL_CSS}</style>
      <Stars />
      <nav className="nav-glass above-mesh">
        <div className="logo-text">⚖️ AI Contract Analyzer</div>
        <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
          <span className="badge">🛡️ Privacy-First</span>
          <span className="badge">🔒 Smart Masking</span>
          <span className="badge">⚖️ Lawyer-Grade AI</span>
          <span className="badge">🔊 Voice Output</span>
        </div>
        <button className="btn-primary" onClick={() => setScreen("upload")}>Get Started →</button>
      </nav>

      <div className="above-mesh" style={{ maxWidth:"1100px", margin:"0 auto", padding:"5rem 2rem" }}>

        {/* Hero */}
        <div style={{ textAlign:"center", marginBottom:"4rem" }}>
          <div className="badge" style={{ marginBottom:"1.5rem", display:"inline-flex" }}>
            🏆 Gemini AI · Lawyer-Grade Analysis · 8 Indian Languages
          </div>
          <h1 style={{ fontSize:"clamp(2.2rem,5vw,4rem)", fontWeight:"900", lineHeight:"1.1", margin:"1rem 0 1rem", color:"white" }}>
            अपनी भाषा में पाएं
          </h1>
          <h1 className="purple-text" style={{ fontSize:"clamp(2.2rem,5vw,4rem)", fontWeight:"900", lineHeight:"1.1", margin:"0 0 1.5rem" }}>
            वकील जैसी कानूनी सलाह
          </h1>
          <p style={{ fontSize:"17px", color:dimText, maxWidth:"660px", margin:"0 auto 2.5rem", lineHeight:"1.85" }}>
            AI Contract Analyzer analyzes your contracts like a <strong style={{ color:"white" }}>senior Indian lawyer</strong> —
            citing Indian Contract Act, IT Act, and relevant precedents.
            Your PII is masked before the AI ever sees it.
          </p>
          <div style={{ display:"flex", gap:"14px", justifyContent:"center", flexWrap:"wrap" }}>
            <button className="btn-primary" onClick={() => setScreen("upload")}>📄 Upload Contract →</button>
            <button className="btn-outline" onClick={() => { setContractText(SAMPLE); setScreen("language"); }}>🧪 Try Sample Contract</button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:"flex", justifyContent:"center", gap:"60px", marginBottom:"4rem", flexWrap:"wrap" }}>
          {[["20+","Years Legal Expertise"],["8","Indian Languages"],["100%","PII Masked Before AI"]].map(([n,l]) => (
            <div key={l} style={{ textAlign:"center" }}>
              <div className="gold-text" style={{ fontSize:"2.8rem", fontWeight:"900" }}>{n}</div>
              <div style={{ fontSize:"13px", color:faintText, marginTop:"4px" }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Language pills */}
        <div className="glass-card" style={{ marginBottom:"2.5rem", textAlign:"center", padding:"1.5rem" }}>
          <div style={{ fontSize:"11px", color:faintText, fontWeight:"700", marginBottom:"14px", textTransform:"uppercase", letterSpacing:"1px" }}>🌐 8 Supported Languages</div>
          <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:"10px" }}>
            {LANGUAGES.map(l => (
              <span key={l.code} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"20px", padding:"7px 18px", fontSize:"15px", fontWeight:"600", color:"rgba(255,255,255,0.8)", cursor:"pointer", transition:"all 0.25s" }}
                onMouseEnter={e => { e.target.style.background="rgba(139,92,246,0.15)"; e.target.style.borderColor="rgba(139,92,246,0.4)"; }}
                onMouseLeave={e => { e.target.style.background="rgba(255,255,255,0.05)"; e.target.style.borderColor="rgba(255,255,255,0.1)"; }}>
                {l.flag} {l.label} <span style={{ fontSize:"12px", color:faintText }}>({l.name})</span>
              </span>
            ))}
          </div>
        </div>

        {/* Feature cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:"1.25rem", marginBottom:"3rem" }}>
          {[
            { icon:"⚖️", color:"#a78bfa", title:"Lawyer-Grade Analysis", desc:"Every clause analyzed citing ICA 1872, IT Act, Labour laws. Risk scored High/Medium/Low with exact legal reasoning." },
            { icon:"🔒", color:"#f472b6", title:"Smart PII Masking", desc:"Names, IDs, phone numbers replaced with [NAME_1] in your browser before sending. AI never sees real data." },
            { icon:"🌐", color:"#34d399", title:"8 Regional Languages", desc:"100% output in Hindi, Tamil, Telugu, Marathi, Kannada, Gujarati, Bengali, or Punjabi." },
            { icon:"🔊", color:"#fbbf24", title:"Voice Response", desc:"Click 🔊 on any clause or chat reply to hear it read aloud in your language." },
            { icon:"📥", color:"#60a5fa", title:"PDF Report", desc:"Download a professional report with legal opinion, risk chart, clause table and recommendations." },
            { icon:"💬", color:"#f87171", title:"Legal Q&A Chat", desc:"Ask follow-up questions and get lawyer-style answers citing relevant Indian law." },
          ].map(f => (
            <div key={f.title} className="feat-card" style={{ borderTop:`2px solid ${f.color}40` }}>
              <div className="feat-icon" style={{ fontSize:"28px", marginBottom:"12px" }}>{f.icon}</div>
              <h3 style={{ fontWeight:"700", fontSize:"15px", marginBottom:"8px", color:f.color }}>{f.title}</h3>
              <p style={{ fontSize:"13px", color:faintText, lineHeight:"1.7", margin:0 }}>{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Privacy flow */}
        <div className="glass-card" style={{ padding:"2rem" }}>
          <div style={{ fontSize:"11px", color:faintText, fontWeight:"700", marginBottom:"1.5rem", textTransform:"uppercase", letterSpacing:"1.5px" }}>🔐 How Your Data Stays Private</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:"1rem" }}>
            {[
              { n:"1", icon:"🖥️", color:"#60A5FA", label:"Browser Masks", desc:"PII replaced locally" },
              { n:"2", icon:"📡", color:"#A78BFA", label:"Masked Sent",    desc:"No real PII travels" },
              { n:"3", icon:"🤖", color:"#34D399", label:"Gemini Analyzes",desc:"Sees only placeholders" },
              { n:"4", icon:"📋", color:"#FCD34D", label:"JSON Returned",  desc:"Analysis result back" },
              { n:"5", icon:"✨", color:"#F9A8D4", label:"Browser Rebuilds",desc:"Real values restored" },
            ].map(s => (
              <div key={s.n} className="step-card" style={{ borderTop:`2px solid ${s.color}` }}>
                <div style={{ fontSize:"18px", marginBottom:"6px" }}>{s.icon}</div>
                <div style={{ fontSize:"10px", color:s.color, fontWeight:"700", marginBottom:"3px" }}>STEP {s.n}</div>
                <div style={{ fontWeight:"600", fontSize:"12px", marginBottom:"3px", color:"white" }}>{s.label}</div>
                <div style={{ fontSize:"11px", color:faintText }}>{s.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:"1.5rem", background:"rgba(0,0,0,0.3)", borderRadius:"10px", padding:"1rem", fontFamily:"monospace", fontSize:"12px", border:"1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ color:"#f87171", marginBottom:"4px" }}>❌ Original: Rajesh Kumar, GSTIN 07AAACT1234F1Z5, +91-9876543210</div>
            <div style={{ color:"#4ade80" }}>✅ What Gemini sees: [NAME_1], GSTIN [ID_1], [PHONE_1]</div>
          </div>
        </div>
      </div>
    </div>
  );

  // ═══════════════ UPLOAD ═══════════════════════════════════════════════════
  if (screen === "upload") return (
    <div className="mesh-bg" style={{ minHeight:"100vh", color:"white" }}>
      <style>{GLOBAL_CSS}</style>
      <Stars />
      <nav className="nav-glass above-mesh">
        <div className="logo-text" onClick={() => setScreen("landing")}>⚖️ AI Contract Analyzer</div>
        <span className="badge">🔒 PII Masked Before Upload</span>
      </nav>

      <div className="above-mesh" style={{ maxWidth:"680px", margin:"0 auto", padding:"4rem 2rem" }}>
        <div style={{ textAlign:"center", marginBottom:"2.5rem" }}>
          <span className="badge" style={{ marginBottom:"1rem", display:"inline-flex" }}>⚖️ AI Contract Analyzer</span>
          <h2 style={{ fontWeight:"800", fontSize:"clamp(1.8rem,4vw,2.5rem)", margin:"1rem 0 0.75rem" }}>
            Upload Your <span className="purple-text">Contract</span>
          </h2>
          <p style={{ color:dimText, fontSize:"15px", lineHeight:"1.7" }}>
            Names, IDs and contacts are masked in your browser before anything is sent.
          </p>
        </div>

        {error && (
          <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:"14px", padding:"16px 20px", marginBottom:"1.5rem", backdropFilter:"blur(12px)" }}>
            <div style={{ fontWeight:"600", color:"#f87171", marginBottom:"4px" }}>⚠️ Error</div>
            <div style={{ fontSize:"13px", color:"rgba(248,113,113,0.8)" }}>{error}</div>
            {error.toLowerCase().includes("api") && (
              <div style={{ marginTop:"8px", fontSize:"12px", color:"rgba(251,191,36,0.8)" }}>
                💡 Make sure <code style={{ background:"rgba(255,255,255,0.08)", padding:"2px 6px", borderRadius:"4px" }}>GOOGLE_API_KEY</code> is set in your backend <code style={{ background:"rgba(255,255,255,0.08)", padding:"2px 6px", borderRadius:"4px" }}>.env</code> file.
              </div>
            )}
          </div>
        )}

        {/* Language quick-select */}
        <div className="glass-card" style={{ padding:"1.25rem", marginBottom:"1.5rem" }}>
          <div style={{ fontSize:"13px", fontWeight:"600", color:"rgba(255,255,255,0.7)", marginBottom:"10px" }}>🌐 Output Language</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"8px" }}>
            {LANGUAGES.map(lang => (
              <div key={lang.code} onClick={() => setLanguage(lang.code)}
                style={{ background: language===lang.code ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.03)", border: language===lang.code ? "1.5px solid rgba(139,92,246,0.6)" : "1px solid rgba(255,255,255,0.07)", borderRadius:"10px", padding:"10px 8px", textAlign:"center", fontSize:"13px", fontWeight:"600", color: language===lang.code ? "white" : dimText, cursor:"pointer", transition:"all 0.25s", boxShadow: language===lang.code ? "0 0 16px rgba(139,92,246,0.2)" : "none" }}>
                {lang.label}
              </div>
            ))}
          </div>
        </div>

        {/* Drop zone */}
        <div className={`upload-zone${dragOver?" drag-over":""}`}
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileRef.current?.click()}
          style={{ padding:"3.5rem 2rem", textAlign:"center", marginBottom:"1.5rem" }}>
          <input ref={fileRef} type="file" accept=".txt,.pdf" style={{ display:"none" }} onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
          <div style={{ fontSize:"52px", marginBottom:"14px", display:"inline-block", animation:"floatY 3s ease-in-out infinite" }}>📄</div>
          <p style={{ fontWeight:"700", fontSize:"16px", marginBottom:"6px" }}>Drag & drop or click to upload</p>
          <p style={{ fontSize:"13px", color:faintText, marginBottom:"14px" }}>Supports .TXT and .PDF files</p>
          <span className="badge">🔒 Masked in browser before upload</span>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:"14px", marginBottom:"1.5rem" }}>
          <div style={{ flex:1, height:"1px", background:"rgba(255,255,255,0.08)" }} />
          <span style={{ color:faintText, fontSize:"12px", letterSpacing:"0.1em", textTransform:"uppercase" }}>or paste text</span>
          <div style={{ flex:1, height:"1px", background:"rgba(255,255,255,0.08)" }} />
        </div>

        <textarea className="dark-textarea" value={contractText} onChange={e => setContractText(e.target.value)} placeholder="Paste your contract text here..." style={{ height:"200px" }} />

        <div style={{ display:"flex", gap:"12px", marginTop:"1.5rem", flexWrap:"wrap" }}>
          <button className="btn-primary" onClick={() => contractText.trim() ? setScreen("language") : null} disabled={!contractText?.trim()}>
            Next: Select Language →
          </button>
          <button className="btn-outline" onClick={() => { setContractText(SAMPLE); setScreen("language"); }}>
            🧪 Use Sample
          </button>
        </div>
      </div>
    </div>
  );

  // ═══════════════ LANGUAGE ═════════════════════════════════════════════════
  if (screen === "language") return (
    <div className="mesh-bg" style={{ minHeight:"100vh", color:"white" }}>
      <style>{GLOBAL_CSS}</style>
      <Stars />
      <nav className="nav-glass above-mesh">
        <div className="logo-text" onClick={() => setScreen("upload")}>⚖️ AI Contract Analyzer</div>
        <button className="btn-outline" style={{ padding:"8px 16px", fontSize:"13px" }} onClick={() => setScreen("upload")}>← Back</button>
      </nav>
      <div className="above-mesh" style={{ maxWidth:"680px", margin:"0 auto", padding:"4rem 2rem" }}>
        <h2 style={{ fontWeight:"800", fontSize:"2rem", marginBottom:"0.5rem" }}>
          Select <span className="purple-text">Output Language</span>
        </h2>
        <p style={{ color:dimText, marginBottom:"2rem", lineHeight:"1.7" }}>Legal analysis will be 100% in selected language. Zero English mixing.</p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"2rem" }}>
          {LANGUAGES.map(lang => (
            <div key={lang.code} className={`lang-opt${language===lang.code?" selected":""}`} onClick={() => setLanguage(lang.code)}>
              <div style={{ fontSize:"22px" }}>{lang.flag}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:"700", fontSize:"17px", color: language===lang.code?"white":dimText }}>{lang.label}</div>
                <div style={{ color:faintText, fontSize:"12px" }}>{lang.name}</div>
              </div>
              {language===lang.code && <div style={{ color:"#a78bfa", fontWeight:"700" }}>✓</div>}
            </div>
          ))}
        </div>
        <div className="glass-card" style={{ padding:"1rem 1.25rem", marginBottom:"2rem", borderColor:"rgba(34,197,94,0.25)", background:"rgba(34,197,94,0.06)" }}>
          <p style={{ margin:0, fontSize:"14px", color:"#4ade80" }}>
            ⚖️ <strong>Lawyer-grade analysis in {selectedLang?.name}.</strong> Clauses will be analyzed citing Indian Contract Act, with risk scoring and negotiation advice.
          </p>
        </div>
        <button className="btn-primary" onClick={handleAnalyze}>🔒 Mask Data & Run Legal Analysis →</button>
      </div>
    </div>
  );

  // ═══════════════ ANALYZING ════════════════════════════════════════════════
  if (screen === "analyzing") return (
    <div className="mesh-bg" style={{ minHeight:"100vh", color:"white", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{GLOBAL_CSS}</style>
      <Stars />
      <div className="above-mesh" style={{ textAlign:"center", maxWidth:"520px", padding:"2rem" }}>
        <div style={{ fontSize:"64px", marginBottom:"1.5rem", display:"inline-block", animation:"spin 2s linear infinite", filter:"drop-shadow(0 0 20px rgba(139,92,246,0.6))" }}>⚖️</div>
        <h2 style={{ fontWeight:"800", fontSize:"24px", marginBottom:"0.5rem" }}>Running Legal Analysis</h2>
        <p style={{ color:dimText, fontSize:"14px", marginBottom:"1.5rem" }}>Gemini is analyzing your contract as a senior Indian lawyer would…</p>
        <div style={{ display:"flex", flexDirection:"column", gap:"10px", marginBottom:"2rem" }}>
          {[
            { icon:"🔒", text:`${piiCount} PII entities masked in browser` },
            { icon:"📡", text:"Sending only masked text to backend…" },
            { icon:"⚖️", text:"Gemini analyzing clauses with legal reasoning…" },
            { icon:"🌐", text:`Translating full analysis to ${selectedLang?.name}…` },
            { icon:"✨", text:"Reconstructing your real values in output…" },
          ].map((s,i) => (
            <div key={i} className="pulse-card" style={{ animation:`pulse 1.5s ease-in-out ${i*0.25}s infinite` }}>
              <span style={{ fontSize:"18px" }}>{s.icon}</span>
              <span style={{ fontSize:"14px", color:dimText }}>{s.text}</span>
            </div>
          ))}
        </div>
        {maskedPreview && (
          <div style={{ background:"rgba(0,0,0,0.4)", borderRadius:"12px", padding:"1rem", textAlign:"left", border:"1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize:"11px", color:"#4ade80", fontWeight:"600", marginBottom:"6px" }}>✅ WHAT GEMINI RECEIVES (masked):</div>
            <div style={{ fontFamily:"monospace", fontSize:"11px", color:faintText, lineHeight:"1.6", wordBreak:"break-all" }}>{maskedPreview}</div>
          </div>
        )}
      </div>
    </div>
  );

  // ═══════════════ DASHBOARD ════════════════════════════════════════════════
  if (screen === "dashboard" && analysis?.clauses) {
    const rc = RISK_CFG[analysis.overallRisk] || RISK_CFG.Low;

    const bannerColors = {
      High:   { bg:"rgba(239,68,68,0.15)", border:"rgba(239,68,68,0.35)", glow:"rgba(239,68,68,0.12)" },
      Medium: { bg:"rgba(245,158,11,0.15)", border:"rgba(245,158,11,0.35)", glow:"rgba(245,158,11,0.12)" },
      Low:    { bg:"rgba(34,197,94,0.15)", border:"rgba(34,197,94,0.35)", glow:"rgba(34,197,94,0.12)" },
    };
    const bc = bannerColors[analysis.overallRisk] || bannerColors.Low;

    return (
      <div className="mesh-bg" style={{ minHeight:"100vh", color:"white" }}>
        <style>{GLOBAL_CSS}</style>
        <Stars />
        <nav className="nav-glass above-mesh">
          <div className="logo-text" onClick={() => setScreen("landing")}>⚖️ AI Contract Analyzer</div>
          <div style={{ display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap" }}>
            <span className="badge">🔒 {piiCount} PII Protected</span>
            <span className="badge">{selectedLang?.flag} {selectedLang?.name}</span>
            <button className="btn-primary" style={{ padding:"10px 20px", fontSize:"13px" }} onClick={handlePDF} disabled={pdfLoading}>
              {pdfLoading ? "⏳ Generating…" : "📥 Download PDF"}
            </button>
            <button className="btn-outline" style={{ padding:"10px 16px", fontSize:"13px" }} onClick={() => { setScreen("upload"); setAnalysis(null); setChatMessages([]); stopSpeak(); }}>
              🔄 New
            </button>
          </div>
        </nav>

        <div className="above-mesh" style={{ maxWidth:"1200px", margin:"0 auto", padding:"2rem" }}>

          {/* Risk Banner */}
          <div className="risk-banner" style={{ background:bc.bg, border:`1px solid ${bc.border}`, marginBottom:"1.5rem", boxShadow:`0 0 60px ${bc.glow}` }}>
            <div style={{ position:"absolute", top:-30, right:-30, width:160, height:160, borderRadius:"50%", background:rc.color+"18", filter:"blur(40px)", pointerEvents:"none" }} />
            <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", justifyContent:"space-between", gap:"16px" }}>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:"14px", marginBottom:"10px", flexWrap:"wrap" }}>
                  <span style={{ fontSize:"2rem" }}>{analysis.overallRisk==="High"?"⚠️":analysis.overallRisk==="Medium"?"🟡":"✅"}</span>
                  <h2 style={{ fontWeight:"900", fontSize:"clamp(1.3rem,3vw,1.8rem)", margin:0, color:rc.color, textShadow:`0 0 20px ${rc.color}60` }}>
                    {analysis.overallRisk==="High"?"HIGH RISK CONTRACT":analysis.overallRisk==="Medium"?"MEDIUM RISK CONTRACT":"LOW RISK CONTRACT"}
                  </h2>
                  <span className={`pill-${analysis.overallRisk?.toLowerCase()}`}>{riskCounts[analysis.overallRisk]} {analysis.overallRisk} Risk Clauses</span>
                </div>
                {analysis.keyParties && <div style={{ fontSize:"14px", color:dimText, marginBottom:"8px" }}>{analysis.keyParties}</div>}
                {analysis.signingAdvice && (
                  <div style={{ background:"rgba(0,0,0,0.2)", border:`1px solid ${bc.border}`, borderRadius:"10px", padding:"8px 14px", fontSize:"13px", fontWeight:"600", color:dimText, display:"inline-block" }}>
                    💼 {analysis.signingAdvice}
                  </div>
                )}
              </div>
              <div style={{ display:"flex", gap:"12px", flexWrap:"wrap" }}>
                {Object.entries(riskCounts).map(([r,c]) => c>0 && (
                  <div key={r} style={{ background:"rgba(0,0,0,0.25)", borderRadius:"14px", padding:"10px 20px", textAlign:"center", border:`1px solid ${RISK_CFG[r].border}`, backdropFilter:"blur(8px)" }}>
                    <div style={{ fontWeight:"900", fontSize:"22px", color:RISK_CFG[r].color, textShadow:`0 0 12px ${RISK_CFG[r].color}` }}>{c}</div>
                    <div style={{ fontSize:"12px", color:faintText }}>{r}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ background:"rgba(0,0,0,0.3)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"14px", padding:"5px", marginBottom:"1.5rem", display:"flex", gap:"4px", overflowX:"auto", backdropFilter:"blur(16px)" }}>
            {[
              { id:"opinion",  label:"⚖️ Legal Opinion" },
              { id:"clauses",  label:"📄 Clause Analysis" },
              { id:"risk",     label:"📊 Risk Dashboard" },
              { id:"missing",  label:"🚨 Red Flags" },
              { id:"chat",     label:"💬 Ask Lawyer AI" },
            ].map(t => (
              <button key={t.id} className={`tab-btn${activeTab===t.id?" active":""}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
            ))}
          </div>

          {/* ── Legal Opinion ── */}
          {activeTab === "opinion" && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.5rem" }}>
              <div className="glass-card" style={{ gridColumn:"1 / -1", padding:"1.5rem" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1rem" }}>
                  <h3 style={{ fontWeight:"700", color:"#a78bfa", fontSize:"16px", margin:0 }}>📋 Contract Summary</h3>
                  <button className="btn-voice" onClick={() => toggleSpeak(analysis.summary)}>{speaking?"⏹ Stop":"🔊 Listen"}</button>
                </div>
                <p style={{ fontSize:"15px", lineHeight:"1.85", color:dimText, margin:0 }}>{analysis.summary}</p>
              </div>
              <div className="glass-card" style={{ gridColumn:"1 / -1", padding:"1.5rem", borderLeft:"4px solid #a78bfa" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1rem" }}>
                  <h3 style={{ fontWeight:"700", color:"#a78bfa", fontSize:"16px", margin:0 }}>⚖️ Professional Legal Opinion</h3>
                  <button className="btn-voice" onClick={() => toggleSpeak(analysis.legalOpinion)}>{speaking?"⏹ Stop":"🔊 Listen"}</button>
                </div>
                <div style={{ background:"rgba(139,92,246,0.08)", border:"1px solid rgba(139,92,246,0.2)", borderRadius:"12px", padding:"16px 20px" }}>
                  <p style={{ fontSize:"15px", lineHeight:"1.9", color:dimText, margin:0, fontStyle:"italic" }}>{analysis.legalOpinion}</p>
                </div>
              </div>
              <div className="glass-card" style={{ padding:"1.5rem" }}>
                <h3 style={{ fontWeight:"700", marginBottom:"1rem", fontSize:"15px", color:"#4ade80" }}>✅ Recommendations</h3>
                <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                  {(analysis.recommendations||[]).map((rec,i) => (
                    <div key={i} style={{ display:"flex", gap:"10px", alignItems:"flex-start" }}>
                      <span style={{ background:"rgba(139,92,246,0.2)", color:"#a78bfa", borderRadius:"50%", width:"22px", height:"22px", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"700", fontSize:"12px", flexShrink:0 }}>{i+1}</span>
                      <span style={{ fontSize:"14px", color:dimText, lineHeight:"1.6" }}>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass-card" style={{ padding:"1.5rem" }}>
                <h3 style={{ fontWeight:"700", marginBottom:"1rem", fontSize:"15px", color:"#f472b6" }}>🔒 Data Protection Report</h3>
                <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                  {Object.entries(masker?.getMap()||{}).slice(0,8).map(([ph,orig]) => (
                    <div key={ph} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", background:"rgba(255,255,255,0.03)", borderRadius:"8px", fontSize:"13px", border:"1px solid rgba(255,255,255,0.06)" }}>
                      <span style={{ fontFamily:"monospace", color:"#a78bfa", fontWeight:"600" }}>{ph}</span>
                      <span style={{ color:faintText }}>→ {orig.length>22?orig.substring(0,22)+"…":orig}</span>
                    </div>
                  ))}
                  {piiCount===0 && <p style={{ fontSize:"13px", color:faintText }}>No PII entities detected.</p>}
                  {piiCount>8 && <p style={{ fontSize:"12px", color:faintText }}>…and {piiCount-8} more entities protected</p>}
                </div>
              </div>
            </div>
          )}

          {/* ── Clauses ── */}
          {activeTab === "clauses" && (
            <div>
              <div style={{ display:"flex", gap:"8px", marginBottom:"1.5rem", flexWrap:"wrap" }}>
                {["All","High","Medium","Low"].map(f => (
                  <button key={f} onClick={() => setFilterRisk(f)}
                    className={`filter-btn${filterRisk===f?` active-${f.toLowerCase()}`:""}`}>
                    {f==="All"?`All (${analysis.clauses.length})`:`${f==="High"?"🔴":f==="Medium"?"🟡":"🟢"} ${f} (${riskCounts[f]})`}
                  </button>
                ))}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
                {filteredClauses.map(clause => {
                  const cr = RISK_CFG[clause.risk]||RISK_CFG.Low;
                  const isExp = expandedClause===clause.id;
                  return (
                    <div key={clause.id} className="clause-card"
                      style={{ borderLeft:`4px solid ${cr.color}`, padding:"1.25rem", background:isExp?`${cr.color}08`:"rgba(255,255,255,0.03)" }}
                      onClick={() => setExpandedClause(isExp?null:clause.id)}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px" }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:"10px", flexWrap:"wrap" }}>
                            <span className={`pill-${clause.risk?.toLowerCase()}`}>{clause.risk==="High"?"🔴":clause.risk==="Medium"?"🟡":"🟢"} {clause.risk}</span>
                            <span style={{ fontWeight:"700", fontSize:"15px", color:"white" }}>{clause.title}</span>
                          </div>
                          {!isExp && <p style={{ margin:"8px 0 0", fontSize:"14px", color:faintText, lineHeight:"1.5" }}>{clause.simplified?.substring(0,130)}…</p>}
                        </div>
                        <span style={{ fontSize:"14px", color:faintText, transform:isExp?"rotate(180deg)":"none", transition:"transform 0.2s", display:"inline-block" }}>▼</span>
                      </div>
                      {isExp && (
                        <div style={{ marginTop:"1.25rem", borderTop:`1px solid ${cr.border}`, paddingTop:"1.25rem" }} onClick={e => e.stopPropagation()}>
                          <div style={{ marginBottom:"1rem" }}>
                            <div style={{ fontSize:"10px", fontWeight:"700", color:faintText, marginBottom:"6px", textTransform:"uppercase", letterSpacing:"0.5px" }}>📄 Original Contract Language</div>
                            <div style={{ background:"rgba(0,0,0,0.25)", borderRadius:"8px", padding:"12px", fontSize:"13px", color:dimText, fontStyle:"italic", lineHeight:"1.7", borderLeft:"3px solid rgba(255,255,255,0.1)" }}>"{clause.original}"</div>
                          </div>
                          <div style={{ marginBottom:"1rem" }}>
                            <div style={{ fontSize:"10px", fontWeight:"700", color:faintText, marginBottom:"6px", textTransform:"uppercase", letterSpacing:"0.5px" }}>💡 Plain Language</div>
                            <div style={{ fontSize:"15px", color:dimText, lineHeight:"1.8" }}>{clause.simplified}</div>
                          </div>
                          <div style={{ marginBottom:"1rem", background:"rgba(139,92,246,0.08)", borderRadius:"10px", padding:"14px 16px", borderLeft:"3px solid #a78bfa" }}>
                            <div style={{ fontSize:"10px", fontWeight:"700", color:"#a78bfa", marginBottom:"8px", textTransform:"uppercase", letterSpacing:"0.5px" }}>⚖️ Legal Analysis</div>
                            <div style={{ fontSize:"14px", color:dimText, lineHeight:"1.8" }}>{clause.legalAnalysis}</div>
                          </div>
                          <div style={{ marginBottom:"1rem", background:cr.bg, borderRadius:"10px", padding:"12px 16px", border:`1px solid ${cr.border}` }}>
                            <div style={{ fontSize:"10px", fontWeight:"700", color:cr.color, marginBottom:"6px", textTransform:"uppercase", letterSpacing:"0.5px" }}>⚠️ Real-World Risk</div>
                            <div style={{ fontSize:"14px", color:dimText, lineHeight:"1.7" }}>{clause.warning}</div>
                          </div>
                          <div style={{ background:"rgba(34,197,94,0.08)", borderRadius:"10px", padding:"12px 16px", border:"1px solid rgba(34,197,94,0.25)" }}>
                            <div style={{ fontSize:"10px", fontWeight:"700", color:"#4ade80", marginBottom:"6px", textTransform:"uppercase", letterSpacing:"0.5px" }}>✅ Negotiation Recommendation</div>
                            <div style={{ fontSize:"14px", color:dimText, lineHeight:"1.7" }}>{clause.recommendation}</div>
                          </div>
                          <button className="btn-voice" style={{ marginTop:"12px" }} onClick={() => toggleSpeak(`${clause.title}. ${clause.simplified}. ${clause.warning}`)}>🔊 Read Aloud</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Risk Dashboard ── */}
          {activeTab === "risk" && (
            <div style={{ display:"grid", gridTemplateColumns:"310px 1fr", gap:"1.5rem", alignItems:"start" }}>
              <DonutChart high={riskCounts.High} medium={riskCounts.Medium} low={riskCounts.Low} />
              <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                <h3 style={{ fontWeight:"700", fontSize:"15px", margin:"0 0 4px", color:"rgba(255,255,255,0.8)" }}>Clause Risk Breakdown</h3>
                {analysis.clauses.map(clause => {
                  const cr = RISK_CFG[clause.risk]||RISK_CFG.Low;
                  return (
                    <div key={clause.id} className="glass-card"
                      style={{ display:"flex", alignItems:"center", gap:"14px", padding:"1rem 1.25rem", cursor:"pointer" }}
                      onClick={() => { setActiveTab("clauses"); setExpandedClause(clause.id); }}>
                      <div style={{ width:"10px", height:"10px", borderRadius:"50%", background:cr.color, flexShrink:0, boxShadow:`0 0 8px ${cr.color}` }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:"600", fontSize:"14px", marginBottom:"2px", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", color:"white" }}>{clause.title}</div>
                        <div style={{ fontSize:"12px", color:faintText, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{clause.simplified?.substring(0,80)}…</div>
                      </div>
                      <span className={`pill-${clause.risk?.toLowerCase()}`}>{clause.risk}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Red Flags ── */}
          {activeTab === "missing" && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.5rem" }}>
              <div className="glass-card" style={{ padding:"1.5rem", borderTop:"3px solid #f87171" }}>
                <h3 style={{ fontWeight:"700", fontSize:"15px", marginBottom:"1rem", color:"#f87171" }}>🚨 Critical Red Flags</h3>
                {!(analysis.redFlags||[]).length
                  ? <p style={{ color:faintText, fontSize:"14px" }}>No critical red flags detected.</p>
                  : <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                    {(analysis.redFlags||[]).map((rf,i) => (
                      <div key={i} style={{ display:"flex", gap:"10px", alignItems:"flex-start", padding:"10px 14px", background:"rgba(239,68,68,0.08)", borderRadius:"10px", border:"1px solid rgba(239,68,68,0.2)" }}>
                        <span style={{ color:"#f87171", fontWeight:"700", flexShrink:0 }}>!</span>
                        <span style={{ fontSize:"14px", color:dimText, lineHeight:"1.6" }}>{rf}</span>
                      </div>
                    ))}
                  </div>}
              </div>
              <div className="glass-card" style={{ padding:"1.5rem", borderTop:"3px solid #a78bfa" }}>
                <h3 style={{ fontWeight:"700", fontSize:"15px", marginBottom:"1rem", color:"#a78bfa" }}>📋 Missing Protective Clauses</h3>
                {!(analysis.missingClauses||[]).length
                  ? <p style={{ color:faintText, fontSize:"14px" }}>No missing clauses identified.</p>
                  : <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                    {(analysis.missingClauses||[]).map((mc,i) => (
                      <div key={i} style={{ display:"flex", gap:"10px", alignItems:"flex-start", padding:"10px 14px", background:"rgba(139,92,246,0.08)", borderRadius:"10px", border:"1px solid rgba(139,92,246,0.2)" }}>
                        <span style={{ color:"#a78bfa", fontWeight:"700", flexShrink:0 }}>+</span>
                        <span style={{ fontSize:"14px", color:dimText, lineHeight:"1.6" }}>{mc}</span>
                      </div>
                    ))}
                  </div>}
              </div>
              {analysis.signingAdvice && (
                <div className="glass-card" style={{ gridColumn:"1 / -1", padding:"1.5rem", borderLeft:`4px solid ${rc.color}`, background:rc.bg }}>
                  <h3 style={{ fontWeight:"700", fontSize:"15px", marginBottom:"8px", color:rc.color }}>💼 Signing Advice</h3>
                  <p style={{ fontSize:"15px", color:dimText, margin:0, lineHeight:"1.7" }}>{analysis.signingAdvice}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Chat ── */}
          {activeTab === "chat" && (
            <div className="glass-card" style={{ padding:"1.5rem" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"1rem", paddingBottom:"1rem", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ width:40, height:40, borderRadius:"10px", background:"linear-gradient(135deg,#7c3aed,#ec4899)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 0 20px rgba(124,58,237,0.4)" }}>⚖️</div>
                <div>
                  <div style={{ fontWeight:"700", fontSize:"15px", color:"white" }}>AI Legal Advocate</div>
                  <div style={{ fontSize:"12px", color:faintText }}>Answers in {selectedLang?.name} · Cites Indian law</div>
                </div>
                <div style={{ marginLeft:"auto", width:8, height:8, borderRadius:"50%", background:"#4ade80", boxShadow:"0 0 8px #4ade80" }} />
              </div>
              {chatMessages.length===0 && (
                <div style={{ marginBottom:"1.5rem" }}>
                  <div style={{ fontSize:"12px", color:faintText, marginBottom:"8px", fontWeight:"600", textTransform:"uppercase", letterSpacing:"0.5px" }}>Suggested Questions</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
                    {["क्या इस कॉन्ट्रैक्ट पर साइन करना सुरक्षित है?","सबसे खतरनाक क्लॉज़ कौन सा है?","मैं किन शर्तों पर बातचीत कर सकता हूँ?","क्या 36% ब्याज दर कानूनी है?","अगर कंपनी बिना नोटिस के बंद करे तो क्या होगा?"].map(q => (
                      <button key={q} className="btn-outline" style={{ padding:"6px 14px", fontSize:"12px" }} onClick={() => setChatInput(q)}>{q}</button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ minHeight:"200px", maxHeight:"420px", overflowY:"auto", marginBottom:"1rem", display:"flex", flexDirection:"column", gap:"12px" }}>
                {chatMessages.map((msg,i) => (
                  <div key={i} style={{ display:"flex", justifyContent:msg.role==="user"?"flex-end":"flex-start" }}>
                    <div className={msg.role==="user"?"chat-user":"chat-ai"} style={{ maxWidth:"82%", padding:"12px 16px", fontSize:"14px", lineHeight:"1.7", color:"white" }}>
                      {msg.role==="ai" && (
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"6px" }}>
                          <span style={{ fontSize:"12px", color:faintText }}>⚖️ Lawyer AI</span>
                          <button className="btn-voice" style={{ padding:"3px 8px", fontSize:"11px" }} onClick={() => toggleSpeak(msg.text)}>🔊</button>
                        </div>
                      )}
                      {msg.text}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="chat-ai" style={{ alignSelf:"flex-start", padding:"12px 16px", fontSize:"14px", color:faintText }}>
                    ⚖️ Lawyer AI is thinking…
                  </div>
                )}
              </div>
              <div style={{ display:"flex", gap:"10px" }}>
                <input className="dark-input" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key==="Enter"&&handleChat()} placeholder={`Ask in ${selectedLang?.name}…`} />
                <button className="btn-primary" onClick={handleChat} disabled={chatLoading||!chatInput.trim()}>Send ↗</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

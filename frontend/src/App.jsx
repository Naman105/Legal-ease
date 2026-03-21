// =============================================================================
//  Legal-Ease — Frontend  (React + Vite)
//
//  Responsibilities:
//    - Smart PII masking BEFORE sending to backend
//    - Reconstruction of real values in AI output
//    - Lawyer-grade analysis display
//    - Voice (TTS) output
//    - PDF download
//    - Chat assistant
//
//  Place this file at:  src/App.jsx
//  Backend must be running at:  http://127.0.0.1:8000
// =============================================================================

import { useState, useRef, useCallback, useEffect } from "react";

// ── Config --------------------------------------------------------------------
const API_BASE = "http://127.0.0.1:8000";
const API_KEY  = "legal-ease-secret-123";
const HEADERS  = { "X-API-Key": API_KEY };

// ── Languages ----------------------------------------------------------------
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
  High:   { color:"#EF4444", bg:"#FEF2F2", border:"#FECACA", dark:"#DC2626" },
  Medium: { color:"#F59E0B", bg:"#FFFBEB", border:"#FDE68A", dark:"#D97706" },
  Low:    { color:"#22C55E", bg:"#F0FDF4", border:"#A7F3D0", dark:"#059669" },
};

// ── Smart Masking (Layer 1 — runs entirely in browser) -----------------------
function buildMasker() {
  const map = {}, cnt = {};

  function mask(text) {
    let t = text;
    const patterns = [
      { re: /\b[A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?\b/g,               tag: "NAME" },
      { re: /\b\d{10}\b/g,                                                     tag: "PHONE" },
      { re: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,             tag: "EMAIL" },
      { re: /\b[A-Z][a-zA-Z\s]+(?:Pvt\.?\s*Ltd\.?|LLC|Inc\.?|Corp\.?|LLP|Company)\b/g, tag: "COMPANY" },
      { re: /\b(?:GSTIN|PAN|Aadhaar|CIN)\s*[:\-]?\s*[A-Z0-9]{8,}\b/gi,       tag: "ID" },
      { re: /\b(?:Account|A\/C)\s*(?:No\.?)?\s*:?\s*[\dX]{8,}\b/gi,           tag: "BANK" },
      { re: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/g, tag: "DATE" },
      { re: /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,                        tag: "DATE" },
      { re: /\b(?:Plot|Flat|House|Door)\s*No\.?\s*[\d\-]+[,\s]+[A-Z][a-zA-Z\s,]+\b/g, tag: "ADDRESS" },
    ];
    patterns.forEach(({ re, tag }) => {
      t = t.replace(re, (m) => {
        const ex = Object.entries(map).find(([, v]) => v === m);
        if (ex) return ex[0];
        cnt[tag] = (cnt[tag] || 0) + 1;
        const ph = `[${tag}_${cnt[tag]}]`;
        map[ph] = m;
        return ph;
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
    if (Array.isArray(obj))      return obj.map(rebuildObj);
    if (typeof obj === "object") {
      const out = {};
      for (const [k, v] of Object.entries(obj)) out[k] = rebuildObj(v);
      return out;
    }
    return obj;
  }

  return { mask, rebuild, rebuildObj, getMap: () => ({ ...map }) };
}

// ── Voice (TTS) --------------------------------------------------------------
function speak(text, langCode) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt   = new SpeechSynthesisUtterance(text.substring(0, 500));
  utt.lang    = LANG_BCP47[langCode] || "hi-IN";
  utt.rate    = 0.88;
  utt.pitch   = 1;
  const voices = window.speechSynthesis.getVoices();
  const match  = voices.find(v => v.lang.startsWith(utt.lang.split("-")[0]));
  if (match) utt.voice = match;
  window.speechSynthesis.speak(utt);
}
const stopSpeak = () => window.speechSynthesis?.cancel();

// ── Backend calls ------------------------------------------------------------
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...HEADERS, ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || "Request failed");
  }
  return res;
}

async function analyzeContract(maskedText, language) {
  const form = new FormData();
  form.append("file", new Blob([maskedText], { type: "text/plain" }), "contract.txt");
  form.append("language", language);
  const res = await apiFetch("/analyze", { method: "POST", body: form });
  return res.json();
}

async function chatQuestion(question, context, language) {
  const res = await apiFetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, context, language }),
  });
  const d = await res.json();
  return d.answer;
}

async function fetchPDF(analysis, language) {
  const res = await apiFetch("/generate-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      summary:      analysis.summary,
      legalOpinion: analysis.legalOpinion || "",
      clauses:      analysis.clauses,
      recommendations: analysis.recommendations || [],
      redFlags:     analysis.redFlags || [],
      language,
      overallRisk:  analysis.overallRisk,
      keyParties:   analysis.keyParties || "",
    }),
  });
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "legal-ease-report.pdf"; a.click();
  URL.revokeObjectURL(url);
}

// ── Sample contract ----------------------------------------------------------
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
Service Provider retains the right to reuse all work for other clients.

4. LIMITATION OF LIABILITY
Service Provider's aggregate liability under this Agreement shall not exceed Rs. 5,000.
Client shall indemnify and hold harmless Service Provider from ALL losses, damages,
claims and expenses including unlimited consequential and indirect damages arising from
any act or omission related to this Agreement.

5. TERMINATION
Service Provider may terminate this Agreement immediately and without cause.
Client may terminate only on 180 days written notice AND payment of a termination
fee equal to 6 months of fees (Rs. 3,00,000), regardless of services delivered.

6. AUTO-RENEWAL
This Agreement shall automatically renew for successive 2-year terms.
Client must provide 90 days advance written notice via registered post only
to prevent renewal. Email notice shall not be valid.

7. NON-COMPETE & NON-SOLICITATION
Client shall not, directly or indirectly, hire, contract, or engage any employee or
contractor of Service Provider for a period of 5 years after termination anywhere in India.
Violation attracts liquidated damages of Rs. 10,00,000 per instance.

8. DATA COLLECTION AND SHARING
Service Provider may collect Client's business data, customer data, financial information
and may share or sell such data to third parties for business purposes without further
consent from Client. Client waives all rights under the IT Act 2000.

9. GOVERNING LAW AND DISPUTE RESOLUTION
This Agreement shall be governed exclusively by the laws of Singapore.
All disputes shall be resolved by arbitration seated in London, England under ICC Rules.
Language of arbitration shall be English only.

10. CONFIDENTIALITY
Client shall maintain strict confidentiality of all Agreement terms and Service Provider
processes. Service Provider has no confidentiality obligations whatsoever.

11. FORCE MAJEURE
Only Service Provider may invoke force majeure to delay or cancel obligations.
Force majeure does not excuse Client's payment obligations under any circumstances.`;

// ── Donut chart component ----------------------------------------------------
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
    <div style={{ background:"white", borderRadius:"18px", border:"1px solid #E5E7EB",
      padding:"1.5rem", boxShadow:"0 4px 16px rgba(0,0,0,0.08)",
      display:"flex", flexDirection:"column", alignItems:"center" }}>
      <div style={{ fontWeight:"700", fontSize:"17px", color:"#111827",
        alignSelf:"flex-start", marginBottom:"1.25rem" }}>Risk Distribution</div>

      <svg width="220" height="220" viewBox="0 0 220 220">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F0F0F0" strokeWidth={sw} />
        {total > 0
          ? arcs.map((arc,i) => arc.dash > 2 && (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={arc.color} strokeWidth={sw}
              strokeDasharray={`${arc.dash-5} ${arc.gap+5}`}
              strokeDashoffset={-arc.o} strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition:"all 0.7s cubic-bezier(0.4,0,0.2,1)" }} />
          ))
          : <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E5E7EB" strokeWidth={sw} />
        }
        <text x={cx} y={cy-6} textAnchor="middle" fontSize="38" fontWeight="900" fill="#111827">{risky}</text>
        <text x={cx} y={cy+16} textAnchor="middle" fontSize="10.5" fill="#9CA3AF" fontWeight="600" letterSpacing="0.8">
          RISKY CLAUSES FOUND
        </text>
      </svg>

      <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:"8px 16px", margin:"4px 0 1.25rem" }}>
        {segs.map(s => (
          <span key={s.label} style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"13px", color:"#374151", fontWeight:"500" }}>
            <span style={{ width:"11px", height:"11px", borderRadius:"3px", background:s.color, display:"inline-block" }} />
            {s.label}
          </span>
        ))}
      </div>

      <div style={{ display:"flex", width:"100%", justifyContent:"space-around",
        paddingTop:"0.875rem", borderTop:"1px solid #F3F4F6" }}>
        {segs.map(s => (
          <div key={s.label} style={{ textAlign:"center" }}>
            <div style={{ fontSize:"24px", fontWeight:"900", color:s.color, lineHeight:1 }}>{s.count}</div>
            <div style={{ fontSize:"11px", color:"#9CA3AF", marginTop:"4px" }}>{s.label.split(" ")[0]}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop:"1rem", width:"100%", padding:"10px 14px", borderRadius:"10px",
        textAlign:"center", boxSizing:"border-box",
        background: high>0?"#FEF2F2": medium>0?"#FFFBEB":"#F0FDF4",
        border:`1px solid ${high>0?"#FECACA":medium>0?"#FDE68A":"#A7F3D0"}`,
        fontSize:"13px", fontWeight:"700",
        color: high>0?"#DC2626":medium>0?"#D97706":"#059669" }}>
        {high>0
          ? `🚨 ${high} High Risk Clause${high>1?"s":""} — Seek Legal Advice`
          : medium>0
          ? `⚠️ ${medium} Medium Risk — Review Before Signing`
          : "✅ Contract Appears Generally Safe"}
      </div>
    </div>
  );
}

// ── Main App -----------------------------------------------------------------
export default function LegalEase() {
  const [screen,          setScreen]          = useState("landing");
  const [contractText,    setContractText]    = useState("");
  const [language,        setLanguage]        = useState("hi");
  const [analysis,        setAnalysis]        = useState(null);
  const [masker,          setMasker]          = useState(null);
  const [maskedPreview,   setMaskedPreview]   = useState("");
  const [piiCount,        setPiiCount]        = useState(0);
  const [error,           setError]           = useState("");
  const [filterRisk,      setFilterRisk]      = useState("All");
  const [activeTab,       setActiveTab]       = useState("opinion");
  const [chatMessages,    setChatMessages]    = useState([]);
  const [chatInput,       setChatInput]       = useState("");
  const [chatLoading,     setChatLoading]     = useState(false);
  const [expandedClause,  setExpandedClause]  = useState(null);
  const [dragOver,        setDragOver]        = useState(false);
  const [speaking,        setSpeaking]        = useState(false);
  const [pdfLoading,      setPdfLoading]      = useState(false);
  const fileRef = useRef(null);

  // Preload voices
  useEffect(() => { window.speechSynthesis?.getVoices(); }, []);

  const selectedLang = LANGUAGES.find(l => l.code === language);

  // ── File handler -----------------------------------------------------------
  const handleFile = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = e => { setContractText(e.target.result); setScreen("language"); };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  }, [handleFile]);

  // ── Analyze ---------------------------------------------------------------
  const handleAnalyze = async () => {
    if (!contractText.trim()) return;
    setError(""); setScreen("analyzing");
    try {
      const m = buildMasker();
      const masked = m.mask(contractText);
      setMasker(m);
      setMaskedPreview(masked.substring(0, 350) + "…");
      setPiiCount(Object.keys(m.getMap()).length);

      // Send ONLY masked text to backend
      const result = await analyzeContract(masked, language);

      // Reconstruct PII back into all text fields
      const out = m.rebuildObj(result);
      setAnalysis(out);
      setScreen("dashboard");
    } catch (err) {
      setError(err.message);
      setScreen("upload");
    }
  };

  // ── Chat ------------------------------------------------------------------
  const handleChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const q = chatInput; setChatInput("");
    setChatMessages(p => [...p, { role:"user", text:q }]);
    setChatLoading(true);
    try {
      const ans = await chatQuestion(
        q,
        { summary: analysis.summary, legalOpinion: analysis.legalOpinion,
          clauses: analysis.clauses, overallRisk: analysis.overallRisk },
        language
      );
      setChatMessages(p => [...p, { role:"ai", text:ans }]);
      speak(ans, language); setSpeaking(true);
    } catch {
      setChatMessages(p => [...p, { role:"ai", text:"Error occurred. Please retry." }]);
    }
    setChatLoading(false);
  };

  // ── Voice -----------------------------------------------------------------
  const toggleSpeak = (text) => {
    if (speaking) { stopSpeak(); setSpeaking(false); }
    else { speak(text, language); setSpeaking(true); }
  };

  // ── PDF ------------------------------------------------------------------
  const handlePDF = async () => {
    if (!analysis) return;
    setPdfLoading(true);
    try { await fetchPDF(analysis, language); }
    catch (e) { alert("PDF error: " + e.message); }
    setPdfLoading(false);
  };

  const filteredClauses = analysis?.clauses?.filter(
    c => filterRisk === "All" || c.risk === filterRisk
  ) || [];

  const riskCounts = analysis ? {
    High:   analysis.clauses.filter(c => c.risk === "High").length,
    Medium: analysis.clauses.filter(c => c.risk === "Medium").length,
    Low:    analysis.clauses.filter(c => c.risk === "Low").length,
  } : { High:0, Medium:0, Low:0 };

  // ── Shared style helpers --------------------------------------------------
  const S = {
    app:   { fontFamily:"'Segoe UI','Noto Sans Devanagari','Noto Sans Tamil','Noto Sans Telugu',system-ui,sans-serif",
             minHeight:"100vh", background:"linear-gradient(135deg,#EEF2FF 0%,#F0FDF4 50%,#FFF7ED 100%)", color:"#111827" },
    nav:   { background:"rgba(255,255,255,0.95)", backdropFilter:"blur(12px)",
             borderBottom:"1px solid #E5E7EB", padding:"0 2rem",
             display:"flex", alignItems:"center", justifyContent:"space-between",
             height:"64px", position:"sticky", top:0, zIndex:100 },
    logo:  { fontWeight:"800", fontSize:"22px",
             background:"linear-gradient(135deg,#1D4ED8,#059669)",
             WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", cursor:"pointer" },
    card:  { background:"white", borderRadius:"16px", border:"1px solid #E5E7EB",
             padding:"1.5rem", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" },
    badge: c => ({ display:"inline-flex", alignItems:"center", gap:"4px",
                   background:c+"18", color:c, border:`1px solid ${c}40`,
                   borderRadius:"20px", padding:"3px 10px", fontSize:"12px", fontWeight:"600" }),
    btn: (v="primary") => ({
      padding:"11px 22px", borderRadius:"10px", border:"none", fontWeight:"700",
      fontSize:"14px", cursor:"pointer", transition:"all 0.2s",
      display:"inline-flex", alignItems:"center", gap:"8px",
      ...(v==="primary" ? { background:"linear-gradient(135deg,#1D4ED8,#1E40AF)", color:"white", boxShadow:"0 4px 14px rgba(29,78,216,0.3)" }
        : v==="green"   ? { background:"linear-gradient(135deg,#059669,#047857)", color:"white", boxShadow:"0 4px 14px rgba(5,150,105,0.3)" }
        : v==="danger"  ? { background:"#EF4444", color:"white" }
        : v==="voice"   ? { background:"#F0FDF4", color:"#059669", border:"1px solid #A7F3D0" }
        : { background:"white", color:"#374151", border:"1px solid #D1D5DB" }),
    }),
  };

  // ==========================================================================
  // SCREENS
  // ==========================================================================

  // ── Landing ----------------------------------------------------------------
  if (screen === "landing") return (
    <div style={S.app}>
      <nav style={S.nav}>
        <div style={S.logo}>⚖️ Legal-Ease</div>
        <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
          <span style={S.badge("#059669")}>🛡️ Privacy-First</span>
          <span style={S.badge("#1D4ED8")}>🔒 Smart Masking</span>
          <span style={S.badge("#7C3AED")}>⚖️ Lawyer-Grade AI</span>
          <span style={S.badge("#D97706")}>🔊 Voice Output</span>
        </div>
      </nav>

      <div style={{ maxWidth:"1100px", margin:"0 auto", padding:"4rem 2rem" }}>
        {/* Hero */}
        <div style={{ textAlign:"center", marginBottom:"3rem" }}>
          <div style={{ display:"inline-flex", background:"#EEF2FF", borderRadius:"30px",
            padding:"8px 20px", marginBottom:"1.5rem", fontSize:"14px", color:"#4338CA", fontWeight:"600" }}>
            🏆 Gemini AI · Lawyer-Grade Analysis · 8 Indian Languages
          </div>
          <h1 style={{ fontSize:"clamp(2rem,5vw,3.5rem)", fontWeight:"900", lineHeight:"1.15",
            margin:"0 0 1.5rem", color:"#0F172A" }}>
            अपनी भाषा में पाएं<br />
            <span style={{ background:"linear-gradient(135deg,#1D4ED8,#059669)",
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
              वकील जैसी कानूनी सलाह
            </span>
          </h1>
          <p style={{ fontSize:"17px", color:"#4B5563", maxWidth:"680px",
            margin:"0 auto 2.5rem", lineHeight:"1.8" }}>
            Legal-Ease analyzes your contracts like a <strong>senior Indian lawyer</strong> —
            citing Indian Contract Act, IT Act, and relevant precedents.
            Your PII is masked before the AI ever sees it.
            Output delivered in your regional language with voice reading.
          </p>
          <div style={{ display:"flex", gap:"12px", justifyContent:"center", flexWrap:"wrap" }}>
            <button style={S.btn("primary")} onClick={() => setScreen("upload")}>📄 Upload Contract →</button>
            <button style={S.btn("outline")} onClick={() => { setContractText(SAMPLE); setScreen("language"); }}>🧪 Try Sample Contract</button>
          </div>
        </div>

        {/* Language pills */}
        <div style={{ ...S.card, marginBottom:"2rem", textAlign:"center" }}>
          <div style={{ fontSize:"12px", color:"#9CA3AF", fontWeight:"700", marginBottom:"12px",
            textTransform:"uppercase", letterSpacing:"0.5px" }}>8 Supported Languages</div>
          <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:"10px" }}>
            {LANGUAGES.map(l => (
              <span key={l.code} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0",
                borderRadius:"20px", padding:"6px 16px", fontSize:"15px", fontWeight:"600", color:"#1E293B" }}>
                {l.flag} {l.label}
                <span style={{ fontSize:"12px", color:"#94A3B8", marginLeft:"4px" }}>({l.name})</span>
              </span>
            ))}
          </div>
        </div>

        {/* Feature cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",
          gap:"1.5rem", marginBottom:"3rem" }}>
          {[
            { icon:"⚖️", color:"#1D4ED8", title:"Lawyer-Grade Analysis",
              desc:"Every clause is analyzed citing Indian Contract Act 1872, IT Act, Labour laws. Risk scored High/Medium/Low with exact legal reasoning." },
            { icon:"🔒", color:"#7C3AED", title:"Smart PII Masking",
              desc:"Names, IDs, phone numbers, bank details replaced with [NAME_1], [COMPANY_1] in your browser before sending. Gemini never sees real data." },
            { icon:"🌐", color:"#059669", title:"8 Regional Languages",
              desc:"100% output in Hindi, Tamil, Telugu, Marathi, Kannada, Gujarati, Bengali, or Punjabi. Zero English mixing in analysis." },
            { icon:"🔊", color:"#D97706", title:"Voice Response",
              desc:"Click 🔊 on any clause or chat reply to hear it read aloud in your language. Uses browser's built-in text-to-speech." },
            { icon:"📥", color:"#059669", title:"PDF Report",
              desc:"Download a professional report with legal opinion, pie chart, clause table, recommendations — shareable with your lawyer." },
            { icon:"💬", color:"#EF4444", title:"Legal Q&A Chat",
              desc:"Ask follow-up questions like 'Can they actually take unlimited money from me?' Get lawyer-style answers in your language." },
          ].map(f => (
            <div key={f.title} style={{ ...S.card, borderTop:`3px solid ${f.color}` }}>
              <div style={{ fontSize:"26px", marginBottom:"10px" }}>{f.icon}</div>
              <h3 style={{ fontWeight:"700", fontSize:"15px", marginBottom:"8px", color:f.color }}>{f.title}</h3>
              <p style={{ fontSize:"13px", color:"#6B7280", lineHeight:"1.6", margin:0 }}>{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Masking flow */}
        <div style={{ ...S.card, background:"#0F172A", color:"white", padding:"2rem" }}>
          <div style={{ fontSize:"12px", color:"#94A3B8", fontWeight:"700", marginBottom:"1.5rem",
            textTransform:"uppercase", letterSpacing:"1.5px" }}>🔐 How Your Data Stays Private</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:"1rem" }}>
            {[
              { n:"1", icon:"🖥️", color:"#60A5FA", label:"Browser Masks", desc:"PII replaced locally" },
              { n:"2", icon:"📡", color:"#A78BFA", label:"Masked Sent",    desc:"No real PII travels" },
              { n:"3", icon:"🤖", color:"#34D399", label:"Gemini Analyzes",desc:"Sees only placeholders" },
              { n:"4", icon:"📋", color:"#FCD34D", label:"JSON Returned",  desc:"Analysis result back" },
              { n:"5", icon:"✨", color:"#F9A8D4", label:"Browser Rebuilds",desc:"Real values restored" },
            ].map(s => (
              <div key={s.n} style={{ background:"#1E293B", borderRadius:"12px",
                padding:"1rem", borderTop:`2px solid ${s.color}` }}>
                <div style={{ fontSize:"18px", marginBottom:"6px" }}>{s.icon}</div>
                <div style={{ fontSize:"10px", color:s.color, fontWeight:"700", marginBottom:"3px" }}>STEP {s.n}</div>
                <div style={{ fontWeight:"600", fontSize:"12px", marginBottom:"3px" }}>{s.label}</div>
                <div style={{ fontSize:"11px", color:"#94A3B8" }}>{s.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:"1.5rem", background:"#1E293B", borderRadius:"10px",
            padding:"1rem", fontFamily:"monospace", fontSize:"12px" }}>
            <div style={{ color:"#F87171", marginBottom:"4px" }}>❌ Original: Rajesh Kumar, GSTIN 07AAACT1234F1Z5, +91-9876543210</div>
            <div style={{ color:"#6EE7B7" }}>✅ What Gemini sees: [NAME_1], GSTIN [ID_1], [PHONE_1]</div>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Upload ----------------------------------------------------------------
  if (screen === "upload") return (
    <div style={S.app}>
      <nav style={S.nav}>
        <div style={S.logo} onClick={() => setScreen("landing")}>⚖️ Legal-Ease</div>
        <span style={S.badge("#059669")}>🔒 PII masked before upload</span>
      </nav>
      <div style={{ maxWidth:"720px", margin:"0 auto", padding:"3rem 2rem" }}>
        <h2 style={{ fontWeight:"800", fontSize:"28px", marginBottom:"0.5rem" }}>Upload Your Contract</h2>
        <p style={{ color:"#6B7280", marginBottom:"2rem" }}>
          Names, IDs and contacts are masked in your browser before anything is sent.
        </p>

        {error && (
          <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:"10px",
            padding:"1rem", marginBottom:"1.5rem", color:"#DC2626", fontSize:"14px" }}>
            ⚠️ {error}
            {error.toLowerCase().includes("api") && (
              <div style={{ marginTop:"8px", background:"#FFF1F1", borderRadius:"6px",
                padding:"8px", fontSize:"13px" }}>
                💡 Make sure <code>GOOGLE_API_KEY</code> is set in your backend <code>.env</code> file.
              </div>
            )}
          </div>
        )}

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileRef.current?.click()}
          style={{ border:`2px dashed ${dragOver?"#1D4ED8":"#D1D5DB"}`,
            borderRadius:"16px", padding:"3rem", textAlign:"center", cursor:"pointer",
            background:dragOver?"#EEF2FF":"#FAFAFA", transition:"all 0.2s", marginBottom:"1.5rem" }}>
          <input ref={fileRef} type="file" accept=".txt,.pdf" style={{ display:"none" }}
            onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
          <div style={{ fontSize:"48px", marginBottom:"1rem" }}>📄</div>
          <p style={{ fontWeight:"600", marginBottom:"4px" }}>Drag & drop or click to upload</p>
          <p style={{ fontSize:"13px", color:"#9CA3AF" }}>Supports .TXT and .PDF files</p>
          <div style={{ marginTop:"1rem" }}>
            <span style={S.badge("#059669")}>🔒 Masked in browser before upload</span>
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:"1rem", marginBottom:"1.5rem" }}>
          <div style={{ flex:1, height:"1px", background:"#E5E7EB" }} />
          <span style={{ color:"#9CA3AF", fontSize:"13px" }}>OR PASTE TEXT</span>
          <div style={{ flex:1, height:"1px", background:"#E5E7EB" }} />
        </div>

        <textarea
          value={contractText}
          onChange={e => setContractText(e.target.value)}
          placeholder="Paste your contract text here..."
          style={{ width:"100%", height:"220px", padding:"1rem", borderRadius:"12px",
            border:"1px solid #D1D5DB", fontSize:"14px", fontFamily:"inherit",
            resize:"vertical", outline:"none", boxSizing:"border-box", background:"white" }}
        />

        <div style={{ display:"flex", gap:"12px", marginTop:"1.5rem" }}>
          <button style={S.btn("primary")}
            onClick={() => contractText.trim() ? setScreen("language") : null}
            disabled={!contractText.trim()}>
            Next: Select Language →
          </button>
          <button style={S.btn("outline")}
            onClick={() => { setContractText(SAMPLE); setScreen("language"); }}>
            🧪 Use Sample
          </button>
        </div>
      </div>
    </div>
  );

  // ── Language --------------------------------------------------------------
  if (screen === "language") return (
    <div style={S.app}>
      <nav style={S.nav}>
        <div style={S.logo} onClick={() => setScreen("upload")}>⚖️ Legal-Ease</div>
        <button style={{ ...S.btn("outline"), padding:"8px 16px", fontSize:"13px" }}
          onClick={() => setScreen("upload")}>← Back</button>
      </nav>
      <div style={{ maxWidth:"700px", margin:"0 auto", padding:"3rem 2rem" }}>
        <h2 style={{ fontWeight:"800", fontSize:"28px", marginBottom:"0.5rem" }}>Select Output Language</h2>
        <p style={{ color:"#6B7280", marginBottom:"2rem" }}>
          Legal analysis will be 100% in selected language. Zero English mixing.
        </p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"2rem" }}>
          {LANGUAGES.map(lang => (
            <div key={lang.code} onClick={() => setLanguage(lang.code)}
              style={{ ...S.card, cursor:"pointer",
                border: language===lang.code ? "2px solid #1D4ED8" : "1px solid #E5E7EB",
                background: language===lang.code ? "#EEF2FF" : "white",
                display:"flex", alignItems:"center", gap:"12px", padding:"1rem", transition:"all 0.2s" }}>
              <div style={{ fontSize:"22px" }}>{lang.flag}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:"700", fontSize:"17px" }}>{lang.label}</div>
                <div style={{ color:"#6B7280", fontSize:"12px" }}>{lang.name}</div>
              </div>
              {language===lang.code && <div style={{ color:"#1D4ED8", fontWeight:"700" }}>✓</div>}
            </div>
          ))}
        </div>
        <div style={{ ...S.card, background:"#F0FDF4", border:"1px solid #A7F3D0", marginBottom:"2rem" }}>
          <p style={{ margin:0, fontSize:"14px", color:"#065F46" }}>
            ⚖️ <strong>Lawyer-grade analysis in {selectedLang?.name}.</strong>{" "}
            Clauses will be analyzed citing Indian Contract Act, with risk scoring and negotiation advice.
          </p>
        </div>
        <button style={S.btn("green")} onClick={handleAnalyze}>
          🔒 Mask Data & Run Legal Analysis →
        </button>
      </div>
    </div>
  );

  // ── Analyzing ------------------------------------------------------------
  if (screen === "analyzing") return (
    <div style={{ ...S.app, display:"flex", alignItems:"center",
      justifyContent:"center", minHeight:"100vh" }}>
      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
      `}</style>
      <div style={{ textAlign:"center", maxWidth:"520px", padding:"2rem" }}>
        <div style={{ fontSize:"64px", marginBottom:"1.5rem", display:"inline-block",
          animation:"spin 2s linear infinite" }}>⚖️</div>
        <h2 style={{ fontWeight:"800", fontSize:"24px", marginBottom:"0.5rem" }}>
          Running Legal Analysis
        </h2>
        <p style={{ color:"#6B7280", fontSize:"14px", marginBottom:"1.5rem" }}>
          Gemini is analyzing your contract as a senior Indian lawyer would…
        </p>
        <div style={{ display:"flex", flexDirection:"column", gap:"10px", marginBottom:"2rem" }}>
          {[
            { icon:"🔒", text:`${piiCount} PII entities masked in browser` },
            { icon:"📡", text:"Sending only masked text to backend…" },
            { icon:"⚖️", text:"Gemini analyzing clauses with legal reasoning…" },
            { icon:"🌐", text:`Translating full analysis to ${selectedLang?.name}…` },
            { icon:"✨", text:"Reconstructing your real values in output…" },
          ].map((s,i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:"10px",
              background:"white", borderRadius:"10px", padding:"12px 16px",
              border:"1px solid #E5E7EB",
              animation:`pulse 1.5s ease-in-out ${i*0.25}s infinite` }}>
              <span style={{ fontSize:"18px" }}>{s.icon}</span>
              <span style={{ fontSize:"14px", color:"#374151" }}>{s.text}</span>
            </div>
          ))}
        </div>
        {maskedPreview && (
          <div style={{ background:"#0F172A", borderRadius:"10px", padding:"1rem", textAlign:"left" }}>
            <div style={{ fontSize:"11px", color:"#6EE7B7", fontWeight:"600", marginBottom:"6px" }}>
              ✅ WHAT GEMINI RECEIVES (masked):
            </div>
            <div style={{ fontFamily:"monospace", fontSize:"11px", color:"#94A3B8",
              lineHeight:"1.6", wordBreak:"break-all" }}>{maskedPreview}</div>
          </div>
        )}
      </div>
    </div>
  );

  // ── Dashboard ------------------------------------------------------------
  if (screen === "dashboard" && analysis) {
    const rc = RISK_CFG[analysis.overallRisk] || RISK_CFG.Low;

    return (
      <div style={S.app}>
        <nav style={S.nav}>
          <div style={S.logo} onClick={() => setScreen("landing")}>⚖️ Legal-Ease</div>
          <div style={{ display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap" }}>
            <span style={S.badge("#059669")}>🔒 {piiCount} PII protected</span>
            <span style={S.badge("#1D4ED8")}>{selectedLang?.flag} {selectedLang?.name}</span>
            <button style={S.btn("outline")} onClick={handlePDF} disabled={pdfLoading}>
              {pdfLoading ? "⏳ Generating…" : "📥 Download PDF"}
            </button>
            <button style={{ ...S.btn("outline"), padding:"8px 14px", fontSize:"13px" }}
              onClick={() => { setScreen("upload"); setAnalysis(null); setChatMessages([]); stopSpeak(); }}>
              🔄 New
            </button>
          </div>
        </nav>

        <div style={{ maxWidth:"1200px", margin:"0 auto", padding:"2rem" }}>

          {/* Risk Banner */}
          <div style={{
            background: analysis.overallRisk==="High"
              ? "linear-gradient(135deg,#DC2626,#991B1B)"
              : analysis.overallRisk==="Medium"
              ? "linear-gradient(135deg,#D97706,#92400E)"
              : "linear-gradient(135deg,#059669,#065F46)",
            borderRadius:"16px", padding:"1.5rem 2rem", color:"white",
            marginBottom:"1.5rem", display:"flex", flexWrap:"wrap",
            alignItems:"center", justifyContent:"space-between", gap:"12px",
          }}>
            <div>
              <div style={{ fontWeight:"800", fontSize:"22px" }}>
                {analysis.overallRisk==="High" ? "⚠️ HIGH RISK CONTRACT"
                  : analysis.overallRisk==="Medium" ? "🟡 MEDIUM RISK CONTRACT"
                  : "✅ LOW RISK CONTRACT"}
              </div>
              <div style={{ opacity:0.9, fontSize:"14px", marginTop:"4px" }}>
                {analysis.keyParties}
              </div>
              {analysis.signingAdvice && (
                <div style={{ marginTop:"8px", background:"rgba(255,255,255,0.15)",
                  borderRadius:"8px", padding:"6px 12px", fontSize:"13px", fontWeight:"600" }}>
                  💼 {analysis.signingAdvice}
                </div>
              )}
            </div>
            <div style={{ display:"flex", gap:"12px", flexWrap:"wrap" }}>
              {Object.entries(riskCounts).map(([r,c]) => c>0 && (
                <div key={r} style={{ background:"rgba(255,255,255,0.2)", borderRadius:"10px",
                  padding:"8px 16px", textAlign:"center" }}>
                  <div style={{ fontWeight:"800", fontSize:"20px" }}>{c}</div>
                  <div style={{ fontSize:"12px", opacity:0.9 }}>{r}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:"flex", gap:"4px", background:"white", borderRadius:"12px",
            padding:"4px", border:"1px solid #E5E7EB", marginBottom:"1.5rem", overflowX:"auto" }}>
            {[
              { id:"opinion",  label:"⚖️ Legal Opinion" },
              { id:"clauses",  label:"📄 Clause Analysis" },
              { id:"risk",     label:"📊 Risk Dashboard" },
              { id:"missing",  label:"🚨 Red Flags" },
              { id:"chat",     label:"💬 Ask Lawyer AI" },
            ].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                style={{ flex:1, minWidth:"110px", padding:"10px 14px", borderRadius:"8px",
                  border:"none", fontWeight:"600", fontSize:"13px", cursor:"pointer",
                  background: activeTab===t.id ? "#1D4ED8" : "transparent",
                  color: activeTab===t.id ? "white" : "#6B7280",
                  transition:"all 0.2s", whiteSpace:"nowrap" }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Tab: Legal Opinion ------------------------------------------ */}
          {activeTab === "opinion" && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.5rem" }}>

              {/* Summary */}
              <div style={{ gridColumn:"1 / -1", ...S.card }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1rem" }}>
                  <h3 style={{ fontWeight:"700", color:"#1D4ED8", fontSize:"16px", margin:0 }}>
                    📋 Contract Summary
                  </h3>
                  <button style={S.btn("voice")} onClick={() => toggleSpeak(analysis.summary)}>
                    {speaking ? "⏹ Stop" : "🔊 Listen"}
                  </button>
                </div>
                <p style={{ fontSize:"15px", lineHeight:"1.8", color:"#374151", margin:0 }}>
                  {analysis.summary}
                </p>
              </div>

              {/* Legal Opinion */}
              <div style={{ gridColumn:"1 / -1", ...S.card,
                borderLeft:"4px solid #1D4ED8", background:"#EEF2FF" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1rem" }}>
                  <h3 style={{ fontWeight:"700", color:"#1D4ED8", fontSize:"16px", margin:0 }}>
                    ⚖️ Professional Legal Opinion
                  </h3>
                  <button style={S.btn("voice")} onClick={() => toggleSpeak(analysis.legalOpinion)}>
                    {speaking ? "⏹ Stop" : "🔊 Listen"}
                  </button>
                </div>
                <p style={{ fontSize:"15px", lineHeight:"1.9", color:"#1E3A5F", margin:0, fontStyle:"italic" }}>
                  {analysis.legalOpinion}
                </p>
              </div>

              {/* Recommendations */}
              <div style={S.card}>
                <h3 style={{ fontWeight:"700", marginBottom:"1rem", fontSize:"15px" }}>
                  ✅ Recommendations
                </h3>
                <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                  {(analysis.recommendations || []).map((rec, i) => (
                    <div key={i} style={{ display:"flex", gap:"10px", alignItems:"flex-start" }}>
                      <span style={{ background:"#EEF2FF", color:"#1D4ED8", borderRadius:"50%",
                        width:"22px", height:"22px", display:"flex", alignItems:"center",
                        justifyContent:"center", fontWeight:"700", fontSize:"12px", flexShrink:0 }}>
                        {i+1}
                      </span>
                      <span style={{ fontSize:"14px", color:"#374151", lineHeight:"1.6" }}>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Protection Report */}
              <div style={S.card}>
                <h3 style={{ fontWeight:"700", marginBottom:"1rem", fontSize:"15px" }}>
                  🔒 Data Protection Report
                </h3>
                <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                  {Object.entries(masker?.getMap() || {}).slice(0, 8).map(([ph, orig]) => (
                    <div key={ph} style={{ display:"flex", justifyContent:"space-between",
                      alignItems:"center", padding:"8px 12px", background:"#F9FAFB",
                      borderRadius:"8px", fontSize:"13px" }}>
                      <span style={{ fontFamily:"monospace", color:"#7C3AED", fontWeight:"600" }}>{ph}</span>
                      <span style={{ color:"#6B7280" }}>→ {orig.length>22 ? orig.substring(0,22)+"…" : orig}</span>
                    </div>
                  ))}
                  {piiCount === 0 && (
                    <p style={{ fontSize:"13px", color:"#6B7280" }}>No PII entities detected in this contract.</p>
                  )}
                  {piiCount > 8 && (
                    <p style={{ fontSize:"12px", color:"#9CA3AF" }}>
                      …and {piiCount - 8} more entities protected
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Clause Analysis ---------------------------------------- */}
          {activeTab === "clauses" && (
            <div>
              {/* Filter buttons */}
              <div style={{ display:"flex", gap:"8px", marginBottom:"1.5rem", flexWrap:"wrap" }}>
                {["All","High","Medium","Low"].map(f => (
                  <button key={f} onClick={() => setFilterRisk(f)}
                    style={{ padding:"8px 18px", borderRadius:"20px", fontWeight:"600",
                      fontSize:"13px", cursor:"pointer", transition:"all 0.2s",
                      border: filterRisk===f ? "none" : "1px solid #D1D5DB",
                      background: filterRisk===f
                        ? (f==="All"?"#1D4ED8":f==="High"?"#EF4444":f==="Medium"?"#F59E0B":"#22C55E")
                        : "white",
                      color: filterRisk===f ? "white" : "#374151" }}>
                    {f==="All" ? `All (${analysis.clauses.length})`
                      : `${f==="High"?"🔴":f==="Medium"?"🟡":"🟢"} ${f} (${riskCounts[f]})`}
                  </button>
                ))}
              </div>

              {/* Clause cards */}
              <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
                {filteredClauses.map(clause => {
                  const rc = RISK_CFG[clause.risk] || RISK_CFG.Low;
                  const isExp = expandedClause === clause.id;
                  return (
                    <div key={clause.id}
                      style={{ ...S.card, borderLeft:`4px solid ${rc.color}`,
                        background: isExp ? rc.bg : "white",
                        transition:"all 0.2s", cursor:"pointer" }}
                      onClick={() => setExpandedClause(isExp ? null : clause.id)}>

                      {/* Header row */}
                      <div style={{ display:"flex", alignItems:"center",
                        justifyContent:"space-between", gap:"12px" }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:"10px", flexWrap:"wrap" }}>
                            <span style={S.badge(rc.color)}>
                              {clause.risk==="High"?"🔴":clause.risk==="Medium"?"🟡":"🟢"} {clause.risk}
                            </span>
                            <span style={{ fontWeight:"700", fontSize:"15px" }}>{clause.title}</span>
                          </div>
                          {!isExp && (
                            <p style={{ margin:"8px 0 0", fontSize:"14px", color:"#6B7280", lineHeight:"1.5" }}>
                              {clause.simplified?.substring(0,130)}…
                            </p>
                          )}
                        </div>
                        <span style={{ fontSize:"16px", color:"#9CA3AF", transition:"transform 0.2s",
                          display:"inline-block", transform: isExp?"rotate(180deg)":"none" }}>▼</span>
                      </div>

                      {/* Expanded content */}
                      {isExp && (
                        <div style={{ marginTop:"1.25rem", borderTop:`1px solid ${rc.border}`,
                          paddingTop:"1.25rem" }}
                          onClick={e => e.stopPropagation()}>

                          {/* Original quote */}
                          <div style={{ marginBottom:"1rem" }}>
                            <div style={{ fontSize:"11px", fontWeight:"700", color:"#9CA3AF",
                              marginBottom:"6px", textTransform:"uppercase", letterSpacing:"0.5px" }}>
                              📄 Original Contract Language
                            </div>
                            <div style={{ background:"#F9FAFB", borderRadius:"8px", padding:"12px",
                              fontSize:"13px", color:"#374151", fontStyle:"italic", lineHeight:"1.7",
                              borderLeft:"3px solid #D1D5DB" }}>
                              "{clause.original}"
                            </div>
                          </div>

                          {/* Simplified */}
                          <div style={{ marginBottom:"1rem" }}>
                            <div style={{ fontSize:"11px", fontWeight:"700", color:"#9CA3AF",
                              marginBottom:"6px", textTransform:"uppercase", letterSpacing:"0.5px" }}>
                              💡 Plain Language Explanation
                            </div>
                            <div style={{ fontSize:"15px", color:"#111827", lineHeight:"1.8" }}>
                              {clause.simplified}
                            </div>
                          </div>

                          {/* Legal Analysis — the lawyer section */}
                          <div style={{ marginBottom:"1rem", background:"#EEF2FF",
                            borderRadius:"10px", padding:"14px 16px",
                            borderLeft:"3px solid #1D4ED8" }}>
                            <div style={{ fontSize:"11px", fontWeight:"700", color:"#1D4ED8",
                              marginBottom:"8px", textTransform:"uppercase", letterSpacing:"0.5px" }}>
                              ⚖️ Legal Analysis
                            </div>
                            <div style={{ fontSize:"14px", color:"#1E3A5F", lineHeight:"1.8" }}>
                              {clause.legalAnalysis}
                            </div>
                          </div>

                          {/* Warning */}
                          <div style={{ marginBottom:"1rem", background:rc.bg,
                            borderRadius:"10px", padding:"12px 16px",
                            border:`1px solid ${rc.border}` }}>
                            <div style={{ fontSize:"11px", fontWeight:"700", color:rc.dark,
                              marginBottom:"6px", textTransform:"uppercase", letterSpacing:"0.5px" }}>
                              ⚠️ Real-World Risk
                            </div>
                            <div style={{ fontSize:"14px", color:"#374151", lineHeight:"1.7" }}>
                              {clause.warning}
                            </div>
                          </div>

                          {/* Recommendation */}
                          <div style={{ background:"#F0FDF4", borderRadius:"10px",
                            padding:"12px 16px", border:"1px solid #A7F3D0" }}>
                            <div style={{ fontSize:"11px", fontWeight:"700", color:"#059669",
                              marginBottom:"6px", textTransform:"uppercase", letterSpacing:"0.5px" }}>
                              ✅ Negotiation Recommendation
                            </div>
                            <div style={{ fontSize:"14px", color:"#374151", lineHeight:"1.7" }}>
                              {clause.recommendation}
                            </div>
                          </div>

                          {/* Speak button */}
                          <button style={{ ...S.btn("voice"), marginTop:"12px" }}
                            onClick={() => toggleSpeak(
                              `${clause.title}. ${clause.simplified}. ${clause.warning}`
                            )}>
                            🔊 Read Aloud
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Tab: Risk Dashboard ----------------------------------------- */}
          {activeTab === "risk" && (
            <div style={{ display:"grid", gridTemplateColumns:"310px 1fr",
              gap:"1.5rem", alignItems:"start" }}>
              <DonutChart high={riskCounts.High} medium={riskCounts.Medium} low={riskCounts.Low} />
              <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                <h3 style={{ fontWeight:"700", fontSize:"15px", margin:"0 0 4px" }}>
                  Clause Risk Breakdown
                </h3>
                {analysis.clauses.map(clause => {
                  const rc = RISK_CFG[clause.risk] || RISK_CFG.Low;
                  return (
                    <div key={clause.id}
                      style={{ ...S.card, display:"flex", alignItems:"center",
                        gap:"14px", padding:"1rem 1.25rem", cursor:"pointer" }}
                      onClick={() => { setActiveTab("clauses"); setExpandedClause(clause.id); }}>
                      <div style={{ width:"10px", height:"10px", borderRadius:"50%",
                        background:rc.color, flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:"600", fontSize:"14px", marginBottom:"2px",
                          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {clause.title}
                        </div>
                        <div style={{ fontSize:"12px", color:"#6B7280",
                          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {clause.simplified?.substring(0, 80)}…
                        </div>
                      </div>
                      <span style={S.badge(rc.color)}>{clause.risk}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Tab: Red Flags & Missing Clauses ----------------------------- */}
          {activeTab === "missing" && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.5rem" }}>

              {/* Red flags */}
              <div style={{ ...S.card, borderTop:"3px solid #EF4444" }}>
                <h3 style={{ fontWeight:"700", fontSize:"15px", marginBottom:"1rem", color:"#DC2626" }}>
                  🚨 Critical Red Flags
                </h3>
                {(analysis.redFlags || []).length === 0 ? (
                  <p style={{ color:"#6B7280", fontSize:"14px" }}>No critical red flags detected.</p>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                    {(analysis.redFlags || []).map((rf, i) => (
                      <div key={i} style={{ display:"flex", gap:"10px", alignItems:"flex-start",
                        padding:"10px 12px", background:"#FEF2F2", borderRadius:"8px",
                        border:"1px solid #FECACA" }}>
                        <span style={{ color:"#DC2626", fontWeight:"700", fontSize:"16px", flexShrink:0 }}>!</span>
                        <span style={{ fontSize:"14px", color:"#374151", lineHeight:"1.6" }}>{rf}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Missing clauses */}
              <div style={{ ...S.card, borderTop:"3px solid #7C3AED" }}>
                <h3 style={{ fontWeight:"700", fontSize:"15px", marginBottom:"1rem", color:"#7C3AED" }}>
                  📋 Missing Protective Clauses
                </h3>
                {(analysis.missingClauses || []).length === 0 ? (
                  <p style={{ color:"#6B7280", fontSize:"14px" }}>No missing clauses identified.</p>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                    {(analysis.missingClauses || []).map((mc, i) => (
                      <div key={i} style={{ display:"flex", gap:"10px", alignItems:"flex-start",
                        padding:"10px 12px", background:"#F5F3FF", borderRadius:"8px",
                        border:"1px solid #DDD6FE" }}>
                        <span style={{ color:"#7C3AED", fontWeight:"700", fontSize:"16px", flexShrink:0 }}>+</span>
                        <span style={{ fontSize:"14px", color:"#374151", lineHeight:"1.6" }}>{mc}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Signing advice */}
              {analysis.signingAdvice && (
                <div style={{ gridColumn:"1 / -1", ...S.card,
                  borderLeft:`4px solid ${rc.color}`, background:rc.bg }}>
                  <h3 style={{ fontWeight:"700", fontSize:"15px", marginBottom:"8px", color:rc.dark }}>
                    💼 Signing Advice
                  </h3>
                  <p style={{ fontSize:"15px", color:"#374151", margin:0, lineHeight:"1.7" }}>
                    {analysis.signingAdvice}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Chat ---------------------------------------------------- */}
          {activeTab === "chat" && (
            <div style={S.card}>
              <h3 style={{ fontWeight:"700", marginBottom:"0.5rem", fontSize:"16px" }}>
                💬 Ask Lawyer AI
              </h3>
              <p style={{ color:"#6B7280", fontSize:"13px", marginBottom:"1.5rem" }}>
                Ask follow-up questions in {selectedLang?.name}. Answers cite relevant Indian law.
              </p>

              {/* Suggested questions */}
              {chatMessages.length === 0 && (
                <div style={{ marginBottom:"1.5rem" }}>
                  <div style={{ fontSize:"12px", color:"#9CA3AF", marginBottom:"8px", fontWeight:"600" }}>
                    SUGGESTED QUESTIONS
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
                    {[
                      "क्या इस कॉन्ट्रैक्ट पर साइन करना सुरक्षित है?",
                      "सबसे खतरनाक क्लॉज़ कौन सा है और क्यों?",
                      "मैं किन शर्तों पर बातचीत कर सकता हूँ?",
                      "क्या 36% ब्याज दर कानूनी है?",
                      "अगर कंपनी बिना नोटिस के बंद करे तो क्या होगा?",
                    ].map(q => (
                      <button key={q} onClick={() => setChatInput(q)}
                        style={{ ...S.btn("outline"), padding:"6px 14px", fontSize:"13px" }}>
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              <div style={{ minHeight:"200px", maxHeight:"420px", overflowY:"auto",
                marginBottom:"1rem", display:"flex", flexDirection:"column", gap:"12px" }}>
                {chatMessages.map((msg, i) => (
                  <div key={i} style={{ display:"flex",
                    justifyContent: msg.role==="user" ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth:"82%", padding:"12px 16px", borderRadius:"12px",
                      fontSize:"14px", lineHeight:"1.7",
                      background: msg.role==="user" ? "#1D4ED8" : "#F3F4F6",
                      color: msg.role==="user" ? "white" : "#111827" }}>
                      {msg.role==="ai" && (
                        <div style={{ display:"flex", alignItems:"center",
                          justifyContent:"space-between", marginBottom:"6px" }}>
                          <span style={{ fontSize:"12px", color:"#6B7280" }}>⚖️ Lawyer AI</span>
                          <button style={{ ...S.btn("voice"), padding:"3px 8px", fontSize:"11px" }}
                            onClick={() => toggleSpeak(msg.text)}>
                            🔊
                          </button>
                        </div>
                      )}
                      {msg.text}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ alignSelf:"flex-start", background:"#F3F4F6",
                    borderRadius:"12px", padding:"12px 16px", fontSize:"14px", color:"#6B7280" }}>
                    ⚖️ Lawyer AI is thinking…
                  </div>
                )}
              </div>

              {/* Input */}
              <div style={{ display:"flex", gap:"10px" }}>
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && handleChat()}
                  placeholder={`Ask in ${selectedLang?.name}…`}
                  style={{ flex:1, padding:"12px 16px", borderRadius:"10px",
                    border:"1px solid #D1D5DB", fontSize:"14px",
                    fontFamily:"inherit", outline:"none" }}
                />
                <button style={S.btn("primary")} onClick={handleChat}
                  disabled={chatLoading || !chatInput.trim()}>
                  Send ↗
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    );
  }

  return null;
}
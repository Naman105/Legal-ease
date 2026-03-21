from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security.api_key import APIKeyHeader
from pypdf import PdfReader
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from typing import List, Optional
from reportlab.lib.pagesizes import A4
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.piecharts import Pie
import io, json, os
from google import genai
from google.genai import errors as genai_errors, types

# ── Environment ---------------------------------------------------------------
load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "").strip()
GOOGLE_MODEL = os.getenv("GOOGLE_MODEL", "gemini-2.5-flash").strip()
SECRET_API_KEY = os.getenv("SECRET_API_KEY", "").strip()


def get_gemini_client() -> genai.Client:
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not set.")
    return genai.Client(api_key=GOOGLE_API_KEY)

# ── App -----------------------------------------------------------------------
app = FastAPI(title="Legal-Ease API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Auth ----------------------------------------------------------------------
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def verify_key(key: str = Depends(api_key_header)):
    if not SECRET_API_KEY:
        raise HTTPException(status_code=500, detail="SECRET_API_KEY not set.")
    if key != SECRET_API_KEY:
        raise HTTPException(status_code=403, detail="Unauthorized")
    return key


# ── Language map --------------------------------------------------------------
LANG_MAP = {
    "hi": "Hindi", "ta": "Tamil", "te": "Telugu",
    "mr": "Marathi", "kn": "Kannada", "gu": "Gujarati",
    "bn": "Bengali", "pa": "Punjabi",
}


# ── Pydantic models -----------------------------------------------------------
class ChatRequest(BaseModel):
    question: str
    context: dict
    language: str


class ClauseItem(BaseModel):
    id: int
    title: str
    original: str
    simplified: str
    legalAnalysis: str
    risk: str
    warning: str
    recommendation: str
    type: str


class ReportRequest(BaseModel):
    summary: str
    legalOpinion: str
    clauses: List[dict]
    recommendations: List[str]
    redFlags: List[str]
    missingClauses: List[str] = Field(default_factory=list)
    language: str
    overallRisk: str
    keyParties: Optional[str] = ""


# ── Gemini helper -------------------------------------------------------------
def call_gemini(prompt: str, temperature: float = 0.2) -> str:
    client = get_gemini_client()
    try:
        response = client.models.generate_content(
            model=GOOGLE_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=8192,
            )
        )
        return response.text
    except genai_errors.ClientError as e:
        if e.status_code == 429:
            raise HTTPException(
                status_code=429,
                detail="Gemini quota exceeded. Retry later or check billing/quota for the configured API key."
            ) from e
        if e.status_code == 403:
            raise HTTPException(
                status_code=403,
                detail="Gemini API key is not authorized for this request. Check API key restrictions and project setup."
            ) from e
        raise HTTPException(status_code=502, detail=f"Gemini request failed: {e}") from e


# ── PDF text extractor -------------------------------------------------------
def extract_pdf_text(content: bytes) -> str:
    reader = PdfReader(io.BytesIO(content))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


# =============================================================================
#  ROUTES
# =============================================================================

@app.get("/")
def root():
    return {
        "service": "Legal-Ease API",
        "status": "running",
        "gemini_configured": bool(GOOGLE_API_KEY),
        "gemini_model": GOOGLE_MODEL,
        "note": "Frontend handles all PII masking. Backend does AI analysis only."
    }


# ── /analyze ------------------------------------------------------------------
@app.post("/analyze")
async def analyze(
        file: UploadFile = File(...),
        language: str = Form(...),
        _key: str = Depends(verify_key),
):
    """
    Receives ALREADY-MASKED contract text from the React frontend.
    Runs a lawyer-grade Gemini analysis and returns structured JSON.
    """
    # 1. Read file
    content = await file.read()
    if file.filename.lower().endswith(".pdf"):
        contract_text = extract_pdf_text(content)
    else:
        contract_text = content.decode("utf-8", errors="ignore")

    if not contract_text.strip():
        raise HTTPException(status_code=400, detail="Empty contract text received.")

    lang_name = LANG_MAP.get(language, "Hindi")

    # 2. Lawyer-grade prompt
    prompt = f"""You are a highly experienced Indian contract lawyer with 20+ years of practice.
You specialize in commercial contracts, service agreements, vendor contracts, employment bonds,
and rental agreements for small and medium businesses in India.

Your task is to perform a THOROUGH, PROFESSIONAL legal analysis of the contract below.

OUTPUT LANGUAGE: You MUST write every single word of your JSON values in {lang_name}.
The only exceptions are: JSON keys, risk values (High/Medium/Low), type values, and direct English quotes from the contract.

ANALYSIS REQUIREMENTS — think like a senior lawyer:
1. Identify every clause that could harm the weaker party
2. Check for violations of Indian Contract Act 1872, Consumer Protection Act, IT Act, Labour laws
3. Flag unconscionable terms, one-sided obligations, unlimited liability, hidden penalties
4. Identify missing standard protective clauses (e.g. no dispute resolution, no limitation period)
5. Note jurisdiction issues (foreign law governing Indian contracts)
6. Assess termination fairness, notice periods, penalty proportionality
7. Check IP ownership, data privacy compliance, non-compete reasonableness
8. Provide actionable negotiation recommendations for each risky clause

Respond with ONLY this JSON structure (no markdown, no backticks, no text outside JSON):

{{
  "summary": "2-3 sentence factual summary of what this contract is — parties, subject matter, duration — in {lang_name}",

  "legalOpinion": "A 4-5 sentence professional legal opinion in {lang_name} as if written by a senior lawyer. State whether this contract is balanced or one-sided, which party it favors, what the biggest legal risks are, and whether signing is advisable without negotiation.",

  "overallRisk": "High",

  "keyParties": "Identify both parties and their roles in {lang_name}",

  "redFlags": [
    "Critical red flag 1 in {lang_name} — be specific about the legal risk",
    "Critical red flag 2 in {lang_name}",
    "Critical red flag 3 in {lang_name}"
  ],

  "clauses": [
    {{
      "id": 1,
      "title": "Clause name in {lang_name}",
      "original": "Direct verbatim quote from the contract (keep in English)",
      "simplified": "What this clause means in plain {lang_name} — as if explaining to a non-lawyer business owner",
      "legalAnalysis": "Professional legal analysis in {lang_name}: cite specific legal principles, relevant Indian laws (ICA 1872, etc.), why this clause is problematic or acceptable, precedent if relevant",
      "risk": "High",
      "warning": "Specific real-world consequence in {lang_name} — e.g. exact financial exposure, legal liability, business impact",
      "recommendation": "Concrete negotiation advice in {lang_name} — what exact change to demand, what protective language to add",
      "type": "liability"
    }}
  ],

  "recommendations": [
    "Specific actionable recommendation 1 in {lang_name}",
    "Specific actionable recommendation 2 in {lang_name}",
    "Specific actionable recommendation 3 in {lang_name}",
    "Specific actionable recommendation 4 in {lang_name}",
    "Specific actionable recommendation 5 in {lang_name}"
  ],

  "missingClauses": [
    "Important clause missing from this contract in {lang_name}",
    "Another missing clause in {lang_name}"
  ],

  "negotiationPriority": "High|Medium|Low",

  "signingAdvice": "One sentence in {lang_name}: should they sign as-is, negotiate first, or reject?"
}}

IMPORTANT RULES:
- overallRisk must be exactly: High, Medium, or Low
- risk for each clause must be exactly: High, Medium, or Low
- type must be one of: liability, termination, payment, renewal, penalty, data, noncompete, ip, jurisdiction, confidentiality, general
- Provide MINIMUM 6 clauses, ideally 8-10
- legalAnalysis must be substantive — at least 2-3 sentences citing legal principles
- warning must mention specific monetary amounts or legal consequences where visible
- recommendation must be specific and actionable, not generic

CONTRACT TEXT (PII already masked by frontend):
{contract_text}

RESPOND WITH ONLY THE JSON OBJECT."""

    # 3. Call Gemini
    try:
        raw = call_gemini(prompt, temperature=0.1)
        # Strip markdown fences if Gemini adds them
        clean = raw.replace("```json", "").replace("```", "").strip()
        # Extract JSON object
        start = clean.find("{")
        end = clean.rfind("}") + 1
        if start == -1 or end == 0:
            raise ValueError("No JSON found in Gemini response")
        result = json.loads(clean[start:end])
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Gemini returned invalid JSON: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # 4. Return structured response
    return {
        "summary": result.get("summary", ""),
        "legalOpinion": result.get("legalOpinion", ""),
        "overallRisk": result.get("overallRisk", "Low"),
        "keyParties": result.get("keyParties", ""),
        "redFlags": result.get("redFlags", []),
        "clauses": [
            {
                "id": c.get("id", i + 1),
                "title": c.get("title", ""),
                "original": c.get("original", ""),
                "simplified": c.get("simplified", ""),
                "legalAnalysis": c.get("legalAnalysis", ""),
                "risk": c.get("risk", "Low"),
                "warning": c.get("warning", ""),
                "recommendation": c.get("recommendation", ""),
                "type": c.get("type", "general"),
            }
            for i, c in enumerate(result.get("clauses", []))
        ],
        "recommendations": result.get("recommendations", []),
        "missingClauses": result.get("missingClauses", []),
        "negotiationPriority": result.get("negotiationPriority", "Medium"),
        "signingAdvice": result.get("signingAdvice", ""),
        "totalClauses": len(result.get("clauses", [])),
    }


# ── /chat ---------------------------------------------------------------------
@app.post("/chat")
async def chat(req: ChatRequest, _key: str = Depends(verify_key)):
    """
    Answers follow-up legal questions about the analyzed contract.
    Responds in the user's selected language.
    """
    lang_name = LANG_MAP.get(req.language, "Hindi")

    prompt = f"""You are a senior Indian contract lawyer with 20 years of experience.
A client has just had their contract analyzed and wants to ask a follow-up question.
Answer ONLY in {lang_name}. Be precise, practical, and professional.
Use simple language — the client is a small business owner, not a lawyer.
Where relevant, cite applicable Indian law (Indian Contract Act, IT Act, etc.).
Keep answer to 3-5 sentences maximum.

Contract analysis context:
{json.dumps(req.context, ensure_ascii=False, indent=2)}

Client question: {req.question}

Answer in {lang_name} as a helpful lawyer:"""

    try:
        answer = call_gemini(prompt, temperature=0.3)
        return {"answer": answer.strip()}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── /generate-pdf -------------------------------------------------------------
@app.post("/generate-pdf")
async def generate_pdf(req: ReportRequest, _key: str = Depends(verify_key)):
    """
    Generates a professional PDF report with:
    - Legal opinion
    - Risk pie chart
    - Clause-by-clause analysis table
    - Red flags
    - Recommendations
    - Missing clauses
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=0.8 * inch, rightMargin=0.8 * inch,
        topMargin=0.8 * inch, bottomMargin=0.8 * inch
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_s = ParagraphStyle("T", parent=styles["Title"],
                             fontSize=20, spaceAfter=4,
                             textColor=colors.HexColor("#0F172A"))
    subtitle_s = ParagraphStyle("ST", parent=styles["Normal"],
                                fontSize=11, spaceAfter=12,
                                textColor=colors.HexColor("#475569"))
    head_s = ParagraphStyle("H", parent=styles["Heading2"],
                            fontSize=13, spaceBefore=14, spaceAfter=6,
                            textColor=colors.HexColor("#1D4ED8"))
    body_s = ParagraphStyle("B", parent=styles["Normal"],
                            fontSize=10, leading=15,
                            textColor=colors.HexColor("#1E293B"))
    opinion_s = ParagraphStyle("OP", parent=styles["Normal"],
                               fontSize=10, leading=16,
                               textColor=colors.HexColor("#1E293B"),
                               backColor=colors.HexColor("#EEF2FF"),
                               leftIndent=12, rightIndent=12,
                               spaceBefore=4, spaceAfter=4,
                               borderPad=8)
    warn_s = ParagraphStyle("W", parent=body_s,
                            textColor=colors.HexColor("#DC2626"))
    flag_s = ParagraphStyle("F", parent=body_s,
                            textColor=colors.HexColor("#92400E"),
                            leftIndent=12)
    miss_s = ParagraphStyle("M", parent=body_s,
                            textColor=colors.HexColor("#5B21B6"),
                            leftIndent=12)
    foot_s = ParagraphStyle("FT", parent=styles["Normal"],
                            fontSize=8, textColor=colors.HexColor("#94A3B8"))

    risk_colors = {
        "High": colors.HexColor("#DC2626"),
        "Medium": colors.HexColor("#D97706"),
        "Low": colors.HexColor("#059669"),
    }

    story = []

    # ── Header ----------------------------------------------------------------
    story.append(Paragraph("⚖️ Legal-Ease", title_s))
    story.append(Paragraph("AI-Powered Contract Analysis Report", subtitle_s))
    story.append(HRFlowable(width="100%", thickness=1,
                            color=colors.HexColor("#E2E8F0")))
    story.append(Spacer(1, 8))

    # Meta row
    lang_label = LANG_MAP.get(req.language, req.language)
    risk_clr = risk_colors.get(req.overallRisk, colors.black)
    story.append(Paragraph(
        f"Overall Risk: <font color='#{('DC2626' if req.overallRisk == 'High' else 'D97706' if req.overallRisk == 'Medium' else '059669')}'>"
        f"<b>{req.overallRisk}</b></font>"
        f"  |  Language: <b>{lang_label}</b>"
        f"  |  Total Clauses: <b>{len(req.clauses)}</b>",
        body_s
    ))
    if req.keyParties:
        story.append(Paragraph(f"Parties: {req.keyParties}", body_s))
    story.append(Spacer(1, 12))

    # ── Summary ---------------------------------------------------------------
    story.append(Paragraph("📋 Contract Summary", head_s))
    story.append(Paragraph(req.summary, body_s))
    story.append(Spacer(1, 10))

    # ── Legal Opinion ---------------------------------------------------------
    story.append(Paragraph("⚖️ Legal Opinion", head_s))
    story.append(Paragraph(req.legalOpinion, opinion_s))
    story.append(Spacer(1, 10))

    # ── Pie Chart -------------------------------------------------------------
    high_n = sum(1 for c in req.clauses if c.get("risk") == "High")
    med_n = sum(1 for c in req.clauses if c.get("risk") == "Medium")
    low_n = sum(1 for c in req.clauses if c.get("risk") == "Low")

    if high_n + med_n + low_n > 0:
        story.append(Paragraph("📊 Risk Distribution", head_s))
        d = Drawing(340, 180)
        pie = Pie()
        pie.x, pie.y = 80, 10
        pie.width = pie.height = 150
        seg_data = [(low_n, "Low", "#22C55E"), (med_n, "Medium", "#F59E0B"), (high_n, "High", "#EF4444")]
        pie.data = [v for v, _, _ in seg_data if v > 0]
        pie.labels = [l for v, l, _ in seg_data if v > 0]
        for i, (_, _, hx) in enumerate([(v, l, h) for v, l, h in seg_data if v > 0]):
            pie.slices[i].fillColor = colors.HexColor(hx)
        d.add(pie)
        story.append(d)
        story.append(Spacer(1, 8))

    # ── Red Flags -------------------------------------------------------------
    if req.redFlags:
        story.append(Paragraph("🚨 Critical Red Flags", head_s))
        for rf in req.redFlags:
            story.append(Paragraph(f"• {rf}", flag_s))
        story.append(Spacer(1, 10))

    # ── Clause Table ----------------------------------------------------------
    story.append(Paragraph("📄 Clause-by-Clause Legal Analysis", head_s))
    story.append(Spacer(1, 6))

    table_data = [["#", "Clause", "Risk", "Simplified", "Legal Analysis", "Recommendation"]]
    for c in req.clauses:
        table_data.append([
            str(c.get("id", "")),
            (c.get("title", ""))[:35],
            c.get("risk", ""),
            (c.get("simplified", ""))[:90] + ("…" if len(c.get("simplified", "")) > 90 else ""),
            (c.get("legalAnalysis", ""))[:110] + ("…" if len(c.get("legalAnalysis", "")) > 110 else ""),
            (c.get("recommendation", ""))[:80] + ("…" if len(c.get("recommendation", "")) > 80 else ""),
        ])

    tbl = Table(
        table_data,
        colWidths=[0.3 * inch, 1.2 * inch, 0.6 * inch, 1.5 * inch, 1.8 * inch, 1.3 * inch]
    )
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1D4ED8")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, -1), 7.5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#F8FAFC")]),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#E2E8F0")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
    ]))
    # Colour risk column
    for row_i, c in enumerate(req.clauses, start=1):
        clr = risk_colors.get(c.get("risk", "Low"), colors.black)
        tbl.setStyle(TableStyle([
            ("TEXTCOLOR", (2, row_i), (2, row_i), clr),
            ("FONTNAME", (2, row_i), (2, row_i), "Helvetica-Bold"),
        ]))

    story.append(tbl)
    story.append(Spacer(1, 14))

    # ── Recommendations -------------------------------------------------------
    if req.recommendations:
        story.append(Paragraph("✅ Recommendations", head_s))
        for i, r in enumerate(req.recommendations, 1):
            story.append(Paragraph(f"{i}. {r}", body_s))
        story.append(Spacer(1, 10))

    # ── Missing Clauses -------------------------------------------------------
    if req.missingClauses:
        story.append(Paragraph("🧩 Missing Protective Clauses", head_s))
        for clause in req.missingClauses:
            story.append(Paragraph(f"• {clause}", miss_s))
        story.append(Spacer(1, 10))

    # ── Footer ----------------------------------------------------------------
    story.append(HRFlowable(width="100%", thickness=0.5,
                            color=colors.HexColor("#E2E8F0")))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Generated by Legal-Ease AI  |  Powered by Gemini 2.0 Flash  |  "
        "Privacy-First: PII was masked before AI processing — your real data was never exposed to AI.",
        foot_s
    ))

    doc.build(story)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=legal-ease-report.pdf"},
    )


# ── Run directly --------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

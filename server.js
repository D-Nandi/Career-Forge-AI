require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('ERROR: GEMINI_API_KEY is not set in your .env file.');
  process.exit(1);
}

const usageTracker = { count: 0, resetAt: Date.now() + 86400000 };
const DAILY_LIMIT = 18;
const ipMap = new Map();

function checkIPLimit(ip) {
  const now = Date.now();
  const e = ipMap.get(ip) || { count: 0, start: now };
  if (now - e.start > 60000) { ipMap.set(ip, { count: 1, start: now }); return true; }
  if (e.count >= 5) return false;
  e.count++;
  ipMap.set(ip, e);
  return true;
}

function checkDailyLimit() {
  if (Date.now() > usageTracker.resetAt) {
    usageTracker.count = 0;
    usageTracker.resetAt = Date.now() + 86400000;
  }
  if (usageTracker.count >= DAILY_LIMIT) return false;
  usageTracker.count++;
  return true;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithTimeout(url, options, ms = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

const MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash-exp',
];

const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT',       threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

// ── Local template fallback — always works, no API needed ──
function generateTemplateCoverLetter(prompt) {
  try {
    const get = (rx) => (prompt.match(rx)?.[1] || '').trim();
    const name       = get(/- Name: (.+)/);
    const title      = get(/- Title: (.+)/);
    const targetRole = get(/applying to:\s*(.+?)\.?\n/);
    const summary    = get(/- Summary: (.+)/);
    const techRaw    = get(/Technical Skills: (.+)/);
    const softRaw    = get(/Soft Skills: (.+)/);
    const tone       = get(/Write a (\w+) cover letter/) || 'professional';

    const techSkills = techRaw && techRaw !== 'N/A'
      ? techRaw.split(',').slice(0, 4).map(s => s.trim()).filter(Boolean)
      : [];
    const softSkills = softRaw && softRaw !== 'N/A'
      ? softRaw.split(',').slice(0, 2).map(s => s.trim()).filter(Boolean)
      : ['strong communication skills', 'attention to detail'];

    const skillsStr   = techSkills.length ? techSkills.join(', ') : 'a diverse range of relevant technologies';
    const softStr     = softSkills.join(' and ');
    const displayName = name || 'the applicant';
    const displayRole = targetRole || 'this position';
    const displayTitle = title || 'professional';

    const openers = {
      friendly:     'I am thrilled to apply for',
      enthusiastic: 'I am incredibly excited to apply for',
      creative:     'I am reaching out with great enthusiasm regarding',
      concise:      'I am applying for',
      formal:       'I respectfully submit my application for',
      professional: 'I am writing to express my strong interest in',
    };
    const opener = openers[tone] || openers.professional;

    const hasSummary = summary && summary !== 'N/A' && summary.length > 10;

    return `Dear Hiring Manager,

${opener} the ${displayRole} role. As a results-driven ${displayTitle}, I am confident that my skills and experience make me a strong match for your team.

${hasSummary ? summary + '\n\n' : ''}My technical expertise spans ${skillsStr}, which I have applied to deliver measurable impact across projects. I complement these skills with ${softStr}, allowing me to collaborate effectively and adapt quickly in dynamic environments.

I am particularly drawn to this opportunity because it aligns with my professional growth and gives me the chance to contribute meaningfully from day one. I take pride in producing high-quality work and continuously improving my craft.

I would welcome the chance to discuss how my background can benefit your team. Thank you for your time and consideration — I look forward to the possibility of working together.

Sincerely,
${displayName}`;
  } catch (_) {
    return `Dear Hiring Manager,

I am writing to express my strong interest in this position. I believe my skills and experience make me an excellent candidate for your team.

I am a dedicated professional with expertise in the relevant technical areas required for this role. I bring strong communication skills, attention to detail, and a commitment to delivering high-quality results.

I would welcome the opportunity to discuss how I can contribute to your organization. Thank you for considering my application.

Sincerely,
[Your Name]`;
  }
}

// ── Wrap template result to match Gemini response format ──
function templateResponse(text) {
  return {
    status: 200,
    data: {
      candidates: [{
        content: { parts: [{ text }] },
        finishReason: 'STOP',
        _source: 'template',
      }]
    }
  };
}

app.use(cors());
app.use(express.json());

async function callGeminiWithFallback(body) {
  const enrichedBody = { ...body, safetySettings: SAFETY_SETTINGS };
  const fetchOpts = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(enrichedBody),
  };

  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    // ── First attempt ──
    let res, data;
    try {
      console.log(`[TRY] ${model}`);
      res  = await fetchWithTimeout(url, fetchOpts, 12000);
      data = await res.json();
    } catch (e) {
      console.warn(`[SKIP] ${model} timeout/error: ${e.message}`);
      continue;
    }

    // 429 — wait once then retry
    if (res.status === 429) {
      let delaySecs = 8;
      try {
        for (const d of data?.error?.details || [])
          if (d['@type']?.includes('RetryInfo') && d.retryDelay)
            delaySecs = Math.min(Math.ceil(parseFloat(d.retryDelay)) + 1, 10);
      } catch (_) {}
      console.warn(`[429] ${model} — waiting ${delaySecs}s…`);
      await sleep(delaySecs * 1000);
      try {
        res  = await fetchWithTimeout(url, fetchOpts, 12000);
        data = await res.json();
      } catch (e) {
        console.warn(`[SKIP] ${model} retry timeout: ${e.message}`);
        continue;
      }
      if (res.status === 429) { console.warn(`[SKIP] ${model} still 429.`); continue; }
    }

    // Model unavailable — skip
    if (res.status === 404 || res.status === 400) {
      console.warn(`[SKIP] ${model} unavailable (${res.status}).`);
      continue;
    }

    // Error body on 200 — empty output, try next
    if (data?.error) {
      console.warn(`[SKIP] ${model} error body: ${data.error.message}`);
      continue;
    }

    // Empty/blocked candidate — try next
    const candidate = data?.candidates?.[0];
    if (!candidate?.content) {
      console.warn(`[SKIP] ${model} empty candidate (${candidate?.finishReason}).`);
      continue;
    }

    console.log(`[OK] ${model} succeeded.`);
    return { status: 200, data };
  }

  // ── All models failed — use local template ──
  console.warn('[FALLBACK] All models failed. Generating template cover letter.');
  const prompt = body?.contents?.[0]?.parts?.[0]?.text || '';
  return templateResponse(generateTemplateCoverLetter(prompt));
}

// ── Strict version: throws instead of falling back to cover letter ──
async function callGeminiStrict(body) {
  const enrichedBody = { ...body, safetySettings: SAFETY_SETTINGS };
  const fetchOpts = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(enrichedBody),
  };

  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    let res, data;
    try {
      console.log(`[RESUME][TRY] ${model}`);
      res  = await fetchWithTimeout(url, fetchOpts, 15000);
      data = await res.json();
    } catch (e) {
      console.warn(`[RESUME][SKIP] ${model} timeout/error: ${e.message}`);
      continue;
    }
    if (res.status === 429) {
      let delaySecs = 8;
      try {
        for (const d of data?.error?.details || [])
          if (d['@type']?.includes('RetryInfo') && d.retryDelay)
            delaySecs = Math.min(Math.ceil(parseFloat(d.retryDelay)) + 1, 12);
      } catch (_) {}
      console.warn(`[RESUME][429] ${model} — waiting ${delaySecs}s…`);
      await sleep(delaySecs * 1000);
      try {
        res  = await fetchWithTimeout(url, fetchOpts, 15000);
        data = await res.json();
      } catch (e) { console.warn(`[RESUME][SKIP] ${model} retry timeout`); continue; }
      if (res.status === 429) { console.warn(`[RESUME][SKIP] ${model} still 429`); continue; }
    }
    if (res.status === 404 || res.status === 400) { console.warn(`[RESUME][SKIP] ${model} unavailable`); continue; }
    if (data?.error) { console.warn(`[RESUME][SKIP] ${model} error: ${data.error.message}`); continue; }
    const candidate = data?.candidates?.[0];
    if (!candidate?.content) { console.warn(`[RESUME][SKIP] ${model} empty candidate`); continue; }
    console.log(`[RESUME][OK] ${model} succeeded.`);
    return { status: 200, data };
  }
  throw new Error('All Gemini models rate-limited or unavailable.');
}

app.post('/api/generate', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;

  if (!checkIPLimit(ip)) {
    return res.status(429).json({ error: { message: 'Too many requests. Please wait a minute.' } });
  }

  if (!checkDailyLimit()) {
    const resetMins = Math.ceil((usageTracker.resetAt - Date.now()) / 60000);
    // Even on daily quota, return a template so user isn't blocked
    const prompt = req.body?.contents?.[0]?.parts?.[0]?.text || '';
    const { data } = templateResponse(generateTemplateCoverLetter(prompt));
    console.warn('[DAILY QUOTA] Serving template fallback.');
    return res.status(200).json(data);
  }

  try {
    const { status, data } = await callGeminiWithFallback(req.body);
    console.log(`[DONE] Status ${status} | Usage: ${usageTracker.count}/${DAILY_LIMIT}`);
    res.status(status).json(data);
  } catch (err) {
    console.error('Proxy error:', err.message);
    // Even on crash — return template, never a raw error
    const prompt = req.body?.contents?.[0]?.parts?.[0]?.text || '';
    const { data } = templateResponse(generateTemplateCoverLetter(prompt));
    res.status(200).json(data);
  }
});

app.get('/api/usage', (req, res) => {
  const resetMins = Math.ceil((usageTracker.resetAt - Date.now()) / 60000);
  res.json({ used: usageTracker.count, limit: DAILY_LIMIT, remaining: Math.max(0, DAILY_LIMIT - usageTracker.count), resetsInMinutes: resetMins });
});

app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', models: MODELS, time: new Date().toISOString() })
);

// ── Dedicated resume analysis endpoint — separate limit from cover letters ──
const resumeTracker = { count: 0, resetAt: Date.now() + 86400000 };
const RESUME_DAILY_LIMIT = 50;
const resumeIpMap = new Map();

function checkResumeIPLimit(ip) {
  const now = Date.now();
  const e = resumeIpMap.get(ip) || { count: 0, start: now };
  if (now - e.start > 60000) { resumeIpMap.set(ip, { count: 1, start: now }); return true; }
  if (e.count >= 10) return false;
  e.count++;
  resumeIpMap.set(ip, e);
  return true;
}

function checkResumeDailyLimit() {
  if (Date.now() > resumeTracker.resetAt) {
    resumeTracker.count = 0;
    resumeTracker.resetAt = Date.now() + 86400000;
  }
  if (resumeTracker.count >= RESUME_DAILY_LIMIT) return false;
  resumeTracker.count++;
  return true;
}

app.post('/api/analyze-resume', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;

  if (!checkResumeIPLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  }
  if (!checkResumeDailyLimit()) {
    return res.status(429).json({ error: 'Daily analysis limit reached. Try again tomorrow.' });
  }

  const { resumeText, role } = req.body;
  if (!resumeText || resumeText.trim().length < 30) {
    return res.status(400).json({ error: 'No resume text provided.' });
  }

  const prompt = `You are an expert technical recruiter evaluating a resume for a ${role || 'Software Engineer'} position.

Resume Content:
---
${resumeText.slice(0, 6000)}
---

SCORING RULES:
- Score STRICTLY based on the ACTUAL content above — no inflation, no floors.
- Scores reflect real quality. A weak resume should score low (20-40). A strong one scores high (80-95).
- If this resume was generated by CareerForge AI (look for structured sections like "About Me", "Career Objective", proper formatting), give slight credit for structure but still evaluate content.
- Be specific and honest in feedback.

Score on 5 criteria and respond ONLY with valid JSON (no markdown):

{
  "scores": {
    "practicalSkills": <0-25, depth of technical skills demonstrated>,
    "projectQuality": <0-20, quality/depth of projects listed>,
    "industryReadiness": <0-20, deployment/tools/team experience>,
    "impactAchievements": <0-20, metrics/outcomes/action verbs>,
    "atsKeywords": <0-15, ATS keyword density for ${role || 'tech'} roles>
  },
  "totalScore": <exact sum of above 5, range 0-100>,
  "scoreHeadline": "<totalScore>/100 — <one honest line matching the score>",
  "jobReadinessLevel": "<Beginner|Intermediate|Job Ready|Strong Candidate>",
  "jobReadinessDesc": "<2 honest sentences about level and what to do next>",
  "realWorldEvaluation": [
    "<genuine strength — be specific>",
    "<most important gap — be specific and actionable>",
    "<what would take them to the next level>"
  ],
  "roleMatchAnalysis": "<2-3 honest sentences about fit for ${role || 'tech'} roles — both strengths and gaps>",
  "whatToAdd": [
    "<specific improvement 1 based on what's actually missing>",
    "<specific improvement 2>",
    "<specific improvement 3>",
    "<specific improvement 4>"
  ],
  "whatIsWeak": [
    "<the single most impactful weakness in this resume>",
    "<one quick win they can do today>"
  ]
}`;

  try {
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1200 }
    };

    // Use strict version — throws if all models fail, no cover-letter fallback
    const { status, data } = await callGeminiStrict(body);

    if (status !== 200) {
      return res.status(status).json({ error: 'AI evaluation failed.' });
    }

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // Robust JSON extraction — handles markdown fences and extra text
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const clean = jsonMatch ? jsonMatch[0] : rawText.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error('[PARSE ERROR] Could not parse AI JSON:', clean.slice(0, 300));
      return res.status(500).json({ error: 'AI returned invalid JSON.' });
    }

    // Validate totalScore — recalculate if AI got the sum wrong
    if (parsed.scores) {
      const s = parsed.scores;
      const calcTotal = (s.practicalSkills || 0) + (s.projectQuality || 0) +
                        (s.industryReadiness || 0) + (s.impactAchievements || 0) + (s.atsKeywords || 0);
      if (Math.abs(calcTotal - (parsed.totalScore || 0)) > 3) {
        console.warn(`[RESUME] Score mismatch: AI said ${parsed.totalScore}, calculated ${calcTotal}. Using calculated.`);
        parsed.totalScore = calcTotal;
      }
    }

    console.log(`[RESUME ANALYSIS] Score: ${parsed.totalScore} | Role: ${role} | Usage: ${resumeTracker.count}/${RESUME_DAILY_LIMIT}`);
    res.json(parsed);
  } catch (err) {
    console.error('[RESUME ANALYSIS ERROR]', err.message);
    // Return 503 so client knows to use heuristic fallback
    res.status(503).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`CareerForge proxy → http://localhost:${PORT}`);
  console.log(`Models: ${MODELS.join(' → ')} | Daily limit: ${DAILY_LIMIT}`);
});

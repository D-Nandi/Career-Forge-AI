/* ═══════════════════════════════════════════════
   ATS RESUME CHECKER v3 — Score range 60-88
   60-70 = any resume, 70-85 = good resume
═══════════════════════════════════════════════ */
(function () {
    const ROLE_KEYWORDS = {
        frontend: ['html','css','javascript','react','typescript','next.js','tailwind','responsive','component','accessibility','performance','git','ui','ux','webpack','vite','redux','hooks','api','figma'],
        backend: ['node.js','express','rest','api','sql','postgresql','mongodb','docker','redis','authentication','authorization','microservices','ci/cd','linux','aws','scalability','caching','middleware','orm','testing'],
        fullstack: ['react','node.js','javascript','typescript','mongodb','postgresql','rest api','docker','git','ci/cd','authentication','responsive','component','deployment','full-stack','next.js','database','agile','testing','redux'],
        ai: ['python','machine learning','deep learning','tensorflow','pytorch','scikit-learn','pandas','numpy','nlp','data preprocessing','model training','neural networks','feature engineering','regression','classification','jupyter','api','deployment','statistics','sql'],
        data: ['sql','python','excel','tableau','power bi','data visualization','etl','statistics','reporting','dashboard','data cleaning','analysis','kpi','business intelligence','pivot','vlookup','hypothesis','a/b testing','regression','stakeholders'],
        security: ['network security','firewall','penetration testing','siem','vulnerability','incident response','compliance','encryption','kali linux','wireshark','authentication','owasp','risk assessment','iso 27001','threat analysis','soc','python','bash','zero trust','forensics'],
        default: ['communication','problem solving','teamwork','git','agile','project management','documentation','testing','debugging','version control','code review','collaboration','analytical','leadership','time management']
    };
    const STRUCTURE_SECTIONS = ['education','experience','skills','projects','summary','certifications','achievements','contact'];
    const WEAK_PHRASES = ['responsible for','worked on','helped with','assisted in','was part of','duties included','familiar with','exposure to','basic knowledge'];

    let atsResumeText = '';
    let atsCurrentRole = '';

    /* ── drag & drop ── */
    const zone = document.getElementById('atsUploadZone');
    const fileInput = document.getElementById('atsFileInput');

    if (zone) {
        zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('ats-drag-over'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('ats-drag-over'));
        zone.addEventListener('drop', e => {
            e.preventDefault();
            zone.classList.remove('ats-drag-over');
            const file = e.dataTransfer.files[0];
            if (file) handleATSFile(file);
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files[0]) handleATSFile(fileInput.files[0]);
        });
    }

    async function handleATSFile(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['pdf','docx'].includes(ext)) {
            showATSToast('Only PDF and DOCX files are supported.', 'error'); return;
        }
        document.getElementById('atsFileName').textContent = '📄 ' + file.name + ' — Extracting text...';
        document.getElementById('atsAnalyzeRow').style.display = 'none';

        try {
            if (ext === 'pdf') {
                atsResumeText = await extractTextFromPDF(file);
            } else {
                atsResumeText = await extractTextFromDOCX(file);
            }

            if (!atsResumeText || atsResumeText.trim().length < 50) {
                showATSToast('Could not extract enough text from file. Ensure the PDF is not image-only.', 'error');
                document.getElementById('atsFileName').textContent = '';
                return;
            }

            const wordCount = atsResumeText.split(/\s+/).filter(w => w.length > 0).length;
            document.getElementById('atsFileName').textContent = '✅ ' + file.name + ' — ' + wordCount + ' words extracted';
            document.getElementById('atsAnalyzeRow').style.display = 'flex';
            showATSToast('Resume loaded! (' + wordCount + ' words extracted) Click Analyze.', 'success');
        } catch (err) {
            console.error('File parsing error:', err);
            showATSToast('Failed to parse the file. Try a different file or format.', 'error');
            document.getElementById('atsFileName').textContent = '';
        }
    }

    /* Real PDF text extraction using pdf.js */
    async function extractTextFromPDF(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    if (typeof pdfjsLib === 'undefined') { reject(new Error('pdf.js not loaded')); return; }
                    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                    const typedArray = new Uint8Array(e.target.result);
                    const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
                    let fullText = '';
                    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                        const page = await pdf.getPage(pageNum);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items.map(item => item.str).join(' ');
                        fullText += pageText + '\n';
                    }
                    resolve(fullText.trim());
                } catch (err) { reject(err); }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    /* Real DOCX text extraction using mammoth.js */
    async function extractTextFromDOCX(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    if (typeof mammoth === 'undefined') { reject(new Error('mammoth.js not loaded')); return; }
                    const result = await mammoth.extractRawText({ arrayBuffer: e.target.result });
                    resolve(result.value.trim());
                } catch (err) { reject(err); }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    function getKeywordsForRole(role) {
        if (role.includes('frontend')) return ROLE_KEYWORDS.frontend;
        if (role.includes('backend') && !role.includes('full')) return ROLE_KEYWORDS.backend;
        if (role.includes('full') || role.includes('fullstack')) return ROLE_KEYWORDS.fullstack;
        if (role.includes('ai') || role.includes('ml') || role.includes('machine')) return ROLE_KEYWORDS.ai;
        if (role.includes('data') || role.includes('analyst')) return ROLE_KEYWORDS.data;
        if (role.includes('security') || role.includes('cyber')) return ROLE_KEYWORDS.security;
        return ROLE_KEYWORDS.default;
    }

    window.runATSAnalysis = async function () {
        const roleInput = document.getElementById('roleInput');
        atsCurrentRole = roleInput ? roleInput.value.trim() : '';
        if (!atsResumeText) { showATSToast('Please upload a resume first.', 'error'); return; }

        const resultsPanel = document.getElementById('atsResults');
        resultsPanel.style.display = 'block';
        resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });

        const aiLoading = document.getElementById('atsAILoading');
        aiLoading.style.display = 'flex';

        const keywords = getKeywordsForRole(atsCurrentRole.toLowerCase());
        const resumeLower = atsResumeText.toLowerCase();
        const matched = keywords.filter(k => resumeLower.includes(k));
        const missing = keywords.filter(k => !resumeLower.includes(k));
        const kwScore = Math.round((matched.length / keywords.length) * 100);
        const structureFound = STRUCTURE_SECTIONS.filter(s => resumeLower.includes(s));
        const structureScore = Math.round((structureFound.length / STRUCTURE_SECTIONS.length) * 100);
        const weakFound = WEAK_PHRASES.filter(p => resumeLower.includes(p));

        renderKeywordSection(matched, missing, structureFound, weakFound);

        try {
            const aiResult = await runAIEvaluation(atsResumeText, atsCurrentRole || 'Software Engineer');
            aiLoading.style.display = 'none';
            renderAIResults(aiResult, kwScore, structureFound);
        } catch (err) {
            aiLoading.style.display = 'none';
            const fallback = buildFallbackEvaluation(atsCurrentRole, kwScore, structureScore, weakFound, missing, matched);
            renderAIResults(fallback, kwScore, structureFound);
            showATSToast('AI evaluation used offline mode.', 'success');
        }
    };

    async function runAIEvaluation(resumeText, role) {
        const loadingMsgs = [
            'Evaluating practical skill application...',
            'Assessing project quality and relevance...',
            'Checking industry readiness signals...',
            'Analyzing impact and achievements...',
            'Generating role match insights...'
        ];
        let msgIndex = 0;
        const msgEl = document.getElementById('atsAILoadingText');
        const msgInterval = setInterval(() => {
            msgIndex = (msgIndex + 1) % loadingMsgs.length;
            if (msgEl) msgEl.textContent = loadingMsgs[msgIndex];
        }, 1800);

        const response = await fetch('http://localhost:3000/api/analyze-resume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resumeText, role })
        });

        clearInterval(msgInterval);

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'API error: ' + response.status);
        }
        const parsed = await response.json();
        if (parsed.error) throw new Error(parsed.error);
        return parsed;
    }

    /* ─────────────────────────────────────────────────────────
       buildFallbackEvaluation
       Output range: 62 (bare minimum) → 88 (excellent)
       Any resume:  62–70
       Good resume: 70–85
    ───────────────────────────────────────────────────────── */
    function buildFallbackEvaluation(role, kwScore, structureScore, weakFound, missing, matched) {
        const text = atsResumeText || '';
        const tl   = text.toLowerCase();

        /* 1. Tech skills */
        const techTerms = ['react','vue','angular','node','express','django','flask','spring','laravel',
            'python','javascript','typescript','java','c++','c#','go','rust','php','swift','kotlin',
            'sql','mongodb','postgresql','mysql','redis','elasticsearch','docker','kubernetes',
            'aws','azure','gcp','terraform','ansible','git','github','linux','bash','rest','graphql',
            'tensorflow','pytorch','pandas','numpy','scikit','machine learning','deep learning',
            'html','css','tailwind','bootstrap','webpack','vite','next.js','nuxt','flutter','react native',
            'firebase','supabase','prisma','graphql','socket.io','three.js'];
        const techFound = techTerms.filter(t => tl.includes(t));

        /* 2. Project signals */
        const hasProjects = tl.includes('project');
        const hasLinks    = /github\.com\/[\w\-]+\/[\w\-]+|vercel\.app|netlify\.app|deployed|live demo/i.test(text);
        const hasStack    = /react|node\.js|javascript|python|built with|tech stack/i.test(text);
        const githubLinks = (text.match(/github\.com\/[\w\-]+\/[\w\-]+/gi) || []).length;

        /* 3. Industry signals */
        const deploySignals = ['deployed','vercel','netlify','aws','heroku','render','railway',
            'docker','ci/cd','github actions','production','hosted'].filter(s => tl.includes(s));
        const teamSignals   = ['team','agile','scrum','collaborated','code review','mentor',
            'intern','internship','pull request'].filter(s => tl.includes(s));
        const certSignals   = ['certified','certificate','udemy','coursera','freecodecamp',
            'nptel','aws certified','google certified','linkedin learning'].filter(s => tl.includes(s));

        /* 4. Impact signals */
        const hasMetrics  = /\d+%|\d+x|\d+\s*(users|customers|requests|stars|downloads)|\$\d+/i.test(text);
        const strongVerbs = ['developed','built','designed','implemented','led','shipped',
            'optimized','reduced','increased','improved','launched','delivered','created',
            'automated','deployed','integrated','migrated'].filter(v => tl.includes(v));

        /* 5. CareerForge structure */
        const cfSectionsList = ['about me','career objective','experience','education',
            'skills','projects','achievements','certificates','certifications'];
        const cfSectionsFound = cfSectionsList.filter(s => tl.includes(s));
        const isCF = cfSectionsFound.length >= 3;

        /* ── SCORING: base 62, bonuses max 26 → total max 88 ── */
        let score = 62;

        /* Skills bonus 0–8 */
        score += Math.min(8,
            techFound.length >= 12 ? 8 :
            techFound.length >= 9  ? 7 :
            techFound.length >= 7  ? 6 :
            techFound.length >= 5  ? 5 :
            techFound.length >= 3  ? 3 :
            techFound.length >= 1  ? 1 : 0
        );

        /* Project bonus 0–6 */
        if (hasProjects) {
            score += 1;
            if (hasLinks || githubLinks > 0) score += 2;
            if (hasStack) score += 1;
            if (githubLinks >= 2 || (hasLinks && hasStack)) score += 2;
        }

        /* Industry bonus 0–4 */
        score += Math.min(4, Math.round(
            deploySignals.length * 0.8 +
            teamSignals.length   * 0.6 +
            certSignals.length   * 0.7
        ));

        /* Impact bonus 0–3 */
        score += Math.min(3, Math.round((hasMetrics ? 1.5 : 0) + Math.min(1.5, strongVerbs.length * 0.25)));

        /* ATS keywords bonus 0–2 */
        score += Math.min(2, Math.round(kwScore * 0.02));

        /* CareerForge structure bonus 0–3 */
        if (isCF) score += Math.min(3, Math.round(cfSectionsFound.length * 0.4));

        const total = Math.round(Math.max(62, Math.min(88, score)));
        const level = total >= 83 ? 'Strong Candidate' : total >= 74 ? 'Job Ready' : total >= 66 ? 'Intermediate' : 'Getting Started';

        const topMissingKw = missing.slice(0, 3);
        return {
            scores: {
                practicalSkills:    Math.min(25, Math.round(techFound.length / 12 * 25)),
                projectQuality:     Math.min(20, !hasProjects ? 2 : hasLinks && githubLinks >= 2 ? 16 : hasLinks ? 10 : 6),
                industryReadiness:  Math.min(20, Math.round((deploySignals.length * 0.8 + teamSignals.length * 0.6 + certSignals.length * 0.7) / 4 * 20)),
                impactAchievements: Math.min(20, Math.round(((hasMetrics ? 1.5 : 0) + Math.min(1.5, strongVerbs.length * 0.25)) / 3 * 20)),
                atsKeywords:        Math.min(15, Math.round(kwScore * 0.15))
            },
            totalScore: total,
            scoreHeadline: total + '/100 — ' + (
                level === 'Strong Candidate' ? 'Strong profile! A few refinements and you\'ll be highly competitive.' :
                level === 'Job Ready'        ? 'Solid profile. Targeted improvements will get you more callbacks.' :
                level === 'Intermediate'     ? 'Good foundation. These upgrades will noticeably boost your score.' :
                                               'Resume is taking shape. Follow the steps below to improve.'
            ),
            jobReadinessLevel: level,
            jobReadinessDesc:
                level === 'Strong Candidate' ? 'Your resume shows strong technical depth. A few targeted refinements will push you into the top tier of applicants.' :
                level === 'Job Ready'        ? 'Solid experience and relevant skills. Adding measurable outcomes will noticeably improve your callback rate.' :
                level === 'Intermediate'     ? 'Good foundation with relevant skills. Add deployed projects and metrics to stand out.' :
                                               'Your resume is developing. Adding more technical content and deployed projects will boost your score significantly.',
            realWorldEvaluation: [
                techFound.length >= 5
                    ? 'Your technical stack (' + techFound.slice(0,4).join(', ') + ') shows real breadth for a ' + (role || 'tech') + ' role.'
                    : 'Adding more specific technologies (' + topMissingKw.slice(0,2).join(', ') + ') will strengthen your profile.',
                hasLinks
                    ? 'Good — your project links let recruiters verify your work directly. Keep them updated.'
                    : 'Adding GitHub links and live demo URLs is the single highest-impact change you can make.',
                hasMetrics
                    ? 'You have quantified outcomes — this significantly boosts credibility with recruiters.'
                    : 'Add 1–2 specific metrics: "served X users", "reduced load time by Y%", "X+ stars on GitHub".'
            ],
            roleMatchAnalysis: 'For a ' + (role || 'tech') + ' role, your resume shows ' + (techFound.length >= 5 ? 'good' : 'some') + ' technical alignment. ' + (hasLinks ? 'Project links show real initiative.' : 'Adding project links would demonstrate hands-on capability.') + ' ' + (hasMetrics ? 'Your quantified outcomes are a strong differentiator.' : 'Quantifying your impact would make your resume stand out significantly.'),
            whatToAdd: [
                topMissingKw.length ? 'Add these keywords naturally: ' + topMissingKw.join(', ') : 'Add a 2-line professional summary at the top',
                hasMetrics ? 'Add more metrics to every experience entry' : 'Add at least 2 measurable outcomes (e.g. "500+ users", "40% faster")',
                deploySignals.length < 2 ? 'Add a live project link (Vercel/Netlify/GitHub Pages) — high impact signal' : 'Add CI/CD or deployment pipeline details',
                teamSignals.length < 2 ? 'Mention team work: PRs reviewed, agile sprints, or internship collaboration' : 'Highlight leadership or mentoring contributions'
            ],
            whatIsWeak: [
                weakFound.length ? 'Replace passive phrases (' + weakFound.slice(0,2).map(w => '"' + w + '"').join(', ') + ') with verbs like "Built", "Shipped"' : 'Ensure every bullet starts with a strong action verb',
                !hasLinks ? 'Add GitHub and live demo links to every project' : 'Ensure all project links are live and correct'
            ]
        };
    }

    /* ─────────────────────────────────────────────
       renderAIResults — scores already in 60-88 range
       from heuristic; AI scores clamped to same range
    ───────────────────────────────────────────── */
    function renderAIResults(ai, kwScore, structureFound) {
        const raw   = Math.max(0, ai.totalScore || 62);
        /* If raw score is already in target range (heuristic), use it.
           If it's an AI raw score (0-100, typically 40-90), clamp to 62-88. */
        const score = Math.round(Math.max(62, Math.min(88, raw)));
        const color = score >= 82 ? '#10B981' : score >= 72 ? '#F59E0B' : '#6366F1';

        /* Headline: replace any leading "XX/100" with correct score */
        const rawHeadline = ai.scoreHeadline || (score + '/100 — Solid profile with clear next steps');
        const headline    = rawHeadline.replace(/^\d+\/100/, score + '/100');

        animateCount('atsScoreNum', score);
        document.getElementById('atsScoreLabel').textContent    = 'Overall Score';
        document.getElementById('atsScoreLabel').style.color    = color;
        document.getElementById('atsScoreDesc').textContent     = headline;
        document.getElementById('atsScoreCount').textContent    = score + '/100';

        const ring = document.getElementById('atsRingFill');
        const circumference = 314;
        ring.style.stroke = color;
        setTimeout(() => { ring.style.strokeDashoffset = circumference - (circumference * score / 100); }, 100);

        const s = ai.scores || {};
        setBar('atsBarKeyword',   'atsValKeyword',   Math.round((s.practicalSkills    || 0) / 25 * 100), color);
        setBar('atsBarSkills',    'atsValSkills',    Math.round((s.projectQuality     || 0) / 20 * 100), color);
        setBar('atsBarStructure', 'atsValStructure', Math.round((s.industryReadiness  || 0) / 20 * 100), color);
        setBar('atsBarImpact',    'atsValImpact',    Math.round((s.impactAchievements || 0) / 20 * 100), color);
        setBar('atsBarATS',       'atsValATS',       Math.round((s.atsKeywords        || 0) / 15 * 100), color);

        const levelColors = { 'Getting Started': '#EF4444', 'Intermediate': '#6366F1', 'Job Ready': '#3B82F6', 'Strong Candidate': '#10B981' };
        const badge = document.getElementById('atsReadinessBadge');
        const level = ai.jobReadinessLevel || 'Intermediate';
        badge.textContent    = level;
        badge.style.background = levelColors[level] || '#6366F1';
        document.getElementById('atsReadinessDesc').textContent = ai.jobReadinessDesc || '';

        const evalItems = ai.realWorldEvaluation || [];
        document.getElementById('atsRealWorldEval').innerHTML = evalItems.map(insight =>
            '<div class="ats-insight-item"><span class="ats-insight-dot"></span><p>' + insight + '</p></div>'
        ).join('') || '<p class="ats-ai-placeholder">No insights available.</p>';

        document.getElementById('atsRoleMatch').innerHTML =
            '<div class="ats-role-match-text"><p>' + (ai.roleMatchAnalysis || '') + '</p></div>';

        const addItems = ai.whatToAdd || [];
        document.getElementById('atsAddList').innerHTML = addItems.map(i => '<li>' + i + '</li>').join('');

        document.getElementById('atsStructureGrid').innerHTML = STRUCTURE_SECTIONS.map(sec => {
            const found = structureFound.includes(sec);
            return '<div class="ats-struct-item ' + (found ? 'ats-struct-found' : 'ats-struct-missing') + '">' +
                '<span class="ats-struct-icon">' + (found ? '✓' : '✗') + '</span>' +
                '<span>' + sec.charAt(0).toUpperCase() + sec.slice(1) + '</span></div>';
        }).join('');
    }

    function renderKeywordSection(matched, missing, structureFound, weakFound) {
        document.getElementById('atsMatchedList').innerHTML = matched.map(k =>
            '<span class="ats-kw-tag ats-kw-tag-match">' + k + '</span>').join('') || '<span class="ats-kw-empty">None found</span>';
        const topMissing = missing.slice(0, 5);
        document.getElementById('atsMissingList').innerHTML = topMissing.map(k =>
            '<span class="ats-kw-tag ats-kw-tag-miss">' + k + '</span>').join('') || '<span class="ats-kw-empty">All matched!</span>';
    }

    function setBar(barId, valId, pct, color) {
        const el = document.getElementById(barId);
        const vl = document.getElementById(valId);
        if (el) { el.style.width = Math.min(pct, 100) + '%'; el.style.background = color; }
        if (vl) vl.textContent = Math.min(pct, 100) + '%';
    }

    function animateCount(id, target) {
        const el = document.getElementById(id);
        if (!el) return;
        let v = 0;
        const step = Math.ceil(target / 40);
        const iv = setInterval(() => {
            v = Math.min(v + step, target);
            el.textContent = v;
            if (v >= target) clearInterval(iv);
        }, 30);
    }

    window.resetATSChecker = function () {
        atsResumeText = '';
        document.getElementById('atsFileName').textContent = '';
        document.getElementById('atsAnalyzeRow').style.display = 'none';
        document.getElementById('atsResults').style.display = 'none';
        document.getElementById('atsFileInput').value = '';
        document.getElementById('atsScoreCount').textContent = 'Upload resume';
        document.getElementById('atsAILoading').style.display = 'none';
        const ring = document.getElementById('atsRingFill');
        if (ring) ring.style.strokeDashoffset = 314;
    };

    function showATSToast(msg, type) {
        const tc = document.getElementById('toastContainer');
        if (!tc) return;
        const t = document.createElement('div');
        t.className = 'toast ' + type;
        t.textContent = msg;
        tc.appendChild(t);
        setTimeout(() => t.remove(), 3200);
    }
})();

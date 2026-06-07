/* ═══════════════════════════════════════════════════════════════════
   RESUME BUILDER — CareerForge AI
   7 steps total: 6 form steps + Step 7 style/preview panel
═══════════════════════════════════════════════════════════════════ */

(function () {

  const API_BASE_URL =
    (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) || 'http://localhost:3000/api';

  // ── HELPERS ──
  function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
  function esc(s)  { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function rbSetText(id, t) { const el = document.getElementById(id); if (el) el.textContent = t; }
  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── STATE ──
  const rbState = {
    currentStep : 1,
    totalSteps  : 6,   // steps 1-6 are form; step 7 = style panel
    personal    : {},
    profile     : { aboutMe: '', careerObjective: '' },
    experience  : [],
    education   : [],
    skills      : { tech: [], soft: [], languages: [], certificates: [] },
    projects    : [],
    achievements: [],
    declaration : '',
    // preview mirror
    prev: {
      personal    : {},
      exp         : [],
      edu         : [],
      skills      : { tech:[], soft:[], languages:[], certificates:[] },
      projects    : [],
      achievements: [],
      declaration : '',
    },
  };

  let rbActiveTemplate = 'classic';
  let rbActiveStyle    = 'executive';
  const STYLE_PDF_MAP  = { executive:'classic', modern:'modern', minimal:'minimal', creative:'creative', corporate:'corporate', tech:'tech' };
  let rbExpCount = 0, rbEduCount = 0, rbProjCount = 0, rbAchvCount = 0;

  // ── DOM REFS ──
  const rbProgressFill = document.getElementById('rb-progress-fill');
  const rbStepDots     = document.getElementById('rb-step-dots');
  const rbBtnPrev      = document.getElementById('rb-btn-prev');
  const rbBtnNext      = document.getElementById('rb-btn-next');

  // ── INIT DOTS (7 total) ──
  if (rbStepDots) {
    for (let i = 1; i <= 7; i++) {
      const d = document.createElement('div');
      d.className = 'rb-dot' + (i === 1 ? ' active' : '');
      d.dataset.step = i;
      rbStepDots.appendChild(d);
    }
  }

  // ── PROGRESS UPDATE ──
  function rbUpdateProgress() {
    const pct = (rbState.currentStep / 7) * 100;
    if (rbProgressFill) rbProgressFill.style.width = pct + '%';
    const lbl = document.querySelector('#resumeBuilderSection .rb-step-label');
    if (lbl) lbl.innerHTML = `Step <span id="rb-header-step">${rbState.currentStep}</span> of 7`;
    document.querySelectorAll('#resumeBuilderSection .rb-dot').forEach(d => {
      const s = parseInt(d.dataset.step);
      d.className = 'rb-dot' + (s < rbState.currentStep ? ' done' : s === rbState.currentStep ? ' active' : '');
    });
    if (rbBtnPrev) rbBtnPrev.disabled = rbState.currentStep === 1;
    if (rbBtnNext) {
      if (rbState.currentStep === 7) {
        rbBtnNext.innerHTML = '<svg width="14" height="14" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v7M4 6l2.5 2.5L9 6M1 10h11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg> Download PDF';
        rbBtnNext.classList.add('submit');
      } else if (rbState.currentStep === 6) {
        rbBtnNext.innerHTML = 'Choose Style <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        rbBtnNext.classList.add('submit');
      } else {
        rbBtnNext.innerHTML = 'Continue <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        rbBtnNext.classList.remove('submit');
      }
    }
  }

  // ── SHOW STEP ──
  function rbShowStep(next) {
    const cur = document.querySelector('#resumeBuilderSection .rb-form-step.active');
    const tgt = document.querySelector(`#resumeBuilderSection .rb-form-step[data-step="${next}"]`);
    if (!tgt) return;
    if (cur) cur.classList.remove('active');
    tgt.classList.add('active');
    rbState.currentStep = next;
    rbUpdateProgress();
    if (next === 7) { rbSyncToPreview(); rbRenderLivePreview(rbActiveStyle); }
    document.getElementById('resumeBuilderSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── NAVIGATION ──
  if (rbBtnNext) {
    rbBtnNext.addEventListener('click', () => {
      if (rbState.currentStep === 7) { rbActiveTemplate = STYLE_PDF_MAP[rbActiveStyle]||'classic'; rbDownloadPDF(); return; }
      rbSaveStep(rbState.currentStep);
      if (rbState.currentStep < rbState.totalSteps) rbShowStep(rbState.currentStep + 1);
      else rbHandleSubmit();
    });
  }
  if (rbBtnPrev) {
    rbBtnPrev.addEventListener('click', () => {
      rbSaveStep(rbState.currentStep);
      if (rbState.currentStep > 1) rbShowStep(rbState.currentStep - 1);
    });
  }

  // ── SAVE STEP ──
  function rbSaveStep(step) {
    if (step === 1) {
      ['firstName','lastName','jobTitle','email','phone','location','address','linkedin','github'].forEach(k => {
        const el = document.getElementById('rb-' + k);
        if (el) rbState.personal[k] = el.value.trim();
      });
    }
    if (step === 2) {
      rbState.profile.aboutMe         = val('rb-aboutMe');
      rbState.profile.careerObjective = val('rb-careerObjective');
    }
    if (step === 3) document.querySelectorAll('#rb-experienceList .rb-entry-card').forEach(c => rbSyncEntry(c,'experience',c.id));
    if (step === 4) document.querySelectorAll('#rb-educationList  .rb-entry-card').forEach(c => rbSyncEntry(c,'education', c.id));
    if (step === 5) { /* skills managed live via tag inputs */ }
    if (step === 6) {
      rbState.declaration = val('rb-declaration');
      // projects & achievements managed live
    }
  }

  // ── SUBMIT ──
  function rbHandleSubmit() {
    for (let i = 1; i <= 6; i++) rbSaveStep(i);
    rbShowStep(7);
  }

  // ── EXPERIENCE ──
  const rbAddExpBtn = document.getElementById('rb-addExperience');
  if (rbAddExpBtn) rbAddExpBtn.addEventListener('click', () => rbAddExperience());

  function rbAddExperience(data = {}) {
    rbExpCount++;
    const id   = `rbexp_${rbExpCount}`;
    const card = document.createElement('div');
    card.className = 'rb-entry-card expanded'; card.id = id;
    card.innerHTML = `
      <div class="rb-entry-card-header" onclick="rbToggleCard('${id}')">
        <div><div class="rb-entry-card-title">${esc(data.company)||'New Experience'}</div><div class="rb-entry-card-sub">${esc(data.role)||'Role &amp; Company'}</div></div>
        <div class="rb-entry-card-actions"><button class="rb-btn-icon" onclick="event.stopPropagation();rbRemoveEntry('${id}','experience')"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></div>
      </div>
      <div class="rb-entry-card-body"><div class="rb-fields-grid">
        <div class="rb-field-group"><label>Job Title</label><input type="text" name="role" placeholder="e.g. Web Developer" value="${esc(data.role||'')}"></div>
        <div class="rb-field-group"><label>Company / Organisation</label><input type="text" name="company" placeholder="e.g. Google" value="${esc(data.company||'')}"></div>
        <div class="rb-field-group"><label>Start Date</label><input type="text" name="startDate" placeholder="Jan 2022" value="${esc(data.startDate||'')}"></div>
        <div class="rb-field-group"><label>End Date</label><input type="text" name="endDate" placeholder="Present" value="${esc(data.endDate||'')}"></div>
        <div class="rb-field-group full"><label>Description</label><textarea name="description" rows="3" placeholder="Key responsibilities and achievements...">${esc(data.description||'')}</textarea></div>
      </div></div>`;
    const list = document.getElementById('rb-experienceList');
    if (list) list.appendChild(card);
    rbAttachEntryListeners(card,'experience',id);
  }

  // ── EDUCATION ──
  const rbAddEduBtn = document.getElementById('rb-addEducation');
  if (rbAddEduBtn) rbAddEduBtn.addEventListener('click', () => rbAddEducation());

  function rbAddEducation(data = {}) {
    rbEduCount++;
    const id   = `rbedu_${rbEduCount}`;
    const card = document.createElement('div');
    card.className = 'rb-entry-card expanded'; card.id = id;
    card.innerHTML = `
      <div class="rb-entry-card-header" onclick="rbToggleCard('${id}')">
        <div><div class="rb-entry-card-title">${esc(data.institution)||'New Education'}</div><div class="rb-entry-card-sub">${esc(data.degree)||'Degree &amp; Institution'}</div></div>
        <div class="rb-entry-card-actions"><button class="rb-btn-icon" onclick="event.stopPropagation();rbRemoveEntry('${id}','education')"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></div>
      </div>
      <div class="rb-entry-card-body"><div class="rb-fields-grid">
        <div class="rb-field-group"><label>Degree / Course</label><input type="text" name="degree" placeholder="e.g. B.Tech Computer Science" value="${esc(data.degree||'')}"></div>
        <div class="rb-field-group"><label>Institution</label><input type="text" name="institution" placeholder="e.g. Techno Engineering College" value="${esc(data.institution||'')}"></div>
        <div class="rb-field-group"><label>Start Year</label><input type="text" name="startYear" placeholder="2022" value="${esc(data.startYear||'')}"></div>
        <div class="rb-field-group"><label>End Year</label><input type="text" name="endYear" placeholder="2026" value="${esc(data.endYear||'')}"></div>
        <div class="rb-field-group full"><label>Score / Additional Info</label><input type="text" name="info" placeholder="CGPA: 7.12 / Percentage: 88.2%" value="${esc(data.info||'')}"></div>
      </div></div>`;
    const list = document.getElementById('rb-educationList');
    if (list) list.appendChild(card);
    rbAttachEntryListeners(card,'education',id);
  }

  // ── PROJECTS ──
  const rbAddProjBtn = document.getElementById('rb-addProject');
  if (rbAddProjBtn) rbAddProjBtn.addEventListener('click', () => rbAddProject());

  function rbAddProject(data = {}) {
    rbProjCount++;
    const id  = `rbproj_${rbProjCount}`;
    const card = document.createElement('div');
    card.className = 'rb-entry-card expanded'; card.id = id;
    card.innerHTML = `
      <div class="rb-entry-card-header" onclick="rbToggleCard('${id}')">
        <div><div class="rb-entry-card-title">${esc(data.name)||'New Project'}</div><div class="rb-entry-card-sub">${esc(data.url)||'URL / Stack'}</div></div>
        <div class="rb-entry-card-actions"><button class="rb-btn-icon" onclick="event.stopPropagation();rbRemoveProject('${id}')"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></div>
      </div>
      <div class="rb-entry-card-body"><div class="rb-fields-grid">
        <div class="rb-field-group full"><label>Project Name</label><input type="text" name="name" placeholder="e.g. Immersive Recipe Explorer" value="${esc(data.name||'')}"></div>
        <div class="rb-field-group full"><label>Project URL / GitHub Link</label><input type="url" name="url" placeholder="https://github.com/..." value="${esc(data.url||'')}"></div>
        <div class="rb-field-group full"><label>Description / Tech Stack</label><textarea name="description" rows="2" placeholder="Brief description and technologies used...">${esc(data.description||'')}</textarea></div>
      </div></div>`;
    const entry = { _id:id, name:data.name||'', url:data.url||'', description:data.description||'' };
    rbState.projects.push(entry);
    const list = document.getElementById('rb-projectList');
    if (list) list.appendChild(card);
    card.querySelectorAll('input,textarea').forEach(el => {
      el.addEventListener('input', () => {
        const idx = rbState.projects.findIndex(p => p._id === id);
        if (idx > -1 && el.name) rbState.projects[idx][el.name] = el.value.trim();
        const t = card.querySelector('.rb-entry-card-title'), s = card.querySelector('.rb-entry-card-sub');
        const n = card.querySelector('[name="name"]'), u = card.querySelector('[name="url"]');
        if (t && n) t.textContent = n.value || 'New Project';
        if (s && u) s.textContent = u.value || 'URL / Stack';
      });
    });
  }

  window.rbRemoveProject = id => {
    document.getElementById(id)?.remove();
    rbState.projects = rbState.projects.filter(p => p._id !== id);
  };

  // ── ACHIEVEMENTS ──
  const rbAddAchvBtn = document.getElementById('rb-addAchievement');
  if (rbAddAchvBtn) rbAddAchvBtn.addEventListener('click', () => rbAddAchievement());

  function rbAddAchievement(data = {}) {
    rbAchvCount++;
    const id  = `rbachv_${rbAchvCount}`;
    const row = document.createElement('div');
    row.id = id;
    row.style.cssText = 'display:flex;align-items:center;gap:8px;';
    row.innerHTML = `
      <input type="text" style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 13px;color:#e2e8f0;font-size:0.875rem;font-family:Inter,sans-serif;outline:none;box-sizing:border-box;" placeholder="e.g. Led college events, 1st place in Drama Competition..." value="${esc(data.text||'')}">
      <button onclick="rbRemoveAchievement('${id}')" style="background:none;border:none;color:rgba(255,255,255,0.35);cursor:pointer;padding:6px;border-radius:5px;">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>`;
    const entry = { _id:id, text:data.text||'' };
    rbState.achievements.push(entry);
    const list = document.getElementById('rb-achievementList');
    if (list) list.appendChild(row);
    const inp = row.querySelector('input');
    if (inp) inp.addEventListener('input', () => {
      const idx = rbState.achievements.findIndex(a => a._id === id);
      if (idx > -1) rbState.achievements[idx].text = inp.value.trim();
    });
  }

  window.rbRemoveAchievement = id => {
    document.getElementById(id)?.remove();
    rbState.achievements = rbState.achievements.filter(a => a._id !== id);
  };

  // ── CARD HELPERS ──
  window.rbToggleCard  = id => document.getElementById(id)?.classList.toggle('expanded');
  window.rbRemoveEntry = (id, type) => {
    document.getElementById(id)?.remove();
    if (type === 'experience') rbState.experience = rbState.experience.filter(e => e._id !== id);
    if (type === 'education')  rbState.education  = rbState.education.filter(e  => e._id !== id);
  };

  function rbAttachEntryListeners(card, type, id) {
    card.querySelectorAll('input,textarea').forEach(inp => inp.addEventListener('input', () => rbSyncEntry(card,type,id)));
    const titleEl = card.querySelector('.rb-entry-card-title');
    const subEl   = card.querySelector('.rb-entry-card-sub');
    card.querySelectorAll('input').forEach(inp => inp.addEventListener('input', () => {
      const role = card.querySelector('[name="role"]'), co   = card.querySelector('[name="company"]');
      const deg  = card.querySelector('[name="degree"]'), inst = card.querySelector('[name="institution"]');
      if (role && co)   { titleEl.textContent = co.value||'New Experience';  subEl.textContent = role.value||'Role & Company'; }
      if (deg  && inst) { titleEl.textContent = inst.value||'New Education'; subEl.textContent = deg.value||'Degree & Institution'; }
    }));
  }

  function rbSyncEntry(card, type, id) {
    const data = { _id:id };
    card.querySelectorAll('input,textarea').forEach(el => { if (el.name) data[el.name] = el.value.trim(); });
    const arr = type === 'experience' ? rbState.experience : rbState.education;
    const idx = arr.findIndex(e => e._id === id);
    if (idx > -1) arr[idx] = data; else arr.push(data);
  }

  // ── TAG INPUTS ──
  function rbSetupTagInput(inputId, displayId, key) {
    const input = document.getElementById(inputId), display = document.getElementById(displayId);
    if (!input || !display) return;
    input.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
        e.preventDefault();
        rbAddTag(input.value.replace(',','').trim(), key, display);
        input.value = '';
      }
      if (e.key === 'Backspace' && !input.value && rbState.skills[key].length > 0) {
        const last = rbState.skills[key].pop();
        display.querySelector(`[data-tag="${last}"]`)?.remove();
      }
    });
  }

  function rbAddTag(text, key, display) {
    if (!text || rbState.skills[key].includes(text)) return;
    rbState.skills[key].push(text);
    const tag = document.createElement('span');
    tag.className = 'rb-tag'; tag.dataset.tag = text;
    tag.innerHTML = `${esc(text)}<span class="rb-tag-remove" onclick="rbRemoveTag('${text}','${key}',this)"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span>`;
    display.appendChild(tag);
  }

  window.rbRemoveTag = (text, key, el) => {
    rbState.skills[key] = rbState.skills[key].filter(t => t !== text);
    el.closest('.rb-tag')?.remove();
  };

  // ── STYLE CARDS ──
  document.querySelectorAll('#rb-style-grid .rb-style-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('#rb-style-grid .rb-style-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      rbActiveStyle    = card.dataset.style;
      rbActiveTemplate = STYLE_PDF_MAP[rbActiveStyle]||'classic';
      rbRenderLivePreview(rbActiveStyle);
    });
  });

  const rbBtnGenerate = document.getElementById('rb-btn-generate');
  if (rbBtnGenerate) rbBtnGenerate.addEventListener('click', () => { rbActiveTemplate = STYLE_PDF_MAP[rbActiveStyle]||'classic'; rbDownloadPDF(); });

  // ── SYNC FORM → PREVIEW STATE ──
  function rbSyncToPreview() {
    const pp = rbState.prev.personal;
    ['firstName','lastName','jobTitle','email','phone','location','address','linkedin','github'].forEach(k => {
      const el = document.getElementById('rb-' + k);
      pp[k === 'jobTitle' ? 'title' : k] = el ? el.value.trim() : (rbState.personal[k]||'');
    });
    pp.aboutMe         = val('rb-aboutMe')         || rbState.profile.aboutMe;
    pp.careerObjective = val('rb-careerObjective')  || rbState.profile.careerObjective;
    rbState.prev.skills       = { tech:[...rbState.skills.tech], soft:[...rbState.skills.soft], languages:[...rbState.skills.languages], certificates:[...rbState.skills.certificates] };
    rbState.prev.exp          = [...rbState.experience];
    rbState.prev.edu          = [...rbState.education];
    rbState.prev.projects     = [...rbState.projects];
    rbState.prev.achievements = [...rbState.achievements];
    rbState.prev.declaration  = val('rb-declaration') || rbState.declaration;
  }

  // ── LIVE PREVIEW RENDERER ──
  function rbRenderLivePreview(style) {
    const frame = document.getElementById('rb-live-preview-frame');
    if (!frame) return;

    const p    = rbState.prev.personal;
    const exp  = rbState.prev.exp.filter(e => e.role || e.company);
    const edu  = rbState.prev.edu.filter(e => e.degree || e.institution);
    const tech = rbState.prev.skills.tech         || [];
    const soft = rbState.prev.skills.soft         || [];
    const lang = rbState.prev.skills.languages    || [];
    const cert = rbState.prev.skills.certificates || [];
    const proj = rbState.prev.projects.filter(p  => p.name);
    const achv = rbState.prev.achievements.filter(a => a.text);
    const decl = rbState.prev.declaration;

    const fullName = [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Your Name';
    const contacts = [p.email, p.phone, p.location, p.address, p.linkedin, p.github].filter(Boolean);

    const pill  = (t,c) => `<span style="display:inline-block;background:${c};color:#fff;border-radius:4px;padding:2px 8px;font-size:9px;margin:2px 3px 2px 0;">${esc(t)}</span>`;
    const secH  = (label,color) => `<div style="font-size:8.5px;font-weight:700;letter-spacing:1.2px;color:${color};border-bottom:1.5px solid ${color};padding-bottom:2px;margin-bottom:7px;">${label}</div>`;
    const sec   = (label, color, content) => content ? `<div style="margin-bottom:12px;">${secH(label,color)}${content}</div>` : '';
    const expHtml = (entries, ac) => entries.map(e => `
      <div style="margin-bottom:9px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;">
          <strong style="font-size:10px;color:#111;">${esc(e.role)}</strong>
          <span style="font-size:8.5px;color:#888;">${[e.startDate,e.endDate].filter(Boolean).join(' – ')}</span>
        </div>
        <div style="font-size:9px;color:${ac};font-style:italic;">${esc(e.company)}</div>
        ${e.description?`<div style="font-size:8.5px;color:#555;line-height:1.5;margin-top:2px;">${esc(e.description)}</div>`:''}
      </div>`).join('');
    const eduHtml = (entries, ac) => entries.map(e => `
      <div style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:baseline;">
        <div>
          <strong style="font-size:10px;color:#111;">${esc(e.degree)}</strong>
          <div style="font-size:9px;color:${ac};font-style:italic;">${esc(e.institution)}</div>
          ${e.info?`<div style="font-size:8.5px;color:#888;">${esc(e.info)}</div>`:''}
        </div>
        <span style="font-size:8.5px;color:#888;white-space:nowrap;margin-left:6px;">${[e.startYear,e.endYear].filter(Boolean).join(' – ')}</span>
      </div>`).join('');
    const projHtml = (entries, ac) => entries.map(e => `
      <div style="margin-bottom:8px;">
        <div style="font-size:10px;font-weight:700;color:#111;">${esc(e.name)}${e.url?` <span style="font-size:8.5px;font-weight:400;color:${ac};">(${esc(e.url)})</span>`:''}</div>
        ${e.description?`<div style="font-size:8.5px;color:#555;line-height:1.5;">${esc(e.description)}</div>`:''}
      </div>`).join('');
    const achvHtml = entries => `<ul style="margin:0;padding-left:14px;">${entries.map(a=>`<li style="font-size:9px;color:#444;margin-bottom:3px;line-height:1.5;">${esc(a.text)}</li>`).join('')}</ul>`;

    let html = '';

    if (style === 'executive') {
      const ac = '#6366f1';
      html = `<div style="font-family:Georgia,serif;background:#fff;min-height:100%;padding:0;">
        <div style="background:#1e293b;padding:18px 22px 12px;">
          <div style="font-size:20px;font-weight:700;color:#fff;">${esc(fullName)}</div>
          <div style="font-size:10px;color:#94a3b8;margin:3px 0;">${esc(p.title)}</div>
          <div style="font-size:8px;color:#64748b;">${[p.email,p.phone,p.location].filter(Boolean).map(esc).join(' &nbsp;|&nbsp; ')}</div>
          ${[p.linkedin,p.github].filter(Boolean).map(v=>`<div style="font-size:7.5px;color:#475569;">${esc(v)}</div>`).join('')}
        </div>
        <div style="padding:14px 22px;">
          ${p.aboutMe?sec('ABOUT ME',ac,`<div style="font-size:9px;color:#444;line-height:1.6;">${esc(p.aboutMe)}</div>`):''}
          ${p.careerObjective?sec('CAREER OBJECTIVE',ac,`<div style="font-size:9px;color:#444;line-height:1.6;">${esc(p.careerObjective)}</div>`):''}
          ${exp.length?sec('EXPERIENCE',ac,expHtml(exp,'#4b5563')):''}
          ${edu.length?sec('EDUCATION',ac,eduHtml(edu,'#4b5563')):''}
          ${tech.length||soft.length||lang.length?sec('SKILLS',ac,
            (tech.length?`<div style="font-size:9px;margin-bottom:4px;"><strong>Technical:</strong> ${tech.map(t=>pill(t,ac)).join('')}</div>`:'')+
            (soft.length?`<div style="font-size:9px;margin-bottom:4px;"><strong>Soft:</strong> ${soft.map(t=>pill(t,'#8b5cf6')).join('')}</div>`:'')+
            (lang.length?`<div style="font-size:9px;"><strong>Languages:</strong> ${lang.map(t=>pill(t,'#0891b2')).join('')}</div>`:'')):''}
          ${cert.length?sec('CERTIFICATES',ac,cert.map(c=>`<div style="font-size:9px;color:#444;margin-bottom:2px;">• ${esc(c)}</div>`).join('')):''}
          ${proj.length?sec('PROJECTS',ac,projHtml(proj,ac)):''}
          ${achv.length?sec('ACHIEVEMENTS',ac,achvHtml(achv)):''}
          ${decl?`<div style="margin-top:10px;border-top:1px solid #e2e8f0;padding-top:7px;font-size:8px;color:#9ca3af;font-style:italic;">${esc(decl)}</div>`:''}
        </div></div>`;

    } else if (style === 'modern') {
      const ac = '#6366f1';
      const initials = [p.firstName,p.lastName].filter(Boolean).map(n=>n[0]?.toUpperCase()).join('')||'?';
      html = `<div style="font-family:Inter,Arial,sans-serif;display:flex;min-height:100%;background:#fff;">
        <div style="width:36%;background:#0f172a;padding:16px 14px;box-sizing:border-box;flex-shrink:0;">
          <div style="width:46px;height:46px;border-radius:50%;background:${ac};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#fff;margin:0 auto 10px;">${esc(initials)}</div>
          <div style="text-align:center;font-size:11px;font-weight:700;color:#f1f5f9;">${esc(fullName)}</div>
          <div style="text-align:center;font-size:8.5px;color:#94a3b8;margin-bottom:10px;">${esc(p.title)}</div>
          <div style="font-size:7.5px;font-weight:700;color:${ac};letter-spacing:1px;margin-bottom:5px;">CONTACT</div>
          ${[p.email,p.phone,p.location,p.address].filter(Boolean).map(c=>`<div style="font-size:7.5px;color:#cbd5e1;margin-bottom:3px;">${esc(c)}</div>`).join('')}
          ${[p.linkedin,p.github].filter(Boolean).map(c=>`<div style="font-size:7px;color:#94a3b8;margin-bottom:2px;word-break:break-all;">${esc(c)}</div>`).join('')}
          ${tech.length?`<div style="margin-top:10px;"><div style="font-size:7.5px;font-weight:700;color:${ac};letter-spacing:1px;margin-bottom:5px;">SKILLS</div>${tech.map(t=>`<div style="font-size:8px;color:#e2e8f0;margin-bottom:2px;">• ${esc(t)}</div>`).join('')}</div>`:''}
          ${soft.length?`<div style="margin-top:8px;"><div style="font-size:7.5px;font-weight:700;color:${ac};letter-spacing:1px;margin-bottom:5px;">SOFT SKILLS</div>${soft.map(t=>`<div style="font-size:8px;color:#e2e8f0;margin-bottom:2px;">• ${esc(t)}</div>`).join('')}</div>`:''}
          ${lang.length?`<div style="margin-top:8px;"><div style="font-size:7.5px;font-weight:700;color:${ac};letter-spacing:1px;margin-bottom:5px;">LANGUAGES</div>${lang.map(t=>`<div style="font-size:8px;color:#e2e8f0;margin-bottom:2px;">• ${esc(t)}</div>`).join('')}</div>`:''}
          ${cert.length?`<div style="margin-top:8px;"><div style="font-size:7.5px;font-weight:700;color:${ac};letter-spacing:1px;margin-bottom:5px;">CERTIFICATES</div>${cert.map(c=>`<div style="font-size:7.5px;color:#cbd5e1;margin-bottom:2px;">• ${esc(c)}</div>`).join('')}</div>`:''}
        </div>
        <div style="flex:1;padding:16px;box-sizing:border-box;overflow:hidden;">
          ${p.aboutMe?sec('ABOUT ME',ac,`<div style="font-size:9px;color:#374151;line-height:1.6;">${esc(p.aboutMe)}</div>`):''}
          ${p.careerObjective?sec('CAREER OBJECTIVE',ac,`<div style="font-size:9px;color:#374151;line-height:1.6;">${esc(p.careerObjective)}</div>`):''}
          ${exp.length?sec('EXPERIENCE',ac,expHtml(exp,'#4f46e5')):''}
          ${edu.length?sec('EDUCATION',ac,eduHtml(edu,'#4f46e5')):''}
          ${proj.length?sec('PROJECTS',ac,projHtml(proj,ac)):''}
          ${achv.length?sec('ACHIEVEMENTS',ac,achvHtml(achv)):''}
          ${decl?`<div style="margin-top:8px;font-size:8px;color:#9ca3af;font-style:italic;">${esc(decl)}</div>`:''}
        </div></div>`;

    } else if (style === 'minimal') {
      const ac = '#374151';
      html = `<div style="font-family:'Georgia',serif;background:#faf9f7;padding:24px;min-height:100%;">
        <div style="font-size:22px;font-weight:700;color:#111;">${esc(fullName)}</div>
        ${p.title?`<div style="font-size:11px;color:#6b7280;margin:3px 0 4px;">${esc(p.title)}</div>`:''}
        <div style="font-size:8px;color:#9ca3af;margin-bottom:2px;">${[p.email,p.phone,p.location].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ')}</div>
        ${p.address?`<div style="font-size:7.5px;color:#b0b8c4;">${esc(p.address)}</div>`:''}
        ${[p.linkedin,p.github].filter(Boolean).map(v=>`<div style="font-size:7.5px;color:#9ca3af;">${esc(v)}</div>`).join('')}
        <div style="border-top:1.5px solid #111;margin:7px 0 12px;"></div>
        ${p.aboutMe?sec('ABOUT ME',ac,`<div style="font-size:9px;color:#4b5563;line-height:1.6;">${esc(p.aboutMe)}</div>`):''}
        ${p.careerObjective?sec('CAREER OBJECTIVE',ac,`<div style="font-size:9px;color:#4b5563;line-height:1.6;">${esc(p.careerObjective)}</div>`):''}
        ${exp.length?sec('EXPERIENCE',ac,expHtml(exp,'#6b7280')):''}
        ${edu.length?sec('EDUCATION',ac,eduHtml(edu,'#6b7280')):''}
        ${tech.length||soft.length?sec('SKILLS',ac,
          (tech.length?`<div style="font-size:9px;margin-bottom:3px;"><strong>Technical:</strong> <span style="color:#6b7280;">${tech.map(esc).join(', ')}</span></div>`:'')+
          (soft.length?`<div style="font-size:9px;margin-bottom:3px;"><strong>Soft:</strong> <span style="color:#6b7280;">${soft.map(esc).join(', ')}</span></div>`:'')+
          (lang.length?`<div style="font-size:9px;"><strong>Languages:</strong> <span style="color:#6b7280;">${lang.map(esc).join(', ')}</span></div>`:'')):''}
        ${cert.length?sec('CERTIFICATES',ac,cert.map(c=>`<div style="font-size:9px;color:#6b7280;">• ${esc(c)}</div>`).join('')):''}
        ${proj.length?sec('PROJECTS',ac,projHtml(proj,'#6b7280')):''}
        ${achv.length?sec('ACHIEVEMENTS',ac,achvHtml(achv)):''}
        ${decl?`<div style="margin-top:10px;font-size:8px;color:#9ca3af;font-style:italic;">${esc(decl)}</div>`:''}
      </div>`;

    } else if (style === 'creative') {
      const ac = '#7c3aed', ac2 = '#2563eb';
      const initials = [p.firstName,p.lastName].filter(Boolean).map(n=>n[0]?.toUpperCase()).join('')||'?';
      html = `<div style="font-family:Inter,Arial,sans-serif;background:#fff;min-height:100%;">
        <div style="background:linear-gradient(135deg,${ac},${ac2});padding:20px;position:relative;overflow:hidden;">
          <div style="position:absolute;top:-15px;right:-15px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,0.07);"></div>
          <div style="width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800;color:#fff;margin-bottom:8px;">${esc(initials)}</div>
          <div style="font-size:18px;font-weight:800;color:#fff;">${esc(fullName)}</div>
          <div style="font-size:9.5px;color:rgba(255,255,255,0.8);margin:3px 0;">${esc(p.title)}</div>
          <div style="font-size:8px;color:rgba(255,255,255,0.6);">${[p.email,p.phone,p.location].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ')}</div>
          ${[p.linkedin,p.github].filter(Boolean).map(v=>`<div style="font-size:7.5px;color:rgba(255,255,255,0.5);">${esc(v)}</div>`).join('')}
        </div>
        <div style="padding:16px 20px;">
          ${p.aboutMe?`<div style="margin-bottom:11px;padding:10px;background:#faf5ff;border-left:3px solid ${ac};border-radius:0 6px 6px 0;"><div style="font-size:8px;color:${ac};font-weight:700;margin-bottom:3px;">ABOUT ME</div><div style="font-size:9px;color:#4b5563;line-height:1.6;">${esc(p.aboutMe)}</div></div>`:''}
          ${p.careerObjective?`<div style="margin-bottom:11px;padding:10px;background:#eff6ff;border-left:3px solid ${ac2};border-radius:0 6px 6px 0;"><div style="font-size:8px;color:${ac2};font-weight:700;margin-bottom:3px;">CAREER OBJECTIVE</div><div style="font-size:9px;color:#4b5563;line-height:1.6;">${esc(p.careerObjective)}</div></div>`:''}
          ${exp.length?sec('EXPERIENCE',ac,expHtml(exp,ac)):''}
          ${edu.length?sec('EDUCATION',ac2,eduHtml(edu,ac2)):''}
          ${tech.length||soft.length||lang.length?sec('SKILLS',ac,tech.map(t=>pill(t,ac)).join('')+soft.map(t=>pill(t,ac2)).join('')+lang.map(t=>pill(t,'#0891b2')).join('')):''}
          ${cert.length?sec('CERTIFICATES',ac,cert.map(c=>`<div style="font-size:9px;color:#444;">• ${esc(c)}</div>`).join('')):''}
          ${proj.length?sec('PROJECTS',ac,projHtml(proj,ac)):''}
          ${achv.length?sec('ACHIEVEMENTS',ac2,achvHtml(achv)):''}
        </div></div>`;

    } else if (style === 'corporate') {
      const ac = '#1d4ed8';
      html = `<div style="font-family:Arial,Helvetica,sans-serif;background:#fff;min-height:100%;padding:18px 22px;">
        <div style="border-left:5px solid ${ac};padding-left:12px;margin-bottom:14px;">
          <div style="font-size:20px;font-weight:700;color:#1e293b;">${esc(fullName)}</div>
          <div style="font-size:10px;color:${ac};font-weight:600;margin:2px 0;">${esc(p.title)}</div>
          <div style="font-size:8px;color:#6b7280;">${[p.email,p.phone,p.location].filter(Boolean).map(esc).join(' &nbsp;|&nbsp; ')}</div>
          ${p.address?`<div style="font-size:7.5px;color:#9ca3af;">${esc(p.address)}</div>`:''}
          ${[p.linkedin,p.github].filter(Boolean).map(v=>`<div style="font-size:7.5px;color:#6b7280;">${esc(v)}</div>`).join('')}
        </div>
        ${p.aboutMe?`<div style="margin-bottom:11px;background:#f0f4ff;padding:9px 11px;border-radius:4px;"><div style="font-size:8px;font-weight:700;color:${ac};margin-bottom:4px;">ABOUT ME</div><div style="font-size:9px;color:#374151;line-height:1.6;">${esc(p.aboutMe)}</div></div>`:''}
        ${p.careerObjective?`<div style="margin-bottom:11px;background:#f8faff;padding:9px 11px;border-radius:4px;border:1px solid #dbeafe;"><div style="font-size:8px;font-weight:700;color:${ac};margin-bottom:4px;">CAREER OBJECTIVE</div><div style="font-size:9px;color:#374151;line-height:1.6;">${esc(p.careerObjective)}</div></div>`:''}
        ${exp.length?sec('PROFESSIONAL EXPERIENCE',ac,expHtml(exp,ac)):''}
        ${edu.length?sec('EDUCATION',ac,eduHtml(edu,ac)):''}
        ${tech.length||soft.length||lang.length?sec('CORE COMPETENCIES',ac,tech.map(t=>pill(t,ac)).join('')+soft.map(t=>pill(t,'#0369a1')).join('')+lang.map(t=>pill(t,'#0891b2')).join('')):''}
        ${cert.length?sec('CERTIFICATIONS',ac,cert.map(c=>`<div style="font-size:9px;color:#374151;">• ${esc(c)}</div>`).join('')):''}
        ${proj.length?sec('PROJECTS',ac,projHtml(proj,ac)):''}
        ${achv.length?sec('ACHIEVEMENTS',ac,achvHtml(achv)):''}
        ${decl?`<div style="margin-top:10px;font-size:8px;color:#9ca3af;border-top:1px solid #e2e8f0;padding-top:6px;">${esc(decl)}</div>`:''}
      </div>`;

    } else if (style === 'tech') {
      const ac = '#3fb950', ac2 = '#58a6ff';
      html = `<div style="font-family:'Courier New',monospace;background:#0d1117;color:#c9d1d9;min-height:100%;padding:18px 20px;">
        <div style="border-bottom:1px solid #30363d;padding-bottom:12px;margin-bottom:14px;">
          <div style="color:${ac2};font-size:8.5px;margin-bottom:3px;">// resume.json</div>
          <div style="font-size:18px;font-weight:700;color:#f0f6fc;">${esc(fullName)}</div>
          <div style="font-size:9.5px;color:${ac};margin:2px 0;">${esc(p.title)}</div>
          <div style="font-size:8px;color:#8b949e;">${[p.email,p.phone,p.location].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ')}</div>
          ${p.address?`<div style="font-size:7.5px;color:#6e7681;">${esc(p.address)}</div>`:''}
          ${[p.linkedin,p.github].filter(Boolean).map(v=>`<div style="font-size:7.5px;color:${ac2};">${esc(v)}</div>`).join('')}
        </div>
        ${p.aboutMe?`<div style="margin-bottom:12px;"><div style="font-size:8px;color:${ac};margin-bottom:4px;">/** about */</div><div style="font-size:9px;color:#8b949e;line-height:1.6;">${esc(p.aboutMe)}</div></div>`:''}
        ${p.careerObjective?`<div style="margin-bottom:12px;"><div style="font-size:8px;color:${ac};margin-bottom:4px;">/** objective */</div><div style="font-size:9px;color:#8b949e;line-height:1.6;">${esc(p.careerObjective)}</div></div>`:''}
        ${exp.length?`<div style="margin-bottom:12px;"><div style="font-size:8px;color:${ac2};margin-bottom:7px;">// experience</div>${exp.map(e=>`<div style="margin-bottom:9px;border-left:2px solid ${ac};padding-left:9px;"><div style="display:flex;justify-content:space-between;"><span style="font-size:9.5px;font-weight:700;color:#f0f6fc;">${esc(e.role)}</span><span style="font-size:8.5px;color:#8b949e;">${[e.startDate,e.endDate].filter(Boolean).join(' → ')}</span></div><div style="font-size:9px;color:${ac2};">${esc(e.company)}</div>${e.description?`<div style="font-size:8.5px;color:#8b949e;line-height:1.5;">${esc(e.description)}</div>`:''}</div>`).join('')}</div>`:''}
        ${edu.length?`<div style="margin-bottom:12px;"><div style="font-size:8px;color:${ac2};margin-bottom:7px;">// education</div>${edu.map(e=>`<div style="margin-bottom:7px;display:flex;justify-content:space-between;align-items:baseline;"><div><div style="font-size:9.5px;color:#f0f6fc;">${esc(e.degree)}</div><div style="font-size:9px;color:#8b949e;">${esc(e.institution)}</div>${e.info?`<div style="font-size:8px;color:#6e7681;">${esc(e.info)}</div>`:''}</div><span style="font-size:8.5px;color:#8b949e;white-space:nowrap;margin-left:6px;">${[e.startYear,e.endYear].filter(Boolean).join('-')}</span></div>`).join('')}</div>`:''}
        ${tech.length||soft.length?`<div style="margin-bottom:12px;"><div style="font-size:8px;color:${ac2};margin-bottom:7px;">// skills</div><div style="display:flex;flex-wrap:wrap;gap:4px;">${tech.map(t=>`<span style="background:#161b22;border:1px solid ${ac};color:${ac};border-radius:4px;padding:2px 6px;font-size:8px;">${esc(t)}</span>`).join('')}${soft.map(t=>`<span style="background:#161b22;border:1px solid ${ac2};color:${ac2};border-radius:4px;padding:2px 6px;font-size:8px;">${esc(t)}</span>`).join('')}${lang.map(t=>`<span style="background:#161b22;border:1px solid #e3b341;color:#e3b341;border-radius:4px;padding:2px 6px;font-size:8px;">${esc(t)}</span>`).join('')}</div></div>`:''}
        ${cert.length?`<div style="margin-bottom:12px;"><div style="font-size:8px;color:${ac2};margin-bottom:7px;">// certificates</div>${cert.map(c=>`<div style="font-size:9px;color:#8b949e;">• ${esc(c)}</div>`).join('')}</div>`:''}
        ${proj.length?`<div style="margin-bottom:12px;"><div style="font-size:8px;color:${ac2};margin-bottom:7px;">// projects</div>${proj.map(pr=>`<div style="margin-bottom:8px;border-left:2px solid ${ac2};padding-left:9px;"><div style="font-size:9.5px;color:#f0f6fc;">${esc(pr.name)}</div>${pr.url?`<div style="font-size:8.5px;color:${ac2};">${esc(pr.url)}</div>`:''}${pr.description?`<div style="font-size:8.5px;color:#8b949e;">${esc(pr.description)}</div>`:''}</div>`).join('')}</div>`:''}
        ${achv.length?`<div style="margin-bottom:12px;"><div style="font-size:8px;color:${ac2};margin-bottom:7px;">// achievements</div>${achv.map(a=>`<div style="font-size:9px;color:#8b949e;">• ${esc(a.text)}</div>`).join('')}</div>`:''}
      </div>`;
    }

    frame.innerHTML = html;
  }

  // ── PDF DOWNLOAD ──
  async function rbDownloadPDF() {
    const overlay    = document.getElementById('rb-pdf-overlay');
    const overlaySub = document.getElementById('rb-pdf-overlay-sub');
    const progFill   = document.getElementById('rb-pdf-progress-fill');
    const setOv = (msg, pct) => { if (overlaySub) overlaySub.textContent = msg; if (progFill) progFill.style.width = pct + '%'; };

    if (overlay) overlay.classList.add('visible');
    setOv('Building resume…', 20);

    try {
      await delay(80);
      if (!window.jspdf) throw new Error('jsPDF not loaded');
      const { jsPDF } = window.jspdf;

      const p    = rbState.prev.personal;
      const exp  = rbState.prev.exp.filter(e => e.role || e.company);
      const edu  = rbState.prev.edu.filter(e => e.degree || e.institution);
      const tech = rbState.prev.skills.tech         || [];
      const soft = rbState.prev.skills.soft         || [];
      const lang = rbState.prev.skills.languages    || [];
      const cert = rbState.prev.skills.certificates || [];
      const proj = rbState.prev.projects.filter(pr => pr.name);
      const achv = rbState.prev.achievements.filter(a => a.text);
      const decl = rbState.prev.declaration;
      const fullName = [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Your Name';

      const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
      const W = 210, H = 297;
      setOv('Laying out content…', 55);
      await delay(60);

      if      (rbActiveTemplate === 'modern')  rbPdfModern (pdf,W,H,p,fullName,exp,edu,tech,soft,lang,cert,proj,achv,decl);
      else if (rbActiveTemplate === 'minimal') rbPdfMinimal(pdf,W,H,p,fullName,exp,edu,tech,soft,lang,cert,proj,achv,decl);
      else                                     rbPdfClassic(pdf,W,H,p,fullName,exp,edu,tech,soft,lang,cert,proj,achv,decl);

      setOv('Saving…', 90); await delay(60);
      const slug  = [p.firstName, p.lastName].filter(Boolean).join('_') || 'Resume';
      const label = rbActiveTemplate.charAt(0).toUpperCase() + rbActiveTemplate.slice(1);
      pdf.save(`${slug}_Resume_${label}.pdf`);
      setOv('Done! ✓', 100);
      await delay(700);
    } catch (err) {
      console.error('PDF error:', err);
      setOv('Error: ' + err.message, 0);
      await delay(2000);
    } finally {
      if (overlay)   overlay.classList.remove('visible');
      if (progFill)  progFill.style.width = '0%';
    }
  }

  // ── PDF HELPERS ──
  function rbPdfRgb(pdf,hex)   { const [r,g,b]=hexRgb(hex); pdf.setTextColor(r,g,b); }
  function rbPdfFillRgb(pdf,hex){ const [r,g,b]=hexRgb(hex); pdf.setFillColor(r,g,b); }
  function rbPdfDrawRgb(pdf,hex){ const [r,g,b]=hexRgb(hex); pdf.setDrawColor(r,g,b); }
  function hexRgb(hex){ return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)]; }
  function rbPdfText(pdf,text,x,y,maxW,lh,newPageY){ if(!text)return y; pdf.splitTextToSize(String(text),maxW).forEach(l=>{ if(y>285){pdf.addPage();y=newPageY||15;} pdf.text(l,x,y); y+=lh; }); return y; }
  function rbPdfHLine(pdf,x1,y,x2,hex){ rbPdfDrawRgb(pdf,hex||'#cccccc'); pdf.setLineWidth(0.3); pdf.line(x1,y,x2,y); }

  // ── CLASSIC PDF ──
  function rbPdfClassic(pdf,W,H,p,fullName,exp,edu,tech,soft,lang,cert,proj,achv,decl) {
    const ml=16,mr=16,cW=W-ml-mr;
    let y=0;
    rbPdfFillRgb(pdf,'#1e293b'); pdf.rect(0,0,W,42,'F');
    rbPdfRgb(pdf,'#ffffff'); pdf.setFont('helvetica','bold'); pdf.setFontSize(22); pdf.text(fullName,ml,16);
    pdf.setFont('helvetica','normal'); pdf.setFontSize(11); rbPdfRgb(pdf,'#94a3b8'); pdf.text(p.title||'',ml,24);
    const contacts=[p.email,p.phone,p.location,p.address].filter(Boolean);
    pdf.setFontSize(8); rbPdfRgb(pdf,'#cbd5e1'); pdf.text(contacts.join('  |  '),ml,30);
    const links=[p.linkedin,p.github].filter(Boolean);
    if(links.length){ pdf.setFontSize(7.5); rbPdfRgb(pdf,'#94a3b8'); pdf.text(links.join('   '),ml,36); }
    y=52;

    const pdfSec=(label)=>{ if(y>265){pdf.addPage();y=15;} rbPdfRgb(pdf,'#1e293b'); pdf.setFont('helvetica','bold'); pdf.setFontSize(10); pdf.text(label,ml,y); y+=1.5; rbPdfHLine(pdf,ml,y,W-mr,'#6366f1'); y+=5; };

    if(p.aboutMe){
      pdfSec('ABOUT ME');
      pdf.setFont('helvetica','normal'); pdf.setFontSize(9.5); rbPdfRgb(pdf,'#374151');
      y=rbPdfText(pdf,p.aboutMe,ml,y,cW,5.2,20); y+=5;
    }
    if(p.careerObjective){
      pdfSec('CAREER OBJECTIVE');
      pdf.setFont('helvetica','normal'); pdf.setFontSize(9.5); rbPdfRgb(pdf,'#374151');
      y=rbPdfText(pdf,p.careerObjective,ml,y,cW,5.2,20); y+=5;
    }
    if(exp.length){
      pdfSec('EXPERIENCE');
      exp.forEach(e=>{ if(y>275){pdf.addPage();y=15;}
        pdf.setFont('helvetica','bold'); pdf.setFontSize(10); rbPdfRgb(pdf,'#111827'); pdf.text(e.role||'',ml,y);
        const d=[e.startDate,e.endDate].filter(Boolean).join(' – '); pdf.setFont('helvetica','normal'); pdf.setFontSize(9); rbPdfRgb(pdf,'#6b7280'); if(d) pdf.text(d,W-mr,y,{align:'right'}); y+=5;
        pdf.setFont('helvetica','italic'); pdf.setFontSize(9.5); rbPdfRgb(pdf,'#4b5563'); pdf.text(e.company||'',ml,y); y+=5;
        if(e.description){ pdf.setFont('helvetica','normal'); pdf.setFontSize(9); rbPdfRgb(pdf,'#374151'); y=rbPdfText(pdf,e.description,ml+2,y,cW-2,5,15); }
        y+=4;
      }); y+=2;
    }
    if(edu.length){
      pdfSec('EDUCATION');
      edu.forEach(e=>{ if(y>275){pdf.addPage();y=15;}
        pdf.setFont('helvetica','bold'); pdf.setFontSize(10); rbPdfRgb(pdf,'#111827'); pdf.text(e.degree||'',ml,y);
        const yr=[e.startYear,e.endYear].filter(Boolean).join(' – '); pdf.setFont('helvetica','normal'); pdf.setFontSize(9); rbPdfRgb(pdf,'#6b7280'); if(yr) pdf.text(yr,W-mr,y,{align:'right'}); y+=5;
        pdf.setFont('helvetica','italic'); pdf.setFontSize(9.5); rbPdfRgb(pdf,'#4b5563'); pdf.text(e.institution||'',ml,y); y+=5;
        if(e.info){ pdf.setFont('helvetica','normal'); pdf.setFontSize(9); rbPdfRgb(pdf,'#6b7280'); pdf.text(e.info,ml,y); y+=5; }
        y+=2;
      }); y+=2;
    }
    if(tech.length||soft.length||lang.length){
      pdfSec('SKILLS');
      [['Technical',tech],['Soft Skills',soft],['Languages',lang]].filter(r=>r[1].length).forEach(([lbl,arr])=>{
        if(y>280){pdf.addPage();y=15;}
        pdf.setFont('helvetica','bold'); pdf.setFontSize(9.5); rbPdfRgb(pdf,'#374151'); pdf.text(lbl+': ',ml,y);
        const lw=pdf.getTextWidth(lbl+': '); pdf.setFont('helvetica','normal'); rbPdfRgb(pdf,'#4b5563');
        y=rbPdfText(pdf,arr.join(', '),ml+lw,y,cW-lw,5,15); y+=2;
      });
    }
    if(cert.length){
      pdfSec('CERTIFICATES & COURSES');
      cert.forEach(c=>{ if(y>280){pdf.addPage();y=15;} pdf.setFont('helvetica','normal'); pdf.setFontSize(9.5); rbPdfRgb(pdf,'#374151'); pdf.text('• '+c,ml,y); y+=5; });
      y+=2;
    }
    if(proj.length){
      pdfSec('PROJECTS');
      proj.forEach(pr=>{ if(y>270){pdf.addPage();y=15;}
        pdf.setFont('helvetica','bold'); pdf.setFontSize(10); rbPdfRgb(pdf,'#111827'); pdf.text(pr.name||'',ml,y); y+=5;
        if(pr.url){ pdf.setFont('helvetica','normal'); pdf.setFontSize(9); rbPdfRgb(pdf,'#6366f1'); y=rbPdfText(pdf,pr.url,ml+2,y,cW-2,4.5,15); }
        if(pr.description){ pdf.setFont('helvetica','normal'); pdf.setFontSize(9); rbPdfRgb(pdf,'#374151'); y=rbPdfText(pdf,pr.description,ml+2,y,cW-2,5,15); }
        y+=4;
      }); y+=2;
    }
    if(achv.length){
      pdfSec('ACHIEVEMENTS');
      achv.forEach(a=>{ if(y>280){pdf.addPage();y=15;} pdf.setFont('helvetica','normal'); pdf.setFontSize(9.5); rbPdfRgb(pdf,'#374151'); y=rbPdfText(pdf,'• '+a.text,ml,y,cW,5,15); y+=2; });
      y+=2;
    }
    if(decl){
      if(y>270){pdf.addPage();y=15;}
      rbPdfHLine(pdf,ml,y,W-mr,'#e5e7eb'); y+=5;
      pdf.setFont('helvetica','italic'); pdf.setFontSize(8.5); rbPdfRgb(pdf,'#9ca3af');
      y=rbPdfText(pdf,decl,ml,y,cW,4.5,15);
    }
  }

  // ── MODERN PDF (two-column) ──
  function rbPdfModern(pdf,W,H,p,fullName,exp,edu,tech,soft,lang,cert,proj,achv,decl) {
    const sideW=68,mainX=sideW+1,mainW=W-mainX-12;
    let sY=0,mY=0;
    rbPdfFillRgb(pdf,'#0f172a'); pdf.rect(0,0,sideW,H,'F');
    rbPdfFillRgb(pdf,'#6366f1'); pdf.rect(0,0,3,H,'F');
    rbPdfFillRgb(pdf,'#6366f1'); pdf.circle(sideW/2,22,12,'F');
    const ini=[p.firstName,p.lastName].filter(Boolean).map(n=>n[0]?.toUpperCase()).join('')||'?';
    rbPdfRgb(pdf,'#ffffff'); pdf.setFont('helvetica','bold'); pdf.setFontSize(13); pdf.text(ini,sideW/2,25.5,{align:'center'});
    sY=40;
    pdf.setFontSize(11); rbPdfRgb(pdf,'#f1f5f9');
    pdf.splitTextToSize(fullName,sideW-10).forEach(l=>{pdf.text(l,sideW/2,sY,{align:'center'});sY+=6;});
    pdf.setFont('helvetica','normal'); pdf.setFontSize(8); rbPdfRgb(pdf,'#94a3b8');
    if(p.title) pdf.splitTextToSize(p.title,sideW-10).forEach(l=>{pdf.text(l,sideW/2,sY,{align:'center'});sY+=5;});
    sY+=5;
    const sideSection=lbl=>{ sY+=2; rbPdfRgb(pdf,'#6366f1'); pdf.setFont('helvetica','bold'); pdf.setFontSize(8); pdf.text(lbl,7,sY); sY+=1.5; rbPdfDrawRgb(pdf,'#334155'); pdf.setLineWidth(0.3); pdf.line(5,sY,sideW-5,sY); sY+=4; };
    sideSection('CONTACT');
    [p.email,p.phone,p.location,p.address,p.linkedin,p.github].filter(Boolean).forEach(v=>{
      if(sY>285)return; pdf.setFont('helvetica','normal'); pdf.setFontSize(7); rbPdfRgb(pdf,'#cbd5e1');
      pdf.splitTextToSize(v,sideW-14).forEach(l=>{pdf.text(l,7,sY);sY+=4;});
    });
    if(tech.length){ sideSection('TECHNICAL SKILLS'); tech.forEach(sk=>{if(sY>285)return;pdf.setFont('helvetica','normal');pdf.setFontSize(7.5);rbPdfRgb(pdf,'#e2e8f0');pdf.text('• '+sk,7,sY);sY+=4.5;}); }
    if(soft.length){ sideSection('SOFT SKILLS');     soft.forEach(sk=>{if(sY>285)return;pdf.setFont('helvetica','normal');pdf.setFontSize(7.5);rbPdfRgb(pdf,'#e2e8f0');pdf.text('• '+sk,7,sY);sY+=4.5;}); }
    if(lang.length){ sideSection('LANGUAGES');       lang.forEach(l =>{if(sY>285)return;pdf.setFont('helvetica','normal');pdf.setFontSize(7.5);rbPdfRgb(pdf,'#e2e8f0');pdf.text('• '+l, 7,sY);sY+=4.5;}); }
    if(cert.length){ sideSection('CERTIFICATES');    cert.forEach(c =>{if(sY>285)return;pdf.setFont('helvetica','normal');pdf.setFontSize(7.5);rbPdfRgb(pdf,'#cbd5e1');pdf.splitTextToSize(c,sideW-12).forEach(l=>{pdf.text('• '+l,7,sY);sY+=4;});}); }

    mY=18;
    const mainSection=lbl=>{ mY+=3; rbPdfRgb(pdf,'#1e293b'); pdf.setFont('helvetica','bold'); pdf.setFontSize(10.5); pdf.text(lbl,mainX,mY); mY+=2; rbPdfDrawRgb(pdf,'#6366f1'); pdf.setLineWidth(0.5); pdf.line(mainX,mY,mainX+mainW,mY); mY+=5; };
    const addPage=()=>{ pdf.addPage(); mY=15; rbPdfFillRgb(pdf,'#0f172a'); pdf.rect(0,0,sideW,H,'F'); rbPdfFillRgb(pdf,'#6366f1'); pdf.rect(0,0,3,H,'F'); };
    if(p.aboutMe){ mainSection('ABOUT ME'); pdf.setFont('helvetica','normal'); pdf.setFontSize(9); rbPdfRgb(pdf,'#374151'); mY=rbPdfText(pdf,p.aboutMe,mainX,mY,mainW,5,18); mY+=4; }
    if(p.careerObjective){ mainSection('CAREER OBJECTIVE'); pdf.setFont('helvetica','normal'); pdf.setFontSize(9); rbPdfRgb(pdf,'#374151'); mY=rbPdfText(pdf,p.careerObjective,mainX,mY,mainW,5,18); mY+=4; }
    if(exp.length){
      mainSection('EXPERIENCE');
      exp.forEach(e=>{ if(mY>275)addPage();
        pdf.setFont('helvetica','bold'); pdf.setFontSize(10); rbPdfRgb(pdf,'#111827'); pdf.text(e.role||'',mainX,mY);
        const d=[e.startDate,e.endDate].filter(Boolean).join(' – '); pdf.setFont('helvetica','normal'); pdf.setFontSize(8.5); rbPdfRgb(pdf,'#6b7280'); if(d) pdf.text(d,W-12,mY,{align:'right'}); mY+=5;
        pdf.setFont('helvetica','italic'); pdf.setFontSize(9); rbPdfRgb(pdf,'#4f46e5'); pdf.text(e.company||'',mainX,mY); mY+=5;
        if(e.description){ pdf.setFont('helvetica','normal'); pdf.setFontSize(8.5); rbPdfRgb(pdf,'#374151'); mY=rbPdfText(pdf,e.description,mainX+2,mY,mainW-2,4.8,18); }
        mY+=4;
      });
    }
    if(edu.length){
      if(mY>260)addPage(); mainSection('EDUCATION');
      edu.forEach(e=>{ if(mY>275)addPage();
        pdf.setFont('helvetica','bold'); pdf.setFontSize(10); rbPdfRgb(pdf,'#111827'); pdf.text(e.degree||'',mainX,mY);
        const yr=[e.startYear,e.endYear].filter(Boolean).join(' – '); pdf.setFont('helvetica','normal'); pdf.setFontSize(8.5); rbPdfRgb(pdf,'#6b7280'); if(yr) pdf.text(yr,W-12,mY,{align:'right'}); mY+=5;
        pdf.setFont('helvetica','italic'); pdf.setFontSize(9); rbPdfRgb(pdf,'#4f46e5'); pdf.text(e.institution||'',mainX,mY); mY+=5;
        if(e.info){ pdf.setFont('helvetica','normal'); pdf.setFontSize(8.5); rbPdfRgb(pdf,'#6b7280'); pdf.text(e.info,mainX,mY); mY+=5; }
      });
    }
    if(proj.length){
      if(mY>260)addPage(); mainSection('PROJECTS');
      proj.forEach(pr=>{ if(mY>275)addPage();
        pdf.setFont('helvetica','bold'); pdf.setFontSize(10); rbPdfRgb(pdf,'#111827'); pdf.text(pr.name||'',mainX,mY); mY+=5;
        if(pr.url){ pdf.setFont('helvetica','normal'); pdf.setFontSize(8.5); rbPdfRgb(pdf,'#6366f1'); mY=rbPdfText(pdf,pr.url,mainX+2,mY,mainW-2,4.5,18); }
        if(pr.description){ pdf.setFont('helvetica','normal'); pdf.setFontSize(8.5); rbPdfRgb(pdf,'#374151'); mY=rbPdfText(pdf,pr.description,mainX+2,mY,mainW-2,4.8,18); }
        mY+=4;
      });
    }
    if(achv.length){
      if(mY>260)addPage(); mainSection('ACHIEVEMENTS');
      achv.forEach(a=>{ if(mY>280)addPage(); pdf.setFont('helvetica','normal'); pdf.setFontSize(9); rbPdfRgb(pdf,'#374151'); mY=rbPdfText(pdf,'• '+a.text,mainX,mY,mainW,4.8,18); mY+=2; });
    }
    if(decl){ if(mY>270)addPage(); pdf.setFont('helvetica','italic'); pdf.setFontSize(8); rbPdfRgb(pdf,'#9ca3af'); mY=rbPdfText(pdf,decl,mainX,mY+4,mainW,4.5,18); }
  }

  // ── MINIMAL PDF ──
  function rbPdfMinimal(pdf,W,H,p,fullName,exp,edu,tech,soft,lang,cert,proj,achv,decl) {
    const ml=18,mr=18,cW=W-ml-mr;
    let y=20;
    rbPdfRgb(pdf,'#111827'); pdf.setFont('helvetica','bold'); pdf.setFontSize(24); pdf.text(fullName,ml,y); y+=8;
    if(p.title){ pdf.setFont('helvetica','normal'); pdf.setFontSize(12); rbPdfRgb(pdf,'#6b7280'); pdf.text(p.title,ml,y); y+=6; }
    const contacts=[p.email,p.phone,p.location].filter(Boolean);
    if(contacts.length){ pdf.setFont('helvetica','normal'); pdf.setFontSize(8.5); rbPdfRgb(pdf,'#9ca3af'); pdf.text(contacts.join('   ·   '),ml,y); y+=4; }
    if(p.address){ pdf.setFontSize(8); rbPdfRgb(pdf,'#b0b8c4'); pdf.text(p.address,ml,y); y+=4; }
    const links=[p.linkedin,p.github].filter(Boolean);
    if(links.length){ pdf.setFontSize(8); rbPdfRgb(pdf,'#9ca3af'); pdf.text(links.join('   '),ml,y); y+=4; }
    rbPdfDrawRgb(pdf,'#111827'); pdf.setLineWidth(0.8); pdf.line(ml,y,W-mr,y); y+=8;

    const minSec=lbl=>{ if(y>265){pdf.addPage();y=20;} rbPdfRgb(pdf,'#111827'); pdf.setFont('helvetica','bold'); pdf.setFontSize(9); pdf.text(lbl,ml,y); y+=1.5; rbPdfDrawRgb(pdf,'#d1d5db'); pdf.setLineWidth(0.25); pdf.line(ml,y,W-mr,y); y+=5; };

    if(p.aboutMe){ minSec('ABOUT ME'); pdf.setFont('helvetica','normal'); pdf.setFontSize(9.5); rbPdfRgb(pdf,'#374151'); y=rbPdfText(pdf,p.aboutMe,ml,y,cW,5.2,20); y+=6; }
    if(p.careerObjective){ minSec('CAREER OBJECTIVE'); pdf.setFont('helvetica','normal'); pdf.setFontSize(9.5); rbPdfRgb(pdf,'#374151'); y=rbPdfText(pdf,p.careerObjective,ml,y,cW,5.2,20); y+=6; }
    if(exp.length){
      minSec('EXPERIENCE');
      exp.forEach(e=>{ if(y>275){pdf.addPage();y=20;}
        const d=[e.startDate,e.endDate].filter(Boolean).join(' – ');
        pdf.setFont('helvetica','bold'); pdf.setFontSize(10); rbPdfRgb(pdf,'#111827');
        pdf.text((e.role||'')+(e.company?' · '+e.company:''),ml,y); if(d){ pdf.setFont('helvetica','normal'); pdf.setFontSize(8.5); rbPdfRgb(pdf,'#9ca3af'); pdf.text(d,W-mr,y,{align:'right'}); } y+=5;
        if(e.description){ pdf.setFont('helvetica','normal'); pdf.setFontSize(9); rbPdfRgb(pdf,'#4b5563'); y=rbPdfText(pdf,e.description,ml+2,y,cW-2,5,20); }
        y+=5;
      });
    }
    if(edu.length){
      minSec('EDUCATION');
      edu.forEach(e=>{ if(y>275){pdf.addPage();y=20;}
        const yr=[e.startYear,e.endYear].filter(Boolean).join(' – ');
        pdf.setFont('helvetica','bold'); pdf.setFontSize(10); rbPdfRgb(pdf,'#111827');
        pdf.text((e.degree||'')+(e.institution?' · '+e.institution:''),ml,y); if(yr){ pdf.setFont('helvetica','normal'); pdf.setFontSize(8.5); rbPdfRgb(pdf,'#9ca3af'); pdf.text(yr,W-mr,y,{align:'right'}); } y+=5;
        if(e.info){ pdf.setFont('helvetica','normal'); pdf.setFontSize(8.5); rbPdfRgb(pdf,'#6b7280'); pdf.text(e.info,ml,y); y+=5; }
        y+=2;
      });
    }
    if(tech.length||soft.length||lang.length){
      minSec('SKILLS');
      [['Technical',tech],['Soft',soft],['Languages',lang]].filter(r=>r[1].length).forEach(([lbl,arr])=>{ if(y>280){pdf.addPage();y=20;} pdf.setFont('helvetica','bold'); pdf.setFontSize(9.5); rbPdfRgb(pdf,'#374151'); pdf.text(lbl+': ',ml,y); const lw=pdf.getTextWidth(lbl+': '); pdf.setFont('helvetica','normal'); rbPdfRgb(pdf,'#6b7280'); y=rbPdfText(pdf,arr.join(', '),ml+lw,y,cW-lw,5,20); y+=2; });
    }
    if(cert.length){ minSec('CERTIFICATES'); cert.forEach(c=>{if(y>280){pdf.addPage();y=20;}pdf.setFont('helvetica','normal');pdf.setFontSize(9.5);rbPdfRgb(pdf,'#374151');pdf.text('• '+c,ml,y);y+=5;}); y+=2; }
    if(proj.length){
      minSec('PROJECTS');
      proj.forEach(pr=>{ if(y>270){pdf.addPage();y=20;} pdf.setFont('helvetica','bold'); pdf.setFontSize(10); rbPdfRgb(pdf,'#111827'); pdf.text(pr.name||'',ml,y); y+=5; if(pr.url){pdf.setFont('helvetica','normal');pdf.setFontSize(8.5);rbPdfRgb(pdf,'#6b7280');y=rbPdfText(pdf,pr.url,ml+2,y,cW-2,4.5,20);} if(pr.description){pdf.setFont('helvetica','normal');pdf.setFontSize(9);rbPdfRgb(pdf,'#4b5563');y=rbPdfText(pdf,pr.description,ml+2,y,cW-2,5,20);} y+=4; });
    }
    if(achv.length){ minSec('ACHIEVEMENTS'); achv.forEach(a=>{if(y>280){pdf.addPage();y=20;}pdf.setFont('helvetica','normal');pdf.setFontSize(9.5);rbPdfRgb(pdf,'#374151');y=rbPdfText(pdf,'• '+a.text,ml,y,cW,5,20);y+=2;}); }
    if(decl){ if(y>270){pdf.addPage();y=20;} rbPdfDrawRgb(pdf,'#d1d5db'); pdf.setLineWidth(0.25); pdf.line(ml,y,W-mr,y); y+=5; pdf.setFont('helvetica','italic'); pdf.setFontSize(8.5); rbPdfRgb(pdf,'#9ca3af'); y=rbPdfText(pdf,decl,ml,y,cW,5,20); }
  }

  // ── CSS: rb-btn-add-sm ──
  (function injectStyles(){
    const st = document.createElement('style');
    st.textContent = `.rb-btn-add-sm{background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);color:#818cf8;padding:5px 12px;border-radius:6px;font-size:0.78rem;font-weight:600;cursor:pointer;transition:all .2s;font-family:inherit}.rb-btn-add-sm:hover{background:rgba(99,102,241,0.25);border-color:#6366f1;color:#a5b4fc}`;
    document.head.appendChild(st);
  })();

  // ── INIT ──
  try {
    rbSetupTagInput('rb-techSkillInput','rb-techTagsDisplay','tech');
    rbSetupTagInput('rb-softSkillInput','rb-softTagsDisplay','soft');
    rbSetupTagInput('rb-langInput',     'rb-langTagsDisplay','languages');
    rbSetupTagInput('rb-certInput',     'rb-certTagsDisplay','certificates');
    rbUpdateProgress();
    rbAddExperience();
    rbAddEducation();
    rbAddProject();
    rbAddAchievement();
  } catch(e) {
    console.warn('[Resume Builder] Init error (non-fatal):', e);
  }

})();

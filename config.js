/* ══════════════════════════════════════════════
   CareerForge AI — Configuration
   ══════════════════════════════════════════════ */

const CONFIG = {
  API_BASE_URL: 'http://localhost:3000/api',
  // API key is stored server-side only in .env — never put it here

  ROLES: [
    'Frontend Developer',
    'Backend Developer',
    'Full Stack Developer',
    'AI / ML Engineer',
    'Data Analyst',
    'Cyber Security Analyst',
    'Software Engineer',
    'DevOps / Cloud Engineer',
    'Mobile Developer',
    'UI/UX Designer',
    'Blockchain Developer',
    'QA / Test Engineer'
  ],

  LOADING_MESSAGES: [
    'Analyzing role requirements',
    'Building your learning roadmap',
    'Curating project ideas',
    'Generating interview questions',
    'Crafting resume tips',
    'Running skill gap analysis',
    'Finalizing your career plan'
  ],

  STORAGE_KEYS: {
    HISTORY: 'careerforge_history',
    LAST_RESULT: 'careerforge_last_result'
  },

  MAX_HISTORY: 20
};

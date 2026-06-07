/* CareerForge AI — Main interaction logic */
(function () {
    const DOM = {
        roleForm: document.getElementById('roleForm'),
        roleInput: document.getElementById('roleInput'),
        suggestionsDropdown: document.getElementById('suggestionsDropdown'),
        skillsInput: document.getElementById('skillsInput'),
        skillsTags: document.getElementById('skillsTags'),
        generateBtn: document.getElementById('generateBtn'),
        btnLoader: document.getElementById('btnLoader'),
        loadingSection: document.getElementById('loadingSection'),
        dashboardSection: document.getElementById('dashboard'),
        dashboardRole: document.getElementById('dashboardRole'),
        roadmapCount: document.getElementById('roadmapCount'),
        projectsCount: document.getElementById('projectsCount'),
        questionsCount: document.getElementById('questionsCount'),
        resumeCount: document.getElementById('resumeCount'),
        skillGapCount: document.getElementById('skillGapCount'),
        roadmapTimeline: document.getElementById('roadmapTimeline'),
        projectsGrid: document.getElementById('projectsGrid'),
        questionsList: document.getElementById('questionsList'),
        viewMoreBtn: document.getElementById('viewMoreQuestionsBtn'),
        regenerateQuestionsBtn: document.getElementById('regenerateQuestionsBtn'),
        resumeTipsList: document.getElementById('resumeTipsList'),
        skillGapGrid: document.getElementById('skillGapGrid'),
        historyGrid: document.getElementById('historyGrid'),
        historyEmpty: document.getElementById('historyEmpty'),
        clearHistoryBtn: document.getElementById('clearHistoryBtn'),
        toastContainer: document.getElementById('toastContainer'),
        errorModal: document.getElementById('errorModal'),
        errorTitle: document.getElementById('errorTitle'),
        errorDesc: document.getElementById('errorDesc'),
        navToggle: document.getElementById('navToggle'),
        navLinks: document.getElementById('navLinks'),
        quickRoleButtons: document.querySelectorAll('.quick-role-chips .chip'),
        overviewCards: document.querySelectorAll('.overview-card'),
        copyButtons: document.querySelectorAll('[onclick^="copySection"]'),
        downloadPlanBtn: document.getElementById('downloadPlanBtn')
    };

    let skills = [];
    let history = [];
    let lastResult = null;
    let suggestionIndex = -1;
    let activeSuggestions = [];
    let showAllQuestions = false;
    const QUESTIONS_PREVIEW_COUNT = 3;

    function init() {
        bindEvents();
        loadHistory();
        loadLastResult();
        renderHistory();
        updateHeroStats();
        if (window.location.hash === '#dashboard' && lastResult) {
            renderDashboard(lastResult);
        }
    }

    function bindEvents() {
        DOM.roleForm.addEventListener('submit', handleSubmit);
        DOM.roleInput.addEventListener('input', handleRoleInput);
        DOM.roleInput.addEventListener('focus', handleRoleInput);
        DOM.roleInput.addEventListener('keydown', handleRoleKeyDown);
        DOM.suggestionsDropdown.addEventListener('click', handleSuggestionClick);
        DOM.skillsInput.addEventListener('keydown', handleSkillsKeydown);
        DOM.clearHistoryBtn.addEventListener('click', clearHistory);
        DOM.navToggle.addEventListener('click', toggleMobileNav);
        DOM.viewMoreBtn?.addEventListener('click', toggleViewMoreQuestions);
        DOM.regenerateQuestionsBtn?.addEventListener('click', regenerateQuestions);
        document.addEventListener('click', handleDocumentClick);
        DOM.quickRoleButtons.forEach((button) => {
            button.addEventListener('click', () => {
                DOM.roleInput.value = button.dataset.role;
                updateSuggestions();
                DOM.roleInput.focus();
            });
        });
        DOM.overviewCards.forEach((card) => {
            card.addEventListener('click', () => {
                const targetId = card.dataset.target;
                if (!targetId) return;
                showSectionAndScroll(targetId);
            });
        });
        // Intercept Resume Builder nav link — element lives inside hidden #dashboard
        const resumeBuilderNavLink = document.querySelector('a[href="#resumeBuilderSection"]');
        if (resumeBuilderNavLink) {
            resumeBuilderNavLink.addEventListener('click', (e) => {
                e.preventDefault();
                showSectionAndScroll('resumeBuilderSection');
            });
        }
        DOM.historyGrid.addEventListener('click', handleHistoryClick);
        window.addEventListener('hashchange', handleHashChange);
    }

    function showSectionAndScroll(targetId) {
        if (!lastResult) {
            const sampleRole = CONFIG.ROLES[0];
            lastResult = buildCareerPlan(sampleRole, []);
            saveLastResult();
            saveHistoryItem(lastResult);
        }
        if (DOM.dashboardSection.style.display !== 'block') {
            renderDashboard(lastResult);
        }
        setTimeout(() => {
            const target = document.getElementById(targetId);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
    }

    function handleSubmit(event) {
        event.preventDefault();
        const role = DOM.roleInput.value.trim();

        if (!role) {
            showError('Role Required', 'Please enter a target role before generating a career plan.');
            return;
        }

        startLoading();
        simulateLoading().then(() => {
            lastResult = buildCareerPlan(role, skills);
            saveLastResult();
            saveHistoryItem(lastResult);
            renderDashboard(lastResult);
            showToast('Career plan generated successfully!', 'success');
        }).catch(() => {
            stopLoading();
            showError('Generation Failed', 'Unable to create your career plan. Please try again.');
        });
    }

    function handleRoleInput() {
        suggestionIndex = -1;
        updateSuggestions();
    }

    function handleRoleKeyDown(event) {
        const items = Array.from(DOM.suggestionsDropdown.querySelectorAll('.suggestion-item'));
        if (!items.length) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            suggestionIndex = Math.min(suggestionIndex + 1, items.length - 1);
            updateSuggestionHighlight(items);
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            suggestionIndex = Math.max(suggestionIndex - 1, 0);
            updateSuggestionHighlight(items);
        }
        if (event.key === 'Enter' && suggestionIndex >= 0) {
            event.preventDefault();
            selectSuggestionItem(items[suggestionIndex]);
        }
        if (event.key === 'Escape') {
            hideSuggestions();
        }
    }

    function handleSuggestionClick(event) {
        const item = event.target.closest('.suggestion-item');
        if (!item) return;
        selectSuggestionItem(item);
    }

    function handleSkillsKeydown(event) {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        const skill = DOM.skillsInput.value.trim();
        addSkill(skill);
    }

    function handleDocumentClick(event) {
        if (!event.target.closest('.input-wrapper')) {
            hideSuggestions();
        }
        if (!event.target.closest('.nav-container') && DOM.navLinks.classList.contains('open')) {
            DOM.navLinks.classList.remove('open');
            DOM.navToggle.classList.remove('active');
        }
    }

    function toggleMobileNav() {
        const isOpen = DOM.navLinks.classList.toggle('open');
        DOM.navToggle.classList.toggle('active', isOpen);
    }

    function handleHistoryClick(event) {
        const card = event.target.closest('.history-card');
        if (!card) return;
        const index = Number(card.dataset.index);
        if (!Number.isFinite(index) || !history[index]) return;
        lastResult = history[index].result;
        saveLastResult();
        renderDashboard(lastResult);
        showToast(`Loaded plan for ${history[index].role}.`, 'success');
    }

    function handleHashChange() {
        if (window.location.hash === '#dashboard') {
            if (lastResult) {
                renderDashboard(lastResult);
            } else {
                const sampleRole = CONFIG.ROLES[0];
                lastResult = buildCareerPlan(sampleRole, []);
                saveLastResult();
                saveHistoryItem(lastResult);
                renderDashboard(lastResult);
            }
        } else if (window.location.hash === '#resumeBuilderSection') {
            if (!lastResult) {
                const sampleRole = CONFIG.ROLES[0];
                lastResult = buildCareerPlan(sampleRole, []);
                saveLastResult();
                saveHistoryItem(lastResult);
            }
            if (DOM.dashboardSection.style.display === 'none' || !DOM.dashboardSection.style.display) {
                renderDashboard(lastResult);
            }
            setTimeout(() => {
                const target = document.getElementById('resumeBuilderSection');
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    }

    function updateSuggestions() {
        const query = DOM.roleInput.value.trim().toLowerCase();
        const matches = query
            ? CONFIG.ROLES.filter((role) => role.toLowerCase().includes(query))
            : CONFIG.ROLES.slice(0, 6);

        activeSuggestions = matches;
        DOM.suggestionsDropdown.innerHTML = '';

        if (!matches.length) {
            hideSuggestions();
            return;
        }

        matches.forEach((role) => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.textContent = role;
            DOM.suggestionsDropdown.appendChild(item);
        });

        DOM.suggestionsDropdown.classList.add('show');
    }

    function updateSuggestionHighlight(items) {
        items.forEach((item, index) => item.classList.toggle('active', index === suggestionIndex));
        if (suggestionIndex >= 0 && items[suggestionIndex]) {
            items[suggestionIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    function selectSuggestionItem(item) {
        DOM.roleInput.value = item.textContent;
        hideSuggestions();
        DOM.roleInput.focus();
    }

    function hideSuggestions() {
        DOM.suggestionsDropdown.classList.remove('show');
        suggestionIndex = -1;
    }

    function addSkill(skill) {
        if (!skill) return;
        const normalized = skill.trim();
        if (!normalized) return;
        if (skills.includes(normalized.toLowerCase())) {
            showToast('That skill is already added.', 'error');
            DOM.skillsInput.value = '';
            return;
        }
        skills.push(normalized.toLowerCase());
        renderSkills();
        DOM.skillsInput.value = '';
    }

    function removeSkill(skill) {
        skills = skills.filter((item) => item !== skill.toLowerCase());
        renderSkills();
    }

    function renderSkills() {
        DOM.skillsTags.innerHTML = '';
        if (!skills.length) return;

        skills.forEach((skill) => {
            const tag = document.createElement('div');
            tag.className = 'skill-tag';
            tag.innerHTML = `${skill}<button type="button" aria-label="Remove ${skill}">&times;</button>`;
            tag.querySelector('button').addEventListener('click', () => removeSkill(skill));
            DOM.skillsTags.appendChild(tag);
        });
    }

    function startLoading() {
        DOM.generateBtn.disabled = true;
        DOM.generateBtn.classList.add('loading');
        DOM.loadingSection.style.display = 'block';
        DOM.dashboardSection.style.display = 'none';
        document.body.scrollTop = document.documentElement.scrollTop = 0;
    }

    function stopLoading() {
        DOM.generateBtn.disabled = false;
        DOM.generateBtn.classList.remove('loading');
        DOM.loadingSection.style.display = 'none';
    }

    function simulateLoading() {
        return new Promise((resolve) => {
            const steps = Array.from(document.querySelectorAll('.load-step'));
            const statusText = document.getElementById('loadingStatus');
            const progressBar = document.getElementById('progressBar');
            let stepIndex = 0;
            const totalSteps = steps.length;

            steps.forEach((step) => step.classList.remove('active', 'done'));
            progressBar.style.width = '0%';

            function nextStep() {
                if (stepIndex > 0) {
                    steps[stepIndex - 1].classList.remove('active');
                    steps[stepIndex - 1].classList.add('done');
                }

                if (stepIndex >= totalSteps) {
                    progressBar.style.width = '100%';
                    setTimeout(() => {
                        stopLoading();
                        resolve();
                    }, 300);
                    return;
                }

                steps[stepIndex].classList.add('active');
                statusText.textContent = CONFIG.LOADING_MESSAGES[stepIndex] || 'Preparing your plan';
                progressBar.style.width = `${((stepIndex + 1) / totalSteps) * 100}%`;
                stepIndex += 1;
                setTimeout(nextStep, 700);
            }

            nextStep();
        });
    }

    function buildCareerPlan(role, userSkills) {
        const normalizedRole = role.trim();
        const now = new Date();
        const roleData = getRoleData(normalizedRole);
        const roadmap = generateRoadmap(normalizedRole, roleData);
        const projects = generateProjects(normalizedRole, roleData);
        const questions = generateQuestions(normalizedRole, roleData);
        const resumeTips = generateResumeTips(normalizedRole, roleData);
        const skillGap = generateSkillGap(normalizedRole, roleData, userSkills);

        const youtubeResources = generateYoutubeResources(normalizedRole);

        return {
            role: normalizedRole,
            createdAt: now.toISOString(),
            roadmap,
            projects,
            questions,
            resumeTips,
            skillGap,
            youtubeResources,
            skills: [...userSkills],
            roleData
        };
    }

    function getRoleData(role) {
        const lower = role.toLowerCase();
        const common = {
            frontend: {
                coreSkills: ['HTML', 'CSS', 'JavaScript', 'React', 'TypeScript'],
                technologies: ['React', 'Next.js', 'Tailwind CSS', 'Vite', 'Figma'],
                focus: 'building polished user experiences and components',
                questionTemplates: [
                    'Explain the difference between CSS Grid and Flexbox.',
                    'How do you optimize a React application for performance?',
                    'What is the virtual DOM and how does it work?',
                    'How do you ensure a web UI is accessible for diverse users?',
                    'Describe how you reuse components to build consistent interfaces.',
                    'How do you troubleshoot cross-browser compatibility issues?',
                    'What is the difference between let, const, and var?',
                    'How do you implement responsive design?',
                    'Explain the concept of closures in JavaScript.',
                    'How do you manage state in a React application?',
                    'What are CSS preprocessors and why use them?',
                    'How do you handle asynchronous operations in JavaScript?',
                    'Explain the box model in CSS.',
                    'How do you implement lazy loading in React?',
                    'What is the difference between props and state in React?'
                ],
                resumeTips: [
                    'Highlight component-driven development and reusable UI patterns.',
                    'Note performance improvements and accessibility enhancements.',
                    'Showcase cross-browser compatibility and responsive layouts.'
                ]
            },
            backend: {
                coreSkills: ['Node.js', 'Express', 'Databases', 'REST APIs', 'Security'],
                technologies: ['Node.js', 'Express', 'PostgreSQL', 'Docker', 'Redis'],
                focus: 'scalable services, APIs, and data architecture',
                questionTemplates: [
                    'How do you design a RESTful API and handle versioning?',
                    'Explain database normalization and when to denormalize.',
                    'What is a middleware and how is it used in backend systems?',
                    'How do you manage microservices communication?',
                    'What is caching and when should you use it?',
                    'How do you monitor a production backend service?',
                    'What are the differences between SQL and NoSQL databases?',
                    'How do you handle authentication and authorization?',
                    'Explain the concept of load balancing.',
                    'How do you secure a web application against common vulnerabilities?',
                    'What is ORM and when to use it?',
                    'How do you handle database transactions?',
                    'Explain the concept of API rate limiting.',
                    'How do you implement logging in a backend service?',
                    'What is containerization and why use Docker?'
                ],
                resumeTips: [
                    'List backend systems, API endpoints, and security protocols.',
                    'Showcase work with databases, caching, and cloud deployment.',
                    'Include examples of scaling, monitoring, and reliability.'
                ]
            },
            fullstack: {
                coreSkills: ['HTML', 'CSS', 'JavaScript', 'React', 'Node.js', 'Databases'],
                technologies: ['React', 'Node.js', 'MongoDB', 'TypeScript', 'CI/CD'],
                focus: 'end-to-end product delivery across frontend and backend',
                questionTemplates: [
                    'Describe how you would connect a frontend app to a backend API.',
                    'What is authentication and how do you secure user sessions?',
                    'How do you manage state in a modern web application?',
                    'How do you balance performance between client and server?',
                    'How do you deploy a full-stack application reliably?',
                    'How do you incorporate user feedback into product iterations?',
                    'What are the benefits of using TypeScript in a full-stack project?',
                    'How do you handle database migrations?',
                    'Explain the role of CI/CD in full-stack development.',
                    'How do you ensure data consistency across frontend and backend?',
                    'What is server-side rendering and when to use it?',
                    'How do you implement error handling in a full-stack app?',
                    'Explain the concept of progressive web apps.',
                    'How do you optimize database queries?',
                    'What is the role of version control in team development?'
                ],
                resumeTips: [
                    'Capture full-stack projects from design to deployment.',
                    'Highlight collaboration with designers and backend teams.',
                    'Show results like faster delivery, improved UX, or reliability.'
                ]
            },
            ai: {
                coreSkills: ['Python', 'Machine Learning', 'Data Analysis', 'TensorFlow', 'PyTorch'],
                technologies: ['Python', 'TensorFlow', 'PyTorch', 'Pandas', 'scikit-learn'],
                focus: 'ML models, data pipelines, and intelligent systems',
                questionTemplates: [
                    'What is the difference between supervised and unsupervised learning?',
                    'Explain overfitting and techniques to prevent it.',
                    'How do you evaluate model performance and choose metrics?',
                    'How do you preprocess data for model training?',
                    'What is model validation and why is it important?',
                    'How do you handle bias in machine learning models?',
                    'What are neural networks and how do they work?',
                    'How do you deploy a machine learning model?',
                    'Explain the concept of feature engineering.',
                    'What is deep learning and its applications?',
                    'What is the difference between classification and regression?',
                    'How do you handle imbalanced datasets?',
                    'Explain the concept of ensemble learning.',
                    'What is natural language processing?',
                    'How do you interpret model predictions?'
                ],
                resumeTips: [
                    'Describe datasets, models, and the impact of your results.',
                    'Mention experiments, model tuning, and deployment steps.',
                    'Include performance metrics and business outcomes when possible.'
                ]
            },
            data: {
                coreSkills: ['SQL', 'Data Visualization', 'Excel', 'Python', 'Statistics'],
                technologies: ['Python', 'SQL', 'Tableau', 'Power BI', 'Excel'],
                focus: 'data interpretation, reporting, and actionable insights',
                questionTemplates: [
                    'How do you design a dashboard for stakeholder reporting?',
                    'Explain the difference between descriptive and predictive analytics.',
                    'What techniques do you use to clean messy datasets?',
                    'How do you choose the right chart type for data?',
                    'What is ETL and why is it important?',
                    'How do you validate findings with stakeholders?',
                    'What are the key steps in data analysis?',
                    'How do you handle missing data?',
                    'Explain the concept of data normalization.',
                    'How do you present data insights effectively?',
                    'What is data warehousing?',
                    'How do you perform statistical hypothesis testing?',
                    'Explain the concept of correlation vs causation.',
                    'What is A/B testing?',
                    'How do you ensure data privacy and compliance?'
                ],
                resumeTips: [
                    'Showcase dashboards and reports with measurable business impact.',
                    'Highlight data storytelling and metric-driven recommendations.',
                    'Include tools used for analysis and visualization.'
                ]
            },
            devops: {
                coreSkills: ['Linux', 'Docker', 'Kubernetes', 'CI/CD', 'Cloud (AWS/GCP/Azure)'],
                technologies: ['Docker', 'Kubernetes', 'AWS', 'Terraform', 'GitHub Actions'],
                focus: 'automating infrastructure, deployments, and cloud operations',
                questionTemplates: [
                    'What is the difference between Docker and Kubernetes?',
                    'How do you design a CI/CD pipeline from scratch?',
                    'Explain Infrastructure as Code and why it matters.',
                    'How do you monitor and alert on a production system?',
                    'What is blue-green deployment and when would you use it?',
                    'How do you manage secrets and environment variables securely?',
                    'What is the role of Terraform in cloud infrastructure?',
                    'How do you handle rollbacks in a deployment pipeline?',
                    'Explain the concept of immutable infrastructure.',
                    'How do you optimize cloud costs without sacrificing reliability?',
                    'What is container orchestration and why is it needed?',
                    'How do you implement auto-scaling on AWS?',
                    'Explain the difference between VMs and containers.',
                    'How do you ensure high availability in a distributed system?',
                    'What is GitOps and how does it work?'
                ],
                resumeTips: [
                    'Quantify uptime improvements, deployment frequency, and incident reduction.',
                    'Highlight cloud certifications (AWS, GCP, Azure) prominently.',
                    'Showcase automation wins — pipelines built, manual steps eliminated.'
                ]
            },
            mobile: {
                coreSkills: ['React Native / Flutter', 'JavaScript / Dart', 'Mobile UI', 'APIs', 'App Store Deployment'],
                technologies: ['React Native', 'Flutter', 'Expo', 'Firebase', 'Xcode / Android Studio'],
                focus: 'building performant cross-platform mobile applications',
                questionTemplates: [
                    'What are the differences between React Native and Flutter?',
                    'How do you handle navigation in a React Native app?',
                    'Explain the concept of the bridge in React Native.',
                    'How do you optimize performance in a mobile application?',
                    'How do you manage offline support and data caching on mobile?',
                    'What is the difference between a native module and a JS module?',
                    'How do you implement push notifications in a mobile app?',
                    'What are the steps to publish an app to the App Store or Play Store?',
                    'How do you handle deep linking in a mobile application?',
                    'Explain state management options available in Flutter.',
                    'How do you test a mobile application?',
                    'What is Expo and when would you not use it?',
                    'How do you handle different screen sizes and resolutions?',
                    'How do you integrate third-party APIs in a mobile app?',
                    'What is the role of Firebase in mobile development?'
                ],
                resumeTips: [
                    'Include App Store / Play Store links for published apps if available.',
                    'Mention download counts, ratings, or user metrics to stand out.',
                    'Highlight cross-platform work and platform-specific optimizations.'
                ]
            },
            uiux: {
                coreSkills: ['Figma', 'User Research', 'Wireframing', 'Prototyping', 'Usability Testing'],
                technologies: ['Figma', 'Adobe XD', 'Maze', 'Miro', 'Notion'],
                focus: 'crafting intuitive user experiences backed by research and testing',
                questionTemplates: [
                    'Walk me through your end-to-end design process.',
                    'How do you conduct user research with limited time or budget?',
                    'What is the difference between UX and UI design?',
                    'How do you decide between different design solutions?',
                    'Explain what a design system is and why it matters.',
                    'How do you handle stakeholder feedback that conflicts with user needs?',
                    'What usability testing methods have you used?',
                    'How do you design for accessibility (WCAG standards)?',
                    'What is information architecture and how do you apply it?',
                    'How do you measure the success of a UX design?',
                    'What is the difference between low-fidelity and high-fidelity prototypes?',
                    'How do you work effectively with developers during handoff?',
                    'Explain the concept of affinity mapping.',
                    'How do you approach designing for mobile-first experiences?',
                    'What is a user journey map and when do you use one?'
                ],
                resumeTips: [
                    'Lead with a portfolio link — it matters more than anything else on your resume.',
                    'Describe your process and outcomes, not just deliverables (e.g., "reduced task completion time by 25%").',
                    'Highlight cross-functional collaboration with engineers and product managers.'
                ]
            },
            blockchain: {
                coreSkills: ['Solidity', 'Web3.js / Ethers.js', 'Smart Contracts', 'DeFi Concepts', 'Ethereum'],
                technologies: ['Solidity', 'Hardhat', 'Ethers.js', 'IPFS', 'MetaMask'],
                focus: 'building decentralized applications and smart contract systems',
                questionTemplates: [
                    'What is the difference between Ethereum and Bitcoin at a technical level?',
                    'How do smart contracts work and what are their limitations?',
                    'What is a gas fee and how do you optimize for it?',
                    'Explain the ERC-20 and ERC-721 token standards.',
                    'How do you secure a Solidity smart contract?',
                    'What is a reentrancy attack and how do you prevent it?',
                    'How does consensus work in a blockchain network?',
                    'What is IPFS and why is it used in Web3?',
                    'Explain the concept of decentralized finance (DeFi).',
                    'How do you test smart contracts before deployment?',
                    'What is a DAO and how is it governed?',
                    'What are the trade-offs between on-chain and off-chain storage?',
                    'How do you interact with a deployed contract using Ethers.js?',
                    'What is the difference between a hot wallet and a cold wallet?',
                    'Explain the role of oracles in smart contracts.'
                ],
                resumeTips: [
                    'Always include links to deployed contracts on Etherscan or testnets.',
                    'Highlight audit experience or security-conscious development practices.',
                    'Showcase DeFi, NFT, or DAO projects with real on-chain activity.'
                ]
            },
            qa: {
                coreSkills: ['Manual Testing', 'Automation Testing', 'Selenium / Playwright', 'Jest', 'Bug Reporting'],
                technologies: ['Selenium', 'Playwright', 'Jest', 'Cypress', 'Postman'],
                focus: 'ensuring software quality through systematic testing and automation',
                questionTemplates: [
                    'What is the difference between manual and automated testing?',
                    'How do you write a good test case?',
                    'Explain the difference between unit, integration, and end-to-end tests.',
                    'How do you prioritize which tests to automate?',
                    'What is a regression test suite and why is it important?',
                    'How do you handle flaky tests in an automation suite?',
                    'What is your process for reporting and tracking bugs?',
                    'How do you test an API using Postman or similar tools?',
                    'What is test-driven development (TDD)?',
                    'How do you ensure test coverage is adequate?',
                    'What is the role of a QA engineer in an Agile team?',
                    'How do you approach performance testing?',
                    'What is the difference between black-box and white-box testing?',
                    'How do you test for security vulnerabilities as a QA engineer?',
                    'How do you set up a CI pipeline to run automated tests?'
                ],
                resumeTips: [
                    'Highlight the percentage of test coverage you achieved on past projects.',
                    'Mention automation frameworks and how they reduced release time or bugs.',
                    'Show experience working closely with developers in Agile sprints.'
                ]
            },
            security: {
                coreSkills: ['Networking', 'Security Analysis', 'Incident Response', 'Compliance', 'Tools'],
                technologies: ['Wireshark', 'Kali Linux', 'SIEM', 'Firewalls', 'Pen testing'],
                focus: 'protecting systems, identifying threats, and improving defenses',
                questionTemplates: [
                    'How do you perform a vulnerability assessment?',
                    'Explain the difference between encryption and hashing.',
                    'What steps do you take after discovering a security breach?',
                    'What is the principle of least privilege?',
                    'How do you secure API endpoints?',
                    'How do you conduct secure code reviews?',
                    'What are common types of cyber attacks?',
                    'How do you implement multi-factor authentication?',
                    'Explain the role of firewalls in network security.',
                    'How do you stay updated on emerging security threats?',
                    'What is penetration testing?',
                    'How do you handle incident response?',
                    'Explain the concept of zero trust security.',
                    'What is cryptography and its types?',
                    'How do you secure cloud environments?'
                ],
                resumeTips: [
                    'Detail assessments, remediation actions, and risk reduction metrics.',
                    'Describe experience with security frameworks and audits.',
                    'Mention incident response and policy improvements.'
                ]
            },
            default: {
                coreSkills: ['Communication', 'Problem Solving', 'Team Collaboration'],
                technologies: ['Git', 'Terminal', 'Documentation'],
                focus: 'building transferable technical and project skills',
                questionTemplates: [
                    'What project are you most proud of and why?',
                    'How do you stay updated on new tools and technologies?',
                    'Describe a time you solved a difficult technical problem.',
                    'How do you prioritize learning new tools?',
                    'What makes a technical solution user-friendly?',
                    'How do you handle feedback from peers?',
                    'How do you approach debugging a complex issue?',
                    'What is your process for learning a new technology?',
                    'How do you collaborate on a team project?',
                    'Describe your approach to time management in development.',
                    'How do you handle project deadlines?',
                    'What is your experience with version control?',
                    'How do you ensure code quality?',
                    'Describe a challenging team dynamic you navigated.',
                    'How do you balance technical debt and new features?'
                ],
                resumeTips: [
                    'Summarize your strongest accomplishments clearly.',
                    'Focus on measurable outcomes and collaboration.',
                    'Show the technologies and tools you used confidently.'
                ]
            }
        };

        if (lower.includes('frontend')) return common.frontend;
        if (lower.includes('backend') && !lower.includes('full')) return common.backend;
        if (lower.includes('full') || lower.includes('full stack')) return common.fullstack;
        if (lower.includes('ai') || lower.includes('ml') || lower.includes('machine')) return common.ai;
        if (lower.includes('data') || lower.includes('analyst') || lower.includes('analytics')) return common.data;
        if (lower.includes('security') || lower.includes('cyber')) return common.security;
        if (lower.includes('devops') || lower.includes('cloud engineer')) return common.devops;
        if (lower.includes('mobile')) return common.mobile;
        if (lower.includes('ui') || lower.includes('ux') || lower.includes('designer')) return common.uiux;
        if (lower.includes('blockchain') || lower.includes('web3') || lower.includes('solidity')) return common.blockchain;
        if (lower.includes('qa') || lower.includes('test engineer') || lower.includes('quality')) return common.qa;
        return common.default;
    }

    function generateRoadmap(role, roleData) {
        const lower = role.toLowerCase();

        const roadmaps = {
            frontend: [
                {
                    phase: 'Phase 1', title: 'Master the Core Web Fundamentals',
                    description: 'Start by deeply understanding HTML semantics, CSS layouts (Flexbox & Grid), and vanilla JavaScript. These aren\'t just basics — they\'re the foundation every great frontend developer returns to. Focus on building static pages, responsive layouts, and understanding how the browser renders content.',
                    skills: ['HTML5', 'CSS3', 'JavaScript ES6+', 'Responsive Design']
                },
                {
                    phase: 'Phase 2', title: 'Build Dynamic UIs with React',
                    description: 'Dive into React — the most in-demand frontend library. Learn components, props, state, hooks (useState, useEffect, useContext), and how to manage data flow. Build at least 2 small React apps that interact with an API so you understand real-world component architecture.',
                    skills: ['React', 'Hooks', 'Component Architecture', 'API Integration']
                },
                {
                    phase: 'Phase 3', title: 'Level Up with TypeScript & Tooling',
                    description: 'Add TypeScript to your stack — it\'s expected in most professional frontend roles. Learn type annotations, interfaces, and generics. Also get comfortable with modern build tools like Vite, and version control workflows using Git branches and pull requests.',
                    skills: ['TypeScript', 'Vite', 'Git', 'npm / yarn']
                },
                {
                    phase: 'Phase 4', title: 'Style Professionally & Optimize Performance',
                    description: 'Learn Tailwind CSS and a UI library like shadcn or MUI to build polished interfaces quickly. Then focus on performance: lazy loading, image optimization, Core Web Vitals, and accessibility (a11y). Recruiters notice when candidates care about both design and performance.',
                    skills: ['Tailwind CSS', 'Accessibility', 'Core Web Vitals', 'Lazy Loading']
                },
                {
                    phase: 'Phase 5', title: 'Deploy & Build a Strong Portfolio',
                    description: 'Deploy your projects on Vercel or Netlify with a custom domain. Build at least one polished, end-to-end project that showcases everything — auth, API calls, responsive design, and clean UI. Your portfolio is your interview before the interview.',
                    skills: ['Vercel / Netlify', 'Next.js', 'Portfolio Projects', 'SEO Basics']
                }
            ],
            backend: [
                {
                    phase: 'Phase 1', title: 'Learn Node.js & Server-Side JavaScript',
                    description: 'Understand how Node.js works — the event loop, non-blocking I/O, and why it\'s great for building APIs. Learn to create simple HTTP servers from scratch before moving to frameworks. This foundation ensures you understand what Express is doing under the hood.',
                    skills: ['Node.js', 'Event Loop', 'HTTP Basics', 'CommonJS / ESM']
                },
                {
                    phase: 'Phase 2', title: 'Build RESTful APIs with Express',
                    description: 'Express is the backbone of most Node.js backends. Learn routing, middleware, request/response handling, and error management. Build a complete CRUD API for a real resource — like a task manager or blog system — with proper validation and status codes.',
                    skills: ['Express.js', 'REST APIs', 'Middleware', 'Input Validation']
                },
                {
                    phase: 'Phase 3', title: 'Master Databases — SQL & NoSQL',
                    description: 'Learn both PostgreSQL (relational) and MongoDB (document-based). Understand when to use each, how to design schemas, write efficient queries, use indexes, and handle relationships. Use Prisma or Mongoose as your ORM/ODM to speed up development.',
                    skills: ['PostgreSQL', 'MongoDB', 'Prisma / Mongoose', 'Database Design']
                },
                {
                    phase: 'Phase 4', title: 'Secure Your APIs & Add Authentication',
                    description: 'Security is non-negotiable for backend roles. Implement JWT authentication, password hashing with bcrypt, rate limiting, and HTTPS. Understand OWASP top 10 vulnerabilities and how to prevent SQL injection, XSS, and CSRF in your own APIs.',
                    skills: ['JWT Auth', 'bcrypt', 'Rate Limiting', 'OWASP Security']
                },
                {
                    phase: 'Phase 5', title: 'Deploy, Monitor & Scale Your Backend',
                    description: 'Containerize your backend with Docker and deploy to a cloud provider (Railway, Render, or AWS EC2). Set up environment variables, logging with Winston, and basic monitoring. Understanding deployment and CI/CD pipelines is what separates junior from mid-level developers.',
                    skills: ['Docker', 'CI/CD', 'Logging & Monitoring', 'Cloud Deployment']
                }
            ],
            fullstack: [
                {
                    phase: 'Phase 1', title: 'Solidify Your Frontend Foundation',
                    description: 'Before building full-stack apps, get comfortable with React, component patterns, hooks, and making API calls from the frontend. You should be able to build a responsive, interactive UI that fetches and displays data — this is the launchpad for everything full-stack.',
                    skills: ['React', 'JavaScript ES6+', 'Fetch / Axios', 'Responsive UI']
                },
                {
                    phase: 'Phase 2', title: 'Build Backend APIs with Node.js & Express',
                    description: 'Set up an Express server with REST endpoints and connect it to your React frontend. Learn CORS, environment variables, and how to structure a backend project cleanly. Build one full CRUD project where the frontend and backend are completely wired together.',
                    skills: ['Node.js', 'Express', 'REST API', 'CORS & Env Config']
                },
                {
                    phase: 'Phase 3', title: 'Integrate Databases & Authentication',
                    description: 'Add a real database to your stack — PostgreSQL or MongoDB. Implement user authentication with JWT so users can sign up, log in, and access protected routes. This is the step that turns your apps from demos into real products with persistent data.',
                    skills: ['MongoDB / PostgreSQL', 'JWT Auth', 'Sessions', 'Protected Routes']
                },
                {
                    phase: 'Phase 4', title: 'Level Up with TypeScript & Next.js',
                    description: 'Adopt TypeScript across both frontend and backend for type safety. Learn Next.js for server-side rendering, static generation, and API routes — it lets you build full-stack apps in a single codebase. This is the modern professional full-stack stack.',
                    skills: ['TypeScript', 'Next.js', 'SSR / SSG', 'API Routes']
                },
                {
                    phase: 'Phase 5', title: 'Ship & Maintain Production-Ready Apps',
                    description: 'Deploy your full-stack app with a proper pipeline — Vercel for frontend, Railway or Render for backend. Set up a CI/CD workflow with GitHub Actions, add error monitoring (Sentry), and practice writing tests for both frontend and API layers.',
                    skills: ['Vercel / Railway', 'GitHub Actions', 'Testing', 'Error Monitoring']
                }
            ],
            ai: [
                {
                    phase: 'Phase 1', title: 'Build a Strong Python & Math Foundation',
                    description: 'Python is the language of AI/ML. Get deeply comfortable with it — functions, list comprehensions, OOP, and libraries like NumPy and Pandas for data manipulation. Also revisit the math: linear algebra, probability, and statistics are the building blocks of every ML algorithm.',
                    skills: ['Python', 'NumPy', 'Pandas', 'Statistics & Linear Algebra']
                },
                {
                    phase: 'Phase 2', title: 'Learn Core Machine Learning Concepts',
                    description: 'Study supervised and unsupervised learning algorithms using scikit-learn. Understand regression, classification, clustering, decision trees, and SVMs. Practice on real datasets from Kaggle — the goal is to understand when and why each algorithm applies, not just how to run it.',
                    skills: ['scikit-learn', 'Regression', 'Classification', 'Model Evaluation']
                },
                {
                    phase: 'Phase 3', title: 'Dive into Deep Learning with PyTorch or TensorFlow',
                    description: 'Move into neural networks — start with feedforward networks, then convolutional networks (CNNs) for images and recurrent networks (RNNs) for sequences. Use PyTorch or TensorFlow. Understand backpropagation, loss functions, and training loops from the inside out.',
                    skills: ['PyTorch / TensorFlow', 'Neural Networks', 'CNN / RNN', 'Training Loops']
                },
                {
                    phase: 'Phase 4', title: 'Work on NLP, Computer Vision & Real Datasets',
                    description: 'Pick a specialization: NLP (text classification, transformers, LLMs) or Computer Vision (image recognition, object detection). Use Hugging Face for pretrained models. Work on a real dataset end-to-end — preprocessing, training, evaluation, and iteration.',
                    skills: ['Hugging Face', 'NLP / Computer Vision', 'Transformers', 'Data Pipelines']
                },
                {
                    phase: 'Phase 5', title: 'Deploy Models & Build an AI Portfolio',
                    description: 'Package your trained models with FastAPI or Flask and deploy them as REST APIs. Host demos on HuggingFace Spaces or Streamlit Cloud. Document your experiments with metrics, decisions, and results — this is your portfolio. Companies hire based on shipped projects, not just theory.',
                    skills: ['FastAPI / Flask', 'Model Deployment', 'Streamlit', 'MLflow / Experiment Tracking']
                }
            ],
            data: [
                {
                    phase: 'Phase 1', title: 'Master SQL — The Core Language of Data',
                    description: 'SQL is the single most important skill for any data analyst. Go beyond basic SELECT — master JOINs, subqueries, window functions (RANK, LAG, LEAD), CTEs, and aggregations. Practice on real databases. If you can write clean, efficient SQL, you can get a job.',
                    skills: ['SQL', 'JOINs', 'Window Functions', 'CTEs & Subqueries']
                },
                {
                    phase: 'Phase 2', title: 'Analyze & Clean Data with Python',
                    description: 'Learn Python specifically for data — Pandas for manipulation, NumPy for computation, and Matplotlib/Seaborn for visualization. Practice cleaning messy datasets: handling nulls, fixing types, deduplicating, and reshaping. Real-world data is almost always messy.',
                    skills: ['Pandas', 'NumPy', 'Matplotlib', 'Data Cleaning']
                },
                {
                    phase: 'Phase 3', title: 'Build Dashboards & Visualizations That Tell Stories',
                    description: 'Learn Tableau or Power BI to build executive-ready dashboards. Focus on visual communication — which chart type to use, how to highlight insights, and how to build interactive filters. A dashboard that tells a clear story is worth more than a technically perfect one.',
                    skills: ['Tableau / Power BI', 'Dashboard Design', 'KPI Tracking', 'Storytelling with Data']
                },
                {
                    phase: 'Phase 4', title: 'Apply Statistics & Interpret Business Problems',
                    description: 'Move beyond describing data to drawing conclusions. Learn A/B testing, hypothesis testing, correlation vs causation, and confidence intervals. Practice converting a business question — like "Why did sales drop?" — into a structured analysis with a defensible answer.',
                    skills: ['A/B Testing', 'Hypothesis Testing', 'Statistical Inference', 'Business Analytics']
                },
                {
                    phase: 'Phase 5', title: 'Build a Portfolio of Real-World Analyses',
                    description: 'Do 2-3 end-to-end analysis projects on public datasets — revenue analysis, user behavior, or churn prediction. Document your findings in a clear report or dashboard. Host your SQL and Python work on GitHub. Analytical thinking communicated clearly is what data analyst hiring managers look for.',
                    skills: ['Portfolio Projects', 'GitHub', 'Excel / Sheets', 'Reporting & Presentation']
                }
            ],
            security: [
                {
                    phase: 'Phase 1', title: 'Build a Solid Networking & OS Foundation',
                    description: 'Cybersecurity sits on top of networking and operating systems. Learn TCP/IP, DNS, HTTP/S, firewalls, and VPNs. Get comfortable in Linux — the command line, file permissions, processes, and networking tools like netstat and nmap. Without this foundation, everything else is surface-level.',
                    skills: ['TCP/IP Networking', 'Linux CLI', 'DNS & HTTP', 'Firewalls & VPNs']
                },
                {
                    phase: 'Phase 2', title: 'Understand Core Security Concepts & Threats',
                    description: 'Study the OWASP Top 10, common attack vectors (XSS, SQL injection, CSRF, MITM), and the CIA triad (Confidentiality, Integrity, Availability). Learn how attackers think — understanding offensive tactics is what makes a great defender. Set up a home lab with VMs to practice safely.',
                    skills: ['OWASP Top 10', 'Attack Vectors', 'CIA Triad', 'Home Lab Setup']
                },
                {
                    phase: 'Phase 3', title: 'Learn Ethical Hacking & Penetration Testing',
                    description: 'Get hands-on with Kali Linux and penetration testing tools — Nmap, Metasploit, Burp Suite, and Wireshark. Practice on legal platforms like HackTheBox and TryHackMe. Earning your first few "flags" builds real practical skills and proves ability in interviews.',
                    skills: ['Kali Linux', 'Burp Suite', 'Metasploit', 'HackTheBox / TryHackMe']
                },
                {
                    phase: 'Phase 4', title: 'Master Security Operations & Incident Response',
                    description: 'Learn how Security Operations Centers (SOCs) work. Understand SIEM tools (Splunk, IBM QRadar), log analysis, alert triage, and how to write an incident response playbook. Practice analyzing real attack logs — many job roles center entirely on detection and response.',
                    skills: ['SIEM Tools', 'Log Analysis', 'Incident Response', 'Threat Detection']
                },
                {
                    phase: 'Phase 5', title: 'Certify, Specialize & Build Your Security Portfolio',
                    description: 'Pursue CompTIA Security+ as your first certification — it\'s widely recognized and opens many entry-level doors. Then pick a specialization: red team (offensive), blue team (defensive), or cloud security. Document your CTF writeups and home lab projects on GitHub or a personal blog.',
                    skills: ['CompTIA Security+', 'CTF Writeups', 'Cloud Security Basics', 'Portfolio & Blog']
                }
            ],
            devops: [
                { phase: 'Phase 1', title: 'Master Linux & Scripting Foundations', description: 'DevOps starts with Linux. Get fluent in the command line — file system navigation, process management, networking commands, and bash scripting. A DevOps engineer who can\'t write a bash script is limited. Also learn Git deeply — branching strategies, rebasing, and merge conflicts are daily work.', skills: ['Linux CLI', 'Bash Scripting', 'Git & Branching', 'Networking Basics'] },
                { phase: 'Phase 2', title: 'Containerize Everything with Docker', description: 'Docker is the entry point for modern DevOps. Understand images, containers, volumes, and networking. Write Dockerfiles for real applications, set up multi-container apps with Docker Compose, and learn how containers differ from virtual machines. Build and publish your own image to Docker Hub.', skills: ['Docker', 'Dockerfile', 'Docker Compose', 'Container Networking'] },
                { phase: 'Phase 3', title: 'Orchestrate at Scale with Kubernetes', description: 'Kubernetes is how containers run in production at scale. Learn pods, deployments, services, ingress, config maps, and secrets. Set up a local cluster with Minikube or Kind. Understand how Kubernetes handles self-healing, rolling updates, and horizontal scaling — these are interview gold.', skills: ['Kubernetes', 'Pods & Deployments', 'Helm', 'Ingress & Services'] },
                { phase: 'Phase 4', title: 'Build CI/CD Pipelines & Automate Everything', description: 'Set up automated CI/CD pipelines with GitHub Actions or GitLab CI. Automate testing, building Docker images, pushing to a registry, and deploying to Kubernetes or a cloud provider. Infrastructure as Code using Terraform is also essential — define your cloud resources in version-controlled config files.', skills: ['GitHub Actions', 'CI/CD Pipelines', 'Terraform', 'Infrastructure as Code'] },
                { phase: 'Phase 5', title: 'Cloud Platforms, Monitoring & Certification', description: 'Get hands-on with AWS (EC2, S3, RDS, EKS, IAM) or GCP/Azure. Set up observability with Prometheus, Grafana, and centralized logging (ELK Stack). Then pursue a cloud certification — AWS Solutions Architect Associate is the industry standard and dramatically boosts your hirability.', skills: ['AWS / GCP / Azure', 'Prometheus & Grafana', 'ELK Stack', 'AWS Certification'] }
            ],
            mobile: [
                { phase: 'Phase 1', title: 'Pick Your Stack: React Native or Flutter', description: 'Choose one framework and commit. React Native is great if you know JavaScript; Flutter uses Dart and offers better native performance. Set up your dev environment — Xcode for iOS simulation, Android Studio for Android. Build your first "Hello World" app and run it on a real device early.', skills: ['React Native / Flutter', 'Expo or CLI Setup', 'Simulator & Device Testing', 'Dart / JavaScript'] },
                { phase: 'Phase 2', title: 'Build Core Mobile UIs & Navigation', description: 'Learn the core UI components of your chosen framework — lists, forms, modals, and layouts. Implement stack and tab navigation using React Navigation or Flutter\'s Navigator 2.0. Build a multi-screen app with real navigation flow — this is the skeleton of every real app.', skills: ['Core UI Components', 'React Navigation / Flutter Nav', 'Layouts & Styling', 'Multi-Screen Apps'] },
                { phase: 'Phase 3', title: 'Integrate APIs, Firebase & State Management', description: 'Connect your app to a real backend — REST APIs or Firebase (Firestore, Auth, Storage). Manage app-wide state using Redux Toolkit, Zustand, or Flutter\'s Riverpod/Bloc. Handle async operations, loading states, and error boundaries — this is where mobile apps get complex and interesting.', skills: ['REST API Integration', 'Firebase', 'Redux / Riverpod', 'Async State Handling'] },
                { phase: 'Phase 4', title: 'Add Native Features & Optimize Performance', description: 'Integrate native device capabilities — camera, GPS, push notifications, biometrics, and offline storage (AsyncStorage / SQLite). Optimize performance: reduce re-renders, lazy load screens, optimize images, and measure startup time. Real app quality is judged on how it feels on a mid-range device.', skills: ['Native Modules', 'Push Notifications', 'Offline Storage', 'Performance Profiling'] },
                { phase: 'Phase 5', title: 'Publish to App Store & Play Store', description: 'Learn the app signing, build, and release process for both iOS (App Store Connect) and Android (Google Play Console). Set up OTA updates with Expo EAS or CodePush for React Native. Build a portfolio of 2 published apps — even free ones with real users show employers you can ship.', skills: ['App Store / Play Store Submission', 'EAS Build', 'App Signing & Release', 'Portfolio Apps'] }
            ],
            uiux: [
                { phase: 'Phase 1', title: 'Master Figma & Visual Design Fundamentals', description: 'Figma is the industry-standard design tool — learn it deeply: components, auto layout, styles, variants, and prototyping. Alongside that, study visual design principles: typography, color theory, spacing, contrast, and hierarchy. These fundamentals will make everything you design look intentional.', skills: ['Figma', 'Auto Layout', 'Color Theory', 'Typography & Spacing'] },
                { phase: 'Phase 2', title: 'Learn User Research & Problem Definition', description: 'Great UX starts before opening Figma. Learn how to run user interviews, create empathy maps, analyze competitors, and write problem statements. Practice converting vague briefs into clear design questions. The ability to define the right problem is what separates senior UX designers from juniors.', skills: ['User Interviews', 'Empathy Mapping', 'Competitive Analysis', 'Problem Statements'] },
                { phase: 'Phase 3', title: 'Design Wireframes, Flows & Prototypes', description: 'Move from research to structure — create user flows, information architecture maps, and low-fidelity wireframes. Then build interactive high-fidelity prototypes in Figma. Practice designing entire user journeys, not just single screens. Always design with real content, not Lorem Ipsum.', skills: ['User Flows', 'Wireframing', 'High-Fidelity Prototypes', 'Information Architecture'] },
                { phase: 'Phase 4', title: 'Build a Design System & Test With Real Users', description: 'Create a complete design system with reusable components, tokens, and documentation. Learn usability testing — recruit 5 users, run moderated sessions, and synthesize findings into actionable improvements. Iterating based on real feedback is the most valuable skill in UX.', skills: ['Design Systems', 'Component Libraries', 'Usability Testing', 'A/B Testing Basics'] },
                { phase: 'Phase 5', title: 'Build a Standout UX Portfolio', description: 'A UX portfolio is your entire application. Build 3 case studies that show your process end-to-end: problem discovery, research, ideation, design decisions, testing, and outcomes. Host on Notion, Framer, or a personal site. Recruiters spend 30 seconds — make your results impossible to miss.', skills: ['Portfolio Case Studies', 'Framer / Notion Site', 'Presentation Skills', 'Handoff to Developers'] }
            ],
            blockchain: [
                { phase: 'Phase 1', title: 'Understand Blockchain & Crypto Fundamentals', description: 'Before writing code, understand how blockchains actually work: distributed ledgers, consensus mechanisms (PoW vs PoS), cryptographic hashing, public/private keys, and wallets. Read the Ethereum whitepaper and understand what makes smart contracts different from traditional software.', skills: ['Blockchain Concepts', 'Cryptography Basics', 'Ethereum Architecture', 'Wallets & Keys'] },
                { phase: 'Phase 2', title: 'Learn Solidity & Write Smart Contracts', description: 'Solidity is the primary language for Ethereum smart contracts. Learn data types, functions, modifiers, events, mappings, and inheritance. Write basic contracts — a simple token, a voting system, or an escrow. Use Remix IDE to deploy to a testnet quickly and understand the deploy/interact loop.', skills: ['Solidity', 'Remix IDE', 'Smart Contract Structure', 'Testnet Deployment'] },
                { phase: 'Phase 3', title: 'Build, Test & Secure Contracts with Hardhat', description: 'Move to a professional development environment using Hardhat. Write unit tests with Ethers.js and Chai, use fixtures, and learn how to fork mainnet for realistic testing. Study common smart contract vulnerabilities — reentrancy, integer overflow, access control — and apply OpenZeppelin\'s audited libraries.', skills: ['Hardhat', 'Contract Testing', 'OpenZeppelin', 'Security Patterns'] },
                { phase: 'Phase 4', title: 'Connect Smart Contracts to a Web Frontend', description: 'Build a full dApp by connecting your contracts to a React frontend using Ethers.js and MetaMask. Handle wallet connection, transaction signing, and real-time contract event listening. Build one complete dApp — an NFT minting site, a DeFi staking page, or a DAO governance interface.', skills: ['Ethers.js', 'MetaMask Integration', 'React dApp', 'Event Listeners'] },
                { phase: 'Phase 5', title: 'Deploy, Audit & Build Your Web3 Portfolio', description: 'Deploy contracts to Ethereum mainnet or a Layer 2 (Polygon, Arbitrum, Base). Learn gas optimization techniques. Study audit reports from real projects (Code4rena, Sherlock) to understand production vulnerabilities. Build a GitHub portfolio with deployed contracts on Etherscan and live dApp demos.', skills: ['Mainnet / L2 Deployment', 'Gas Optimization', 'Audit Reports', 'Web3 Portfolio'] }
            ],
            qa: [
                { phase: 'Phase 1', title: 'Learn Software Testing Fundamentals', description: 'Understand what QA engineers actually do: test planning, test case design, bug reporting, and the software development lifecycle. Learn the difference between functional vs non-functional testing, black-box vs white-box, and static vs dynamic testing. This mental model is the foundation of everything.', skills: ['Testing Concepts', 'SDLC & Agile QA', 'Test Case Design', 'Bug Reporting'] },
                { phase: 'Phase 2', title: 'Practice Manual Testing & Exploratory Testing', description: 'Manual testing is still essential. Learn to write clear test cases and test plans, perform exploratory testing sessions, document bugs with reproducible steps, and track them in Jira or Linear. Practice on real applications — sign up for beta programs or test open-source apps.', skills: ['Test Plans', 'Exploratory Testing', 'Jira / Bug Tracking', 'Regression Testing'] },
                { phase: 'Phase 3', title: 'Automate UI Testing with Playwright or Selenium', description: 'Learn test automation using Playwright (modern and fast) or Selenium (widely used in enterprise). Write end-to-end tests that simulate real user actions: clicking, form submission, navigation, and assertions. Understand the Page Object Model (POM) design pattern for maintainable test code.', skills: ['Playwright / Selenium', 'Page Object Model', 'Test Selectors', 'Cross-Browser Testing'] },
                { phase: 'Phase 4', title: 'API Testing & Unit/Integration Testing', description: 'Test at every level of the stack. Use Postman or RestAssured for API testing — validate status codes, response bodies, schemas, and error handling. Learn Jest or Vitest for unit testing, and understand how to mock dependencies. A QA who can test APIs and write unit tests is far more hireable.', skills: ['Postman / API Testing', 'Jest / Vitest', 'Mocking', 'Integration Testing'] },
                { phase: 'Phase 5', title: 'CI/CD Integration & Performance Testing', description: 'Integrate your test suites into CI/CD pipelines so tests run automatically on every pull request. Learn basic performance testing with k6 or JMeter — understand response times, throughput, and breaking points. Pursue an ISTQB Foundation certification to validate your knowledge formally.', skills: ['GitHub Actions / CI', 'k6 / JMeter', 'Performance Testing', 'ISTQB Certification'] }
            ]
        };

        let key = 'default';
        if (lower.includes('frontend')) key = 'frontend';
        else if (lower.includes('backend') && !lower.includes('full')) key = 'backend';
        else if (lower.includes('full')) key = 'fullstack';
        else if (lower.includes('ai') || lower.includes('ml') || lower.includes('machine')) key = 'ai';
        else if (lower.includes('data') || lower.includes('analyst')) key = 'data';
        else if (lower.includes('security') || lower.includes('cyber')) key = 'security';
        else if (lower.includes('devops') || lower.includes('cloud engineer')) key = 'devops';
        else if (lower.includes('mobile')) key = 'mobile';
        else if (lower.includes('ui') || lower.includes('ux') || lower.includes('designer')) key = 'uiux';
        else if (lower.includes('blockchain') || lower.includes('web3') || lower.includes('solidity')) key = 'blockchain';
        else if (lower.includes('qa') || lower.includes('test engineer') || lower.includes('quality')) key = 'qa';

        if (roadmaps[key]) return roadmaps[key];

        // Fallback for unrecognized roles
        return roleData.coreSkills.slice(0, 5).map((skill, index) => ({
            phase: `Phase ${index + 1}`,
            title: ['Build Your Foundation', 'Apply Skills in Projects', 'Master Best Practices', 'Integrate Real-World Workflows', 'Deploy & Build Your Portfolio'][index] || `${skill} Mastery`,
            description: `Focus deeply on ${skill} — understand not just the syntax but the underlying concepts. Practice by building something real, even if it\'s small. Consistent hands-on work compounds faster than any other learning approach.`,
            skills: [skill, roleData.coreSkills[index + 1] || roleData.technologies[0]]
        }));
    }

    function generateProjects(role, roleData) {
        const lower = role.toLowerCase();

        const projectSets = {
            frontend: [
                {
                    title: 'Personal Finance Dashboard',
                    description: 'Build a responsive dashboard where users can track income, expenses, and savings goals. Include interactive charts (Chart.js or Recharts), category filters, and a monthly summary. Focus on clean layout, accessibility, and mobile responsiveness.',
                    difficulty: 'Beginner',
                    stack: ['HTML', 'CSS', 'JavaScript', 'Chart.js']
                },
                {
                    title: 'GitHub Profile Finder',
                    description: 'Create a React app that lets users search any GitHub username and view their profile, repositories, stars, and follower count using the GitHub API. Add loading states, error handling, and a dark/light mode toggle. Deploy it on Vercel.',
                    difficulty: 'Intermediate',
                    stack: ['React', 'GitHub API', 'Tailwind CSS', 'Vercel']
                },
                {
                    title: 'Real-Time Collaborative Notes App',
                    description: 'Build a notes app with real-time sync using Firebase or Supabase. Users can create, edit, and delete notes that update live. Add authentication, rich text editing, and tag-based filtering. This demonstrates frontend + real-time backend integration.',
                    difficulty: 'Advanced',
                    stack: ['React', 'TypeScript', 'Firebase', 'Tailwind CSS']
                }
            ],
            backend: [
                {
                    title: 'RESTful Blog API',
                    description: 'Design and build a fully documented REST API for a blog platform. Include endpoints for users, posts, comments, and categories with JWT authentication, role-based access (admin/user), input validation, and pagination. Use Postman or Swagger to document all routes.',
                    difficulty: 'Beginner',
                    stack: ['Node.js', 'Express', 'MongoDB', 'JWT']
                },
                {
                    title: 'E-Commerce Backend with Cart & Orders',
                    description: 'Build the complete backend for a small e-commerce store — product catalog, user cart, order placement, payment webhook simulation, and order history. Use PostgreSQL with Prisma ORM. Add Redis caching for product listings to simulate real production patterns.',
                    difficulty: 'Intermediate',
                    stack: ['Node.js', 'PostgreSQL', 'Prisma', 'Redis']
                },
                {
                    title: 'Scalable URL Shortener Service',
                    description: 'Create a production-style URL shortener (like bit.ly) with click analytics, custom slugs, link expiry, and rate limiting. Deploy with Docker, set up a CI/CD pipeline with GitHub Actions, and add monitoring with basic health-check endpoints.',
                    difficulty: 'Advanced',
                    stack: ['Node.js', 'PostgreSQL', 'Docker', 'GitHub Actions']
                }
            ],
            fullstack: [
                {
                    title: 'Task Management App (Trello-style)',
                    description: 'Build a kanban-style task manager with drag-and-drop boards, cards, and columns. Use React on the frontend and Node.js + Express on the backend with MongoDB. Add user authentication so each user has their own boards. Deploy the full stack.',
                    difficulty: 'Beginner',
                    stack: ['React', 'Node.js', 'MongoDB', 'JWT Auth']
                },
                {
                    title: 'Job Application Tracker',
                    description: 'Create an app where users can log job applications, track statuses (applied, interview, offer, rejected), add notes, and set reminders. Build with Next.js + Prisma + PostgreSQL. Include a dashboard with charts showing application trends.',
                    difficulty: 'Intermediate',
                    stack: ['Next.js', 'PostgreSQL', 'Prisma', 'Tailwind CSS']
                },
                {
                    title: 'Social Dev Community Platform',
                    description: 'Build a developer community app where users can post questions, answer others, upvote content, and follow topics — inspired by dev.to. Include real-time notifications, markdown post support, user profiles with activity history, and full auth.',
                    difficulty: 'Advanced',
                    stack: ['Next.js', 'TypeScript', 'PostgreSQL', 'WebSockets']
                }
            ],
            ai: [
                {
                    title: 'Movie Recommendation Engine',
                    description: 'Build a content-based or collaborative filtering recommendation system using the MovieLens dataset. Implement cosine similarity or matrix factorization, evaluate with RMSE and precision metrics, and expose it as a simple web interface using Streamlit.',
                    difficulty: 'Beginner',
                    stack: ['Python', 'Pandas', 'scikit-learn', 'Streamlit']
                },
                {
                    title: 'Sentiment Analysis API for Product Reviews',
                    description: 'Train a sentiment classifier on Amazon or Yelp review data. Fine-tune a pretrained model from Hugging Face (like DistilBERT), evaluate it with F1/accuracy metrics, and deploy it as a FastAPI endpoint so it can be consumed by any frontend.',
                    difficulty: 'Intermediate',
                    stack: ['Python', 'Hugging Face', 'FastAPI', 'scikit-learn']
                },
                {
                    title: 'AI Document Q&A System (RAG Pipeline)',
                    description: 'Build a Retrieval-Augmented Generation system where users can upload a PDF and ask natural language questions about it. Use LangChain, OpenAI or a local LLM, and a vector store (FAISS or Chroma). Deploy on HuggingFace Spaces for portfolio visibility.',
                    difficulty: 'Advanced',
                    stack: ['Python', 'LangChain', 'FAISS', 'Streamlit']
                }
            ],
            data: [
                {
                    title: 'E-Commerce Sales Analysis Dashboard',
                    description: 'Take a public e-commerce dataset (like the Olist Brazil dataset on Kaggle) and perform a full analysis — revenue by category, customer retention, peak sales periods, and top-performing sellers. Build an interactive Tableau or Power BI dashboard with executive-level insights.',
                    difficulty: 'Beginner',
                    stack: ['SQL', 'Excel', 'Tableau / Power BI', 'Python']
                },
                {
                    title: 'Customer Churn Prediction Model',
                    description: 'Use a telecom or SaaS churn dataset to build a predictive model in Python. Perform EDA, handle class imbalance, engineer features, and compare Logistic Regression, Random Forest, and XGBoost. Present your findings with a visual report showing which factors drive churn.',
                    difficulty: 'Intermediate',
                    stack: ['Python', 'Pandas', 'scikit-learn', 'Matplotlib']
                },
                {
                    title: 'Real-Time Analytics Pipeline',
                    description: 'Build an end-to-end data pipeline that ingests live data (from a public API or Kafka simulator), transforms it with Python, stores it in a PostgreSQL data warehouse, and visualizes KPIs in a live Metabase or Grafana dashboard. Document your ETL architecture.',
                    difficulty: 'Advanced',
                    stack: ['Python', 'PostgreSQL', 'Apache Kafka', 'Metabase']
                }
            ],
            security: [
                {
                    title: 'Vulnerability Scanner CLI Tool',
                    description: 'Build a command-line tool in Python that performs basic network scanning — port discovery, banner grabbing, and common misconfiguration checks on a target IP. Use Python\'s socket library and Nmap bindings. Add a report generator that outputs findings in JSON and HTML.',
                    difficulty: 'Beginner',
                    stack: ['Python', 'Nmap', 'Socket Library', 'HTML Report']
                },
                {
                    title: 'Web Application Penetration Testing Report',
                    description: 'Set up a deliberately vulnerable app (DVWA or Juice Shop) and perform a structured pen test. Identify and exploit XSS, SQL injection, CSRF, and broken authentication. Document every finding with evidence (screenshots, payloads), severity rating, and remediation steps.',
                    difficulty: 'Intermediate',
                    stack: ['Kali Linux', 'Burp Suite', 'DVWA / Juice Shop', 'Nmap']
                },
                {
                    title: 'SIEM Dashboard & Threat Detection Lab',
                    description: 'Set up a home lab with Elasticsearch + Kibana (ELK Stack) or Splunk Free. Ingest simulated attack logs, write detection rules for brute-force attempts, port scans, and lateral movement. Create a dashboard that surfaces alerts and document your detection logic.',
                    difficulty: 'Advanced',
                    stack: ['ELK Stack / Splunk', 'Python', 'Suricata', 'VirtualBox']
                }
            ],
            devops: [
                { title: 'Dockerized Full-Stack App with CI/CD', description: 'Take any existing web app (or build a simple one) and fully containerize it with Docker. Write a multi-stage Dockerfile, set up Docker Compose for local dev, and create a GitHub Actions pipeline that builds the image and deploys it to a cloud VM on every push to main.', difficulty: 'Beginner', stack: ['Docker', 'GitHub Actions', 'Linux', 'AWS EC2 / DigitalOcean'] },
                { title: 'Kubernetes Cluster on AWS EKS', description: 'Provision an EKS cluster using Terraform. Deploy a sample microservices app (3+ services) with proper namespaces, resource limits, horizontal pod autoscaling, and an Ingress controller. Set up Prometheus + Grafana for monitoring and demonstrate a rolling update with zero downtime.', difficulty: 'Intermediate', stack: ['Terraform', 'AWS EKS', 'Kubernetes', 'Prometheus + Grafana'] },
                { title: 'GitOps Platform with ArgoCD', description: 'Build a complete GitOps setup where all Kubernetes deployments are driven by Git commits. Set up ArgoCD to sync a cluster with a Helm-based app repo, implement environment-specific overlays with Kustomize, and add Slack notifications for deployment events. Document the entire architecture.', difficulty: 'Advanced', stack: ['ArgoCD', 'Helm', 'Kustomize', 'Kubernetes'] }
            ],
            mobile: [
                { title: 'Expense Tracker App', description: 'Build a cross-platform mobile expense tracker with React Native or Flutter. Include category-based expense logging, monthly summaries, and a simple chart showing spending trends. Persist data locally with AsyncStorage or SQLite. Polish the UI and publish on Expo Go for portfolio access.', difficulty: 'Beginner', stack: ['React Native / Flutter', 'AsyncStorage / SQLite', 'Expo', 'Recharts / FL Chart'] },
                { title: 'Real-Time Chat App with Firebase', description: 'Build a group chat app with user authentication (Firebase Auth), real-time messaging (Firestore), and image sharing (Firebase Storage). Implement push notifications with Expo or FCM. Add features like online/offline status indicators and message timestamps to make it feel production-quality.', difficulty: 'Intermediate', stack: ['React Native / Flutter', 'Firebase', 'FCM Push Notifications', 'Expo'] },
                { title: 'Published App on App Store & Play Store', description: 'Build and publish a complete, polished app to both the App Store and Google Play Store. Choose any idea — a productivity tool, habit tracker, or niche utility. Handle app signing, store metadata, screenshots, and the review process. A live published app is the ultimate portfolio piece for mobile developers.', difficulty: 'Advanced', stack: ['React Native / Flutter', 'EAS Build', 'App Store Connect', 'Google Play Console'] }
            ],
            uiux: [
                { title: 'End-to-End Mobile App Redesign', description: 'Pick a popular app with known usability issues (find Reddit threads complaining about it). Conduct a heuristic evaluation, identify the top 5 pain points, then redesign 5–8 key screens in Figma. Write a case study explaining your decisions and what you changed and why.', difficulty: 'Beginner', stack: ['Figma', 'FigJam', 'Maze (usability testing)', 'Notion (case study)'] },
                { title: 'Design System from Scratch', description: 'Design a complete design system for a fictional SaaS product: color palette, typography scale, spacing system, 20+ components (buttons, inputs, cards, modals), and dark/light mode support. Document usage guidelines for each component. This is a highly valued portfolio piece for senior roles.', difficulty: 'Intermediate', stack: ['Figma', 'Auto Layout', 'Variables & Tokens', 'Storybook Docs'] },
                { title: 'User Research-Driven Product Redesign', description: 'Choose a real product to redesign, but base everything on research. Conduct 5 user interviews, create affinity maps, define personas, map the user journey, identify opportunity areas, and design a full prototype. Run a usability test and iterate. Document the entire process as a detailed case study with metrics.', difficulty: 'Advanced', stack: ['Figma', 'Maze / Lookback', 'Miro', 'Notion Portfolio'] }
            ],
            blockchain: [
                { title: 'ERC-20 Token with Faucet dApp', description: 'Write and deploy a custom ERC-20 token on a testnet (Sepolia or Mumbai) using Hardhat and OpenZeppelin. Build a React frontend with Ethers.js that lets users connect their MetaMask wallet and claim tokens from a faucet. Verify the contract on Etherscan and document the deployment.', difficulty: 'Beginner', stack: ['Solidity', 'Hardhat', 'OpenZeppelin', 'Ethers.js'] },
                { title: 'NFT Minting Platform', description: 'Build an ERC-721 NFT minting dApp where users can upload an image to IPFS (via Pinata or NFT.Storage), which is then minted as an NFT on a testnet. Include a gallery page showing all minted NFTs from the contract with metadata fetched from IPFS. Connect MetaMask for wallet interactions.', difficulty: 'Intermediate', stack: ['Solidity', 'IPFS / Pinata', 'React', 'Ethers.js'] },
                { title: 'DeFi Lending Protocol', description: 'Build a simplified DeFi lending protocol where users can deposit ETH as collateral and borrow a stablecoin against it. Implement collateralization ratios, liquidation logic, and interest accrual. Write comprehensive tests covering attack scenarios. Deploy to a testnet and document the economic model.', difficulty: 'Advanced', stack: ['Solidity', 'Hardhat', 'Chainlink Oracles', 'React / Ethers.js'] }
            ],
            qa: [
                { title: 'Automated Test Suite for a Web App', description: 'Pick any open-source web app or use a demo site (like SauceDemo). Write a complete Playwright test suite covering login, core user flows, form validation, and error states. Implement the Page Object Model, set up test reporting with Allure, and document your test coverage strategy.', difficulty: 'Beginner', stack: ['Playwright', 'TypeScript', 'Page Object Model', 'Allure Reports'] },
                { title: 'API Testing Framework with Postman & Newman', description: 'Build a full API test collection in Postman for a public REST API (e.g., GitHub or JSONPlaceholder). Cover all CRUD operations, authentication flows, error cases, and schema validation. Export and run the collection via Newman in a GitHub Actions CI pipeline that reports test results on every PR.', difficulty: 'Intermediate', stack: ['Postman', 'Newman', 'GitHub Actions', 'JavaScript'] },
                { title: 'Performance Testing Report with k6', description: 'Set up a k6 performance test suite for a web application. Write load tests, stress tests, and spike tests. Configure thresholds for p95 response time and error rate. Run tests from CI, generate HTML reports, and write a professional performance report that identifies bottlenecks and proposes fixes.', difficulty: 'Advanced', stack: ['k6', 'GitHub Actions', 'Grafana', 'HTML Reports'] }
            ]
        };

        let key = 'default';
        if (lower.includes('frontend')) key = 'frontend';
        else if (lower.includes('backend') && !lower.includes('full')) key = 'backend';
        else if (lower.includes('full')) key = 'fullstack';
        else if (lower.includes('ai') || lower.includes('ml') || lower.includes('machine')) key = 'ai';
        else if (lower.includes('data') || lower.includes('analyst')) key = 'data';
        else if (lower.includes('security') || lower.includes('cyber')) key = 'security';
        else if (lower.includes('devops') || lower.includes('cloud engineer')) key = 'devops';
        else if (lower.includes('mobile')) key = 'mobile';
        else if (lower.includes('ui') || lower.includes('ux') || lower.includes('designer')) key = 'uiux';
        else if (lower.includes('blockchain') || lower.includes('web3') || lower.includes('solidity')) key = 'blockchain';
        else if (lower.includes('qa') || lower.includes('test engineer') || lower.includes('quality')) key = 'qa';

        if (projectSets[key]) return projectSets[key];

        const projectPrompts = [
            `Build a modern ${roleData.technologies[0]} application with user authentication and a clean dashboard UI.`,
            `Create a portfolio-worthy project using ${roleData.technologies[1] || roleData.technologies[0]} that solves a real-world problem with measurable output.`,
            `Develop and deploy an end-to-end project that highlights ${roleData.focus} — document your process and results thoroughly.`
        ];
        return projectPrompts.map((description, index) => ({
            title: [`${role} Starter App`, `${role} Portfolio Project`, `${role} Capstone Project`][index],
            description,
            difficulty: ['Beginner', 'Intermediate', 'Advanced'][index],
            stack: [roleData.technologies[index] || roleData.technologies[0], roleData.coreSkills[index] || roleData.technologies[0]]
        }));
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    function generateQuestions(role, roleData) {
        const shuffled = shuffleArray([...roleData.questionTemplates]);
        return shuffled.slice(0, 10).map((question, index) => ({
            question,
            answer: composeInterviewAnswer(question, roleData, role),
            category: ['Concepts', 'Practice', 'Strategy', 'Behavior', 'Technical', 'Growth', 'Tools', 'Deployment', 'Security', 'Collaboration'][index] || 'Interview Prep'
        }));
    }



    function composeInterviewAnswer(question, roleData, role) {
        const q = question.toLowerCase();
        const example = `For example, I recently delivered a ${roleData.technologies[0]} solution that ${roleData.focus} by focusing on real user needs and clean execution.`;

        if (q.includes('css grid') && q.includes('flexbox')) {
            return `CSS Grid is best for defining two-dimensional page layouts, while Flexbox is ideal for aligning items along a single row or column. When building polished user experiences, I use Grid for overall section layout and Flexbox for component-level spacing and alignment. ${example}`;
        }

        if (q.includes('optimize a react application')) {
            return `I optimize React applications by reducing re-renders with memoization, using code splitting and lazy loading for large views, and measuring performance with profiling tools. This helps keep interfaces fast and responsive while maintaining polished user experiences. ${example}`;
        }

        if (q.includes('virtual dom')) {
            return `The virtual DOM is a lightweight copy of the browser DOM that React uses to efficiently update only the changed UI elements. By comparing virtual DOM trees, React minimizes direct DOM changes and speeds up rendering for component-driven experiences. ${example}`;
        }

        if (q.includes('restful api') || q.includes('versioning')) {
            return `A RESTful API is designed around resources, using standard HTTP methods and clear URL structure. Versioning is managed through the path, headers, or query parameters so clients can upgrade safely without breaking existing integrations. ${example}`;
        }

        if (q.includes('database normalization')) {
            return `Normalization reduces data redundancy and improves consistency by organizing data into related tables. When performance is critical, I may denormalize specific areas to reduce costly joins, but I always balance that with maintainability and data integrity. ${example}`;
        }

        if (q.includes('middleware')) {
            return `Middleware runs between a request and the final handler, letting you validate input, authenticate users, or log activity. I use middleware to keep backend logic clean and to centralize reusable checks across many routes. ${example}`;
        }

        if (q.includes('authentication') || q.includes('secure user sessions')) {
            return `I secure authentication with hashed credentials, token-based sessions, and strong session controls. I also enforce HTTPS, use secure cookies, and verify tokens on each request to protect user data. ${example}`;
        }

        if (q.includes('manage state') || q.includes('state in a modern web application')) {
            return `I manage state by keeping local UI state in components and using global state libraries or context only when data needs to be shared across many parts of the app. This keeps components predictable and the user experience smooth. ${example}`;
        }

        if (q.includes('supervised') || q.includes('unsupervised')) {
            return `Supervised learning uses labeled examples to teach a model specific outcomes, while unsupervised learning finds patterns without explicit labels. I choose the right approach based on the problem and the available data. ${example}`;
        }

        if (q.includes('overfitting')) {
            return `Overfitting happens when a model learns noise instead of the underlying pattern. I prevent it with techniques like cross-validation, regularization, and by keeping validation data separate from training data. ${example}`;
        }

        if (q.includes('evaluate model') || q.includes('choose metrics')) {
            return `I choose evaluation metrics based on the business goal—accuracy or recall for classification, RMSE for regression, or precision/recall if false positives are costly. I also review model behavior with validation and real data examples. ${example}`;
        }

        if (q.includes('vulnerability assessment')) {
            return `A vulnerability assessment reviews systems, dependencies, and configurations to identify risks before they become incidents. I follow repeatable checklists and use tools to uncover issues so I can improve security proactively. ${example}`;
        }

        if (q.includes('encryption') || q.includes('hashing')) {
            return `Encryption protects data by making it unreadable without a key, while hashing creates a fixed fingerprint that cannot be reversed. I use encryption for data at rest and in transit, and hashing for secure credential storage. ${example}`;
        }

        if (q.includes('security breach')) {
            return `After a breach, I contain the incident, preserve evidence, identify the root cause, and communicate clearly with stakeholders. Then I update defenses so the same vulnerability cannot be exploited again. ${example}`;
        }

        return `I would explain how ${roleData.focus} relates to this question and share a practical example from my experience. ${example}`;
    }

    function generateResumeTips(role, roleData) {
        const lower = role.toLowerCase();

        const tipSets = {
            frontend: [
                {
                    title: 'Lead with Deployed Projects, Not Just Code',
                    description: 'Every project on your resume should have a live URL, not just a GitHub link. Recruiters click live demos — it proves you can ship, not just build. Add Vercel or Netlify deploy links next to each project. If it\'s not deployed, it doesn\'t count as much.'
                },
                {
                    title: 'Quantify Your UI Impact',
                    description: 'Avoid vague statements like "built responsive UI." Instead write: "Reduced page load time by 40% through lazy loading and image optimization" or "Built a component library used across 5 features, cutting UI dev time by 30%." Numbers make your experience tangible and memorable.'
                },
                {
                    title: 'List Technologies Strategically, Not Exhaustively',
                    description: 'Don\'t dump every tool you\'ve touched. Group them clearly: Languages (JavaScript, TypeScript), Frameworks (React, Next.js), Styling (Tailwind CSS, CSS Modules), Tools (Git, Vite, Figma). This format is fast to scan and ATS-friendly.'
                },
                {
                    title: 'Mention Testing to Stand Out',
                    description: '"Wrote unit tests with Jest and integration tests with Cypress covering 80% of core user flows." Testing is increasingly expected of frontend developers, and noting it signals professional-grade habits. Most junior candidates skip this — which is exactly why you shouldn\'t.'
                },
                {
                    title: 'Add a Tailored Professional Summary',
                    description: 'A 2-line summary saves recruiters time: "Frontend Developer with 2 years building React applications — focused on performance, accessibility, and clean UI." Tailor it per job description for maximum ATS and recruiter impact. It\'s the first thing they read and the last thing most candidates write.'
                }
            ],
            backend: [
                {
                    title: 'Describe Systems You Built, Not Just Tasks You Did',
                    description: 'Instead of "worked on API development," write: "Designed and deployed a RESTful API serving 10,000+ daily requests with JWT authentication, rate limiting, and sub-200ms average response time." Show the system — its scale, purpose, and outcomes.'
                },
                {
                    title: 'Highlight Database & Performance Work Explicitly',
                    description: 'Backend roles love seeing: "Optimized PostgreSQL queries using indexing and query planning, reducing response time from 800ms to 90ms." or "Implemented Redis caching for frequently queried endpoints, cutting database load by 60%." These are the metrics hiring managers remember.'
                },
                {
                    title: 'Show DevOps Awareness Even If You\'re Not a DevOps Engineer',
                    description: 'Mention Docker, CI/CD, and cloud deployment in your resume. Even basic experience counts: "Containerized the application using Docker and deployed to Railway via GitHub Actions." It signals that you understand production, not just development.'
                },
                {
                    title: 'Include API Documentation in Your Projects',
                    description: 'Note whether you documented your APIs: "Documented all endpoints using Swagger/OpenAPI 3.0." It signals professionalism and collaboration-readiness. Undocumented APIs are a subtle red flag for senior developers reviewing your portfolio.'
                },
                {
                    title: 'Mention Testing Practices to Separate Yourself',
                    description: '"Wrote 40+ integration tests with Jest and Supertest, covering all critical endpoints with 85% code coverage." Backend developers who test their own code are more trusted, less supervised, and more likely to be offered senior-track positions faster.'
                }
            ],
            fullstack: [
                {
                    title: 'Frame Projects as Complete Products, Not Just Code',
                    description: 'Full-stack resumes shine when projects read like real products: "Built a task management web app with React frontend, Node.js API, and MongoDB — 200+ users, deployed on Vercel + Railway." This shows end-to-end ownership, which is exactly what employers want from a full-stack hire.'
                },
                {
                    title: 'Separate Frontend & Backend Skills Visibly',
                    description: 'Many full-stack candidates list everything in one block — don\'t. Create separate sections or sub-groups: Frontend (React, Next.js, Tailwind) | Backend (Node.js, Express, PostgreSQL) | DevOps (Docker, GitHub Actions). It makes you look organized and intentional.'
                },
                {
                    title: 'Include Auth, State Management & Deployment in Every Project',
                    description: 'The trifecta that makes full-stack projects credible: authentication (JWT/OAuth), real state management (Redux, Zustand, or Context), and cloud deployment. Mention all three when they apply. They signal production-level thinking, not just tutorial reproduction.'
                },
                {
                    title: 'Show Version Control & Collaboration Practices',
                    description: '"Used Git with feature branching, pull request reviews, and semantic commits throughout development." Even on solo projects, this workflow signals team-readiness — something every full-stack interviewer tests for because it\'s so often missing in junior candidates.'
                },
                {
                    title: 'Add a Targeted Two-Line Summary',
                    description: '"Full-stack developer experienced building React + Node.js applications from design to deployment. Focused on clean architecture, test coverage, and fast iteration." Two sentences immediately frames you before a recruiter reads a single bullet — and most candidates don\'t write one at all.'
                }
            ],
            ai: [
                {
                    title: 'Always Include Model Metrics & Dataset Details',
                    description: 'Generic AI resumes say "trained a machine learning model." Standout ones say: "Fine-tuned DistilBERT on 50k product reviews, achieving 91% accuracy and 0.89 F1 score on the test set." Always state the dataset, model type, and measurable performance. This is what differentiates you.'
                },
                {
                    title: 'Document Your Experimentation Process',
                    description: 'List techniques you compared and why you chose one over another: "Evaluated Random Forest, XGBoost, and Logistic Regression — selected XGBoost after hyperparameter tuning for best precision-recall tradeoff." It shows scientific thinking, not just code execution.'
                },
                {
                    title: 'Highlight End-to-End Deployment, Not Just Notebooks',
                    description: 'Anyone can train a model in Jupyter. Show you can deploy: "Served the trained model via FastAPI endpoint, containerized with Docker, and hosted on Hugging Face Spaces." Deployment experience is rare at the junior level and immediately grabs attention.'
                },
                {
                    title: 'Show You Can Explain Models, Not Just Run Them',
                    description: '"Selected XGBoost over Random Forest after cross-validation showed 4% higher F1 — prioritizing recall for the imbalanced fraud dataset." This signals analytical thinking, not just code execution. Data science teams need people who reason about model choices, not just tune hyperparameters.'
                },
                {
                    title: 'Link to Notebooks, Kaggle Profiles, or Published Work',
                    description: '"Published Jupyter walkthrough on Kaggle with 200+ upvotes" is a standout resume line. Even a well-documented GitHub repo with clean notebooks positions you ahead of candidates who only share raw code. Visual, shareable proof of your analytical work is worth more than any bullet point.'
                }
            ],
            data: [
                {
                    title: 'Lead Every Bullet with a Business Outcome',
                    description: 'Data analyst resumes fail when they describe what you did, not what changed. Replace "created monthly sales report" with "built automated monthly sales dashboard that reduced manual reporting time by 8 hours/week and improved executive decision speed." Always answer: so what?'
                },
                {
                    title: 'Name the Tools and Datasets You Actually Worked With',
                    description: 'Specificity builds credibility. Instead of "used data analysis tools," write: "Analyzed 2M+ row retail dataset using Python (Pandas, Matplotlib) and SQL on PostgreSQL — identified a $120K revenue recovery opportunity from abandoned cart patterns." Names, numbers, and context matter.'
                },
                {
                    title: 'Include a Dashboards / Reports Portfolio Link',
                    description: 'Add a link to a Tableau Public profile, Power BI published report, or GitHub repo with analysis notebooks. Visual work is hard to convey in bullet points — let hiring managers see it directly. Even one polished public dashboard positions you ahead of most candidates.'
                },
                {
                    title: 'Describe Stakeholder Communication Explicitly',
                    description: 'Data roles are as communicative as they are technical. Add: "Presented weekly dashboard insights to C-level stakeholders, translating complex metrics into actionable recommendations." This skill is rare — most hiring managers say it\'s the hardest quality to find in data candidates.'
                },
                {
                    title: 'Be Specific About Your SQL Depth',
                    description: 'Don\'t just write "proficient in SQL." Be precise: "Advanced SQL: window functions, CTEs, subqueries, query optimization, stored procedures — experience with PostgreSQL and BigQuery." This specificity wins in ATS keyword scanning and gives interviewers a concrete starting point.'
                }
            ],
            security: [
                {
                    title: 'List Certifications Prominently at the Top',
                    description: 'In cybersecurity, certifications are trusted signals. If you have CompTIA Security+, CEH, or eJPT — put them near the top of your resume, not buried at the bottom. If you\'re pursuing one, note it: "CompTIA Security+ (in progress, exam scheduled Q3 2025)." It shows commitment.'
                },
                {
                    title: 'Describe Threats Found & Actions Taken, Not Just Tools Used',
                    description: 'Instead of "used Burp Suite and Nmap," write: "Conducted penetration test on internal web app, identified 3 critical SQL injection vulnerabilities, and provided remediation guidance that reduced attack surface by 40%." Show the threat, your action, and the result.'
                },
                {
                    title: 'Include CTF Wins, Writeups & Home Lab Work',
                    description: 'Hiring managers in security love candidates who practice outside of work. Add: "Completed 20+ TryHackMe rooms covering privilege escalation, web exploitation, and network forensics" or "Top 15% ranking on HackTheBox." These prove hands-on ability better than coursework alone.'
                },
                {
                    title: 'Mention Frameworks and Compliance Standards You Know',
                    description: 'List specific security frameworks: "Familiar with NIST CSF, ISO 27001 controls, and OWASP Top 10." Enterprise security roles care deeply about framework knowledge — it signals you can think systematically about risk and policy, not just run tools.'
                },
                {
                    title: 'Include a Security Portfolio or Blog Link',
                    description: 'Add a link to your TryHackMe profile, HackTheBox ranking, or personal security writeup blog. Even a single detailed CTF writeup demonstrates research depth, technical communication, and hands-on skill — all things that can\'t be faked or inflated on a resume.'
                }
            ],
            devops: [
                { title: 'Lead with Cloud Certifications & Tools Stack', description: 'DevOps resumes are scanned for specific technologies first. List your cloud platform (AWS/GCP/Azure), orchestration tools (Kubernetes, Docker), and IaC tools (Terraform, Ansible) prominently. If you hold an AWS certification, put it near your name — it\'s a trusted shortcut for hiring managers.' },
                { title: 'Quantify Uptime, Deployment Speed & Cost Savings', description: 'Instead of "managed CI/CD pipelines," write: "Reduced deployment time from 45 minutes to 8 minutes by rebuilding the CI/CD pipeline with GitHub Actions and Docker layer caching, enabling 15+ daily deployments." Impact in numbers is what DevOps hiring managers look for.' },
                { title: 'Show Ownership of Production Systems', description: 'Distinguish yourself by describing production responsibilities: "Maintained 99.97% uptime SLA for a 12-service Kubernetes cluster serving 50K daily active users." If you\'ve been on-call, handled incidents, or built monitoring systems — name them. Real production ownership is rare at the junior level and highly valued.' },
                { title: 'List Scripting & Automation Skills Explicitly', description: '"Bash/Shell scripting for cron automation, Python for infrastructure tooling, and YAML for all pipeline and config-as-code definitions." DevOps engineers are expected to automate everything — demonstrating your scripting fluency is as important as your cloud platform knowledge.' },
                { title: 'Highlight Incident Management & MTTR Improvements', description: 'If you\'ve been on-call or improved reliability: "Reduced mean time to recovery (MTTR) from 45 minutes to 12 minutes by building automated runbook scripts and PagerDuty integration." On-call experience and incident response are highly valued — and almost never mentioned by junior candidates.' }
            ],
            mobile: [
                { title: 'Link to Live Apps or TestFlight Builds', description: 'A live app link is worth more than any resume bullet. Add direct links to App Store or Play Store listings. If your app isn\'t published yet, host a TestFlight or APK link. Even a short Expo Go demo link shows you can ship — which is exactly what mobile employers want to see.' },
                { title: 'Include User Metrics if You Have Them', description: 'If your app has real users, say so: "Published to App Store with 1,200+ downloads and 4.6-star rating (47 reviews)." Even small numbers show real-world validation. If you\'re still in development, mention active beta testers. Numbers at any scale differentiate you from candidates with only academic projects.' },
                { title: 'Highlight Cross-Platform & Platform-Specific Work', description: 'State clearly which platforms you\'ve targeted: "Built and deployed to both iOS (13+) and Android (API 26+) using React Native, with platform-specific navigation components for each OS." Demonstrating you understand platform differences — not just code reuse — signals production readiness to hiring teams.' },
                { title: 'Describe Performance Optimizations with Numbers', description: '"Reduced initial app load time by 35% using lazy loading, image caching, and FlatList virtualization." Mobile performance is a competitive differentiator. Interviewers ask about optimization — having concrete numbers from real projects makes you immediately credible and memorable.' },
                { title: 'Show Mobile Testing & Quality Practices', description: '"Wrote unit tests with Jest (80% coverage) and E2E tests with Detox for critical user flows." Mobile QA is often skipped at the junior level — mentioning it shows professional maturity and signals you build production-quality apps, not just functional demos.' }
            ],
            uiux: [
                { title: 'Your Portfolio is Your Resume — Make It the First Thing They See', description: 'Add your portfolio URL in the header, bold, above your summary. Every UX hiring decision is made by looking at your work, not reading your bullets. If your portfolio link is buried at the bottom, many recruiters won\'t find it. Make it impossible to miss.' },
                { title: 'Write Case Studies That Show Process, Not Just Screens', description: 'Replace "designed onboarding flow" with: "Led end-to-end redesign of onboarding flow — conducted 6 user interviews, identified drop-off at step 3, tested 2 prototypes, and shipped a solution that reduced drop-off by 34%." Show the problem, your process, and a measurable result.' },
                { title: 'Quantify Impact Wherever Possible', description: 'UX candidates who tie design decisions to outcomes stand out: "Redesigned checkout flow based on session recordings and A/B testing — increased conversion rate by 18%." If you don\'t have metrics from work, create them from usability tests: "5/5 test participants completed the task without assistance after redesign."' },
                { title: 'Showcase Developer & PM Collaboration', description: '"Worked closely with 2 frontend developers during handoff — provided annotated Figma specs, held weekly sync sessions, and resolved implementation questions within 24 hours." This shows you ship real products, not just polished Figma files. UX roles are team-sport roles — prove you play well with others.' },
                { title: 'Tailor Your Summary to the Company\'s Design Maturity', description: 'For startups, emphasize speed: "Comfortable owning design end-to-end from research to handoff in fast-moving environments." For enterprises, emphasize systems: "Experienced maintaining and scaling large design systems within cross-functional teams." One sentence tailored to the company dramatically boosts relevance.' }
            ],
            blockchain: [
                { title: 'Link to Deployed Contracts on Etherscan', description: 'Always include Etherscan links to any contracts you\'ve deployed — even on testnets like Sepolia or Goerli. A verified contract address proves you can actually deploy, not just write code locally. It\'s the blockchain equivalent of a live deployed app link, and hiring managers check them.' },
                { title: 'Describe Security Awareness Explicitly', description: 'Security is a top concern in Web3. Write: "Implemented reentrancy guard and access control patterns using OpenZeppelin — contracts passed internal audit with no critical findings." If you\'ve reviewed or written audit reports, mention it. Security-conscious developers are always in demand in this space.' },
                { title: 'Showcase On-Chain Activity & Community Involvement', description: 'Link to your GitHub with Hardhat or Foundry projects. Mention protocol contributions, hackathon wins (ETHGlobal, Devcon), or open-source contributions to DeFi or NFT projects. The Web3 ecosystem is small — community presence and on-chain proof of work carry significant weight in hiring.' },
                { title: 'Quantify Smart Contract Work with Protocol Metrics', description: '"Deployed ERC-20 token contract handling $50K+ in simulated transactions, with full unit test coverage using Hardhat and Chai." Even testnet figures with real traffic show deployability and scale awareness — this is what hiring managers look for in serious Web3 developer candidates.' },
                { title: 'Show Cross-Chain & L2 Awareness', description: '"Deployed contracts to Ethereum mainnet, Polygon, and Arbitrum using Hardhat deploy scripts — achieving 80% gas cost reduction vs mainnet." Cross-chain experience is increasingly valued as the ecosystem matures. It shows you understand the broader landscape, not just one chain\'s tooling.' }
            ],
            qa: [
                { title: 'Lead with Automation Tools & Frameworks', description: 'QA automation resumes are filtered by tool stack first. List Playwright, Selenium, Cypress, or Appium prominently. Add languages: "TypeScript with Playwright" or "Java with Selenium WebDriver." Hiring managers run keyword searches — your tools need to be visible above the fold.' },
                { title: 'Quantify Test Coverage & Defect Metrics', description: 'Instead of "wrote automated tests," write: "Built 200+ end-to-end tests with Playwright covering 85% of critical user flows — reduced production defects by 60% over two sprints." Numbers make your contribution concrete. Even approximate coverage percentages are better than no metrics at all.' },
                { title: 'Highlight CI/CD Integration & Agile Experience', description: 'Modern QA engineers live in the pipeline. Write: "Integrated Playwright suite into GitHub Actions CI — all 200 tests run in under 4 minutes on every PR, blocking merges on failure." Add that you worked in Agile sprints, participated in grooming sessions, and collaborated closely with developers on acceptance criteria.' },
                { title: 'Show Your Bug Advocacy Track Record', description: '"Filed 150+ bugs across 3 sprint cycles — 92% accepted by developers with clear reproduction steps and severity ratings." This shows volume and quality of output in a concrete way that hiring managers can benchmark against other candidates. Strong bug reports are a skill, and most candidates don\'t treat them that way.' },
                { title: 'Highlight Cross-Functional Collaboration', description: '"Collaborated with 4 developers and 2 PMs across daily standups and sprint reviews — wrote and maintained 30+ acceptance criteria tickets for new features." This signals Agile maturity and team effectiveness. QA engineers who communicate well and advocate for quality get promoted faster than those who only run test suites.' }
            ],
            software: [
                { title: 'Lead with Your Most Impactful Engineering Contributions', description: 'Don\'t describe tasks — describe outcomes: "Refactored the payment module, reducing processing time by 45% and eliminating 3 recurring production bugs." Software Engineer roles attract generalist applicants — specific, measurable impact immediately differentiates you from dozens of similar-looking resumes.' },
                { title: 'Show Systems Thinking, Not Just Feature Delivery', description: '"Designed a modular notification service used by 4 downstream teams, handling 200K+ events/day with 99.9% delivery rate." Engineers who think about systems, not just features, are the ones teams compete to hire. Frame your work at the architecture level whenever possible.' },
                { title: 'Demonstrate Technical Range Across the Stack', description: 'Software Engineer roles often expect breadth. Mention versatility: "Worked across the full stack — contributed to React frontend, Node.js services, and PostgreSQL schema design across 3 product teams." Demonstrated range makes you a safer hire for growing teams with varied technical needs.' },
                { title: 'Group Your Skills by Category, Not as a Flat List', description: 'Organize clearly: Languages (Python, JavaScript, Java), Frameworks (React, Express, Spring), Databases (PostgreSQL, Redis), Tools (Docker, Git, Jira). Grouped, labelled skills are faster to scan, far more ATS-friendly, and signal that you think in structured terms — a trait engineers appreciate.' },
                { title: 'Emphasize Code Review, Testing & Team Collaboration', description: '"Conducted peer code reviews for 3 team members and maintained 85% unit test coverage throughout the project." These habits signal professional maturity — and they\'re easy to overlook when writing your resume. Hiring managers know collaborative engineers ship better software with fewer bugs.' }
            ]
        };

        let key = 'default';
        if (lower.includes('frontend')) key = 'frontend';
        else if (lower.includes('backend') && !lower.includes('full')) key = 'backend';
        else if (lower.includes('full')) key = 'fullstack';
        else if (lower.includes('ai') || lower.includes('ml') || lower.includes('machine')) key = 'ai';
        else if (lower.includes('data') || lower.includes('analyst')) key = 'data';
        else if (lower.includes('security') || lower.includes('cyber')) key = 'security';
        else if (lower.includes('devops') || lower.includes('cloud engineer')) key = 'devops';
        else if (lower.includes('mobile')) key = 'mobile';
        else if (lower.includes('ui') || lower.includes('ux') || lower.includes('designer')) key = 'uiux';
        else if (lower.includes('blockchain') || lower.includes('web3') || lower.includes('solidity')) key = 'blockchain';
        else if (lower.includes('qa') || lower.includes('test engineer') || lower.includes('quality')) key = 'qa';
        else if (lower.includes('software')) key = 'software';

        const tips = tipSets[key] || roleData.resumeTips.map((tip, i) => ({
            title: ['Lead with Your Strongest Projects', 'Use Action Verbs & Metrics', 'Keep It ATS-Friendly'][i] || `Resume Tip ${i + 1}`,
            description: tip
        }));

        return tips.map((tip, index) => ({
            title: tip.title,
            description: tip.description
        }));
    }

    function generateSkillGap(role, roleData, userSkills) {
        const provided = userSkills.map((skill) => skill.toLowerCase());
        const coreSkills = roleData.coreSkills;
        const missing = coreSkills.filter((skill) => !provided.includes(skill.toLowerCase()));
        const lower = role.toLowerCase();

        const skillReasons = {
            // Frontend
            'HTML': 'HTML is the skeleton of every webpage. Without solid semantic HTML, your layouts will struggle with accessibility and SEO — both of which recruiters test for.',
            'CSS': 'CSS mastery separates average UIs from polished, professional ones. Recruiters judge design quality immediately — strong CSS skills directly affect your first impression.',
            'JavaScript': 'JavaScript is non-negotiable for any frontend role. It powers interactivity, API calls, and all modern frameworks. No JavaScript depth = no frontend job.',
            'React': 'React is the dominant UI library in the industry. Most frontend job listings require it. Building with React teaches component thinking, which transfers to any framework.',
            'TypeScript': 'TypeScript is now expected in professional codebases. It catches bugs at compile time, improves code readability, and is increasingly required in job descriptions.',
            // Backend
            'Node.js': 'Node.js is the runtime most backend JavaScript roles are built on. Understanding its event loop and async patterns is foundational before learning any framework.',
            'Express': 'Express is the standard starting point for building APIs in Node.js. Knowing it deeply prepares you for more advanced frameworks like Fastify or NestJS.',
            'Databases': 'Every backend application needs persistent data. Without database skills, you can\'t build anything production-ready. It\'s consistently one of the top skills listed in backend job posts.',
            'REST APIs': 'REST is the universal language of web services. Any backend role will involve designing, building, or consuming REST APIs — this is a must-have, not a nice-to-have.',
            'Security': 'Backend developers own security at the server level. Without understanding auth, input validation, and OWASP threats, your APIs are a liability, not an asset.',
            // Full Stack
            'HTML': 'HTML is the foundation of everything that renders in a browser. Full-stack developers are expected to write clean, semantic HTML without relying on a framework to save them.',
            'MongoDB': 'MongoDB\'s flexibility makes it ideal for fast iteration in full-stack apps. It\'s widely used alongside Node.js and understanding its schema design separates strong full-stack devs.',
            // AI/ML
            'Python': 'Python is the primary language of AI/ML. Every major library — TensorFlow, PyTorch, scikit-learn, Pandas — is Python-first. There\'s no shortcut around mastering it.',
            'Machine Learning': 'Understanding core ML concepts (overfitting, cross-validation, bias-variance tradeoff) is what lets you build models that actually generalize — not just ones that work on training data.',
            'Data Analysis': 'Preprocessing and analyzing data is 70–80% of an ML engineer\'s job. If your data isn\'t clean and understood, no model will save it.',
            'TensorFlow': 'TensorFlow is one of the two dominant deep learning frameworks. Knowing it opens the door to production ML deployments and large-scale model training at top companies.',
            'PyTorch': 'PyTorch has become the research-first framework of choice. Most cutting-edge AI papers come with PyTorch code, and it\'s increasingly used in production too.',
            // Data
            'SQL': 'SQL is the single most-used skill in data analytics. It\'s required in nearly every data role — if you can write clean, optimized SQL, you\'re already ahead of most candidates.',
            'Data Visualization': 'Raw data without visualization is invisible. The ability to build clear, compelling charts and dashboards is what turns analysis into decisions that stakeholders actually act on.',
            'Excel': 'Excel is still the universal tool of business. Many stakeholders live in spreadsheets — knowing VLOOKUP, pivot tables, and Power Query makes you instantly useful in any team.',
            'Statistics': 'Statistical thinking is what separates a data analyst from someone who runs reports. Hypothesis testing, confidence intervals, and regression analysis are your analytical core.',
            // Security
            'Networking': 'Cybersecurity attacks travel through networks. Without understanding TCP/IP, DNS, routing, and firewalls, you can\'t understand how attacks work or how to defend against them.',
            'Security Analysis': 'Security analysis is the core skill of a security role — recognizing anomalies, interpreting logs, and understanding what normal vs. malicious behavior looks like in a system.',
            'Incident Response': 'When a breach happens, speed and process matter. IR skills show employers you can contain threats under pressure — a critical capability for any operational security position.',
            'Compliance': 'Security compliance (ISO 27001, SOC 2, GDPR) is increasingly required, especially in enterprise roles. It shows you understand security as a business function, not just a technical one.',
            'Tools': 'Security tools (Wireshark, Burp Suite, Nmap, Splunk) are your hands. Knowing which tool to reach for and why demonstrates practical, job-ready experience over theoretical knowledge.',
            // DevOps
            'Linux': 'Linux is the operating system of the cloud. Every production server, container, and CI runner runs Linux. Without fluency here, you\'ll constantly be blocked in a DevOps role.',
            'Docker': 'Docker is the foundational unit of modern DevOps. Every deployment pipeline, every cloud service, every Kubernetes cluster starts with a container. This is non-negotiable.',
            'Kubernetes': 'Kubernetes is how containers are managed at scale in production. It\'s the most in-demand DevOps skill right now and is required in most senior DevOps / Cloud Engineer job descriptions.',
            'CI/CD': 'CI/CD pipelines are the backbone of modern software delivery. Knowing how to build and maintain them is what makes DevOps engineers valuable — automation is the entire point of the role.',
            'Cloud (AWS/GCP/Azure)': 'Cloud platform skills are the entry ticket to most DevOps roles. AWS is the most widely used — even a foundational understanding of its core services unlocks a huge range of opportunities.',
            // Mobile
            'React Native / Flutter': 'React Native and Flutter are the two dominant cross-platform frameworks. Mastering one means you can target both iOS and Android — doubling your potential user base and employer pool.',
            'JavaScript / Dart': 'Strong language fundamentals underpin everything in mobile development. React Native runs on JavaScript, Flutter uses Dart — deep proficiency in your framework\'s language translates directly to better apps.',
            'Mobile UI': 'Mobile UI design has strict conventions — touch targets, gesture navigation, platform idioms. Ignoring these makes apps feel broken. Following them makes apps feel native and polished.',
            'APIs': 'Almost every real mobile app connects to a backend. Knowing how to securely call REST or GraphQL APIs, handle errors gracefully, and manage loading states is essential for production mobile development.',
            'App Store Deployment': 'Shipping an app to the App Store or Play Store is a skill in itself — certificates, provisioning profiles, store metadata, and review guidelines. Without this, your apps never reach real users.',
            // UI/UX
            'Figma': 'Figma is the industry-standard design tool used by virtually every product team. Not knowing Figma in a UX role is like a developer not knowing how to use an IDE.',
            'User Research': 'Design without research is guesswork. User research skills — interviews, surveys, usability tests — are what separate UX designers from people who just make things look nice.',
            'Wireframing': 'Wireframing is how you communicate structure and logic before committing to visuals. It\'s a core part of the UX workflow and something every hiring manager expects you to do fluently.',
            'Prototyping': 'Interactive prototypes let you test ideas before building them. They\'re essential for stakeholder presentations, usability testing, and developer handoff. They save companies significant time and money.',
            'Usability Testing': 'Usability testing is how you validate that your designs actually work for real people. Without it, you\'re designing in a vacuum. UX hiring managers always ask how you\'ve tested your work.',
            // Blockchain
            'Solidity': 'Solidity is the primary language for writing smart contracts on Ethereum and EVM-compatible chains. Without it, you cannot build on the most widely used blockchain platform.',
            'Web3.js / Ethers.js': 'Ethers.js and Web3.js are how your frontend talks to the blockchain. Without these, your smart contracts are isolated — you can\'t build a dApp that users can actually interact with.',
            'Smart Contracts': 'Smart contracts are the core of everything in Web3 — DeFi, NFTs, DAOs, and more. Deep smart contract knowledge is what the entire blockchain development role is built around.',
            'DeFi Concepts': 'Understanding DeFi protocols (lending, AMMs, staking) is increasingly required even for developer roles — you can\'t build what you don\'t understand economically and architecturally.',
            'Ethereum': 'Ethereum is the foundation of the smart contract ecosystem. Its architecture, gas model, and tooling are what most blockchain developer jobs are built around — even L2 jobs reference it constantly.',
            // QA
            'Manual Testing': 'Manual testing is still essential for exploratory and edge-case discovery that automation misses. Every QA role, even automation-heavy ones, expects strong manual testing fundamentals.',
            'Automation Testing': 'Automation testing is what allows teams to ship fast without breaking things. QA engineers who can write reliable automated test suites are far more valuable than those who can only test manually.',
            'Selenium / Playwright': 'Selenium is the most widely used automation framework in enterprise; Playwright is the fastest-growing modern alternative. Knowing at least one is required for most QA automation roles.',
            'Jest': 'Jest is the dominant unit testing framework in the JavaScript ecosystem. QA engineers who understand unit testing work far more effectively alongside developers and in full-stack CI pipelines.',
            'Bug Reporting': 'A bug report that\'s unclear or unreproducible wastes everyone\'s time. Excellent bug reporting — with steps, environment details, severity, and evidence — is a foundational QA professional skill.'
        };

        return missing.slice(0, 4).map((skill, index) => {
            const ratio = (index + 1) / 4;
            const priority = ratio > 0.66 ? 'High' : ratio > 0.33 ? 'Medium' : 'Low';
            const specificReason = skillReasons[skill];
            const fallbackReason = `${skill} is one of the core technical requirements for ${role} roles. Building proficiency here will directly improve your job applications and give you stronger talking points in interviews.`;
            return {
                skill,
                priority,
                reason: specificReason || fallbackReason,
                progress: 100 - Math.round(ratio * 80)
            };
        });
    }

    function generateYoutubeResources(role, seed) {
        const lower = role.toLowerCase();

        const channelBadgeColor = {
            'freeCodeCamp':      { bg: '#0a0a23', text: '#ffffff',  icon: '🆓' },
            'Fireship':          { bg: '#1a1a2e', text: '#e94560',  icon: '🔥' },
            'Traversy Media':    { bg: '#1b1b2f', text: '#f0a500',  icon: '🚀' },
            'TechWorld w/ Nana': { bg: '#162447', text: '#1f9e89',  icon: '☁️' },
            'NetworkChuck':      { bg: '#16213e', text: '#38bdf8',  icon: '🔐' },
            'Dapp University':   { bg: '#0f3460', text: '#e94560',  icon: '⛓️' },
            'DesignCourse':      { bg: '#1a1a2e', text: '#a855f7',  icon: '🎨' },
            'Alex The Analyst':  { bg: '#162447', text: '#38bdf8',  icon: '📊' },
            'Sentdex':           { bg: '#0a0a23', text: '#34d399',  icon: '🤖' },
            'Patrick Collins':   { bg: '#0f3460', text: '#fbbf24',  icon: '⛓️' },
            'Kevin Powell':      { bg: '#1a1a2e', text: '#818cf8',  icon: '🎨' },
            'Web Dev Simplified':{ bg: '#1b1b2f', text: '#34d399',  icon: '💡' },
            'Academind':         { bg: '#162447', text: '#f0a500',  icon: '📚' },
            'The Net Ninja':     { bg: '#0a0a23', text: '#a855f7',  icon: '🥷' },
            'Hussein Nasser':    { bg: '#16213e', text: '#fb923c',  icon: '⚙️' },
            'Corey Schafer':     { bg: '#0a0a23', text: '#34d399',  icon: '🐍' },
        };

        const all = {
            frontend: [
                { channel: 'freeCodeCamp',    title: 'Responsive Web Design Full Course',           desc: 'HTML, CSS & responsive layouts from scratch — a complete beginner-to-pro course.',                      url: 'https://www.youtube.com/watch?v=zJSY8tbf_ys' },
                { channel: 'Fireship',        title: 'React in 100 Seconds + Full Crash Course',    desc: 'Rapid-fire React concepts plus a full project walkthrough — perfect for quick mastery.',               url: 'https://www.youtube.com/watch?v=Tn6-PIqc4UM' },
                { channel: 'Traversy Media',  title: 'Modern JavaScript From The Beginning',        desc: 'ES6+, DOM manipulation, Fetch API, and async JS — everything a frontend dev needs.',                  url: 'https://www.youtube.com/watch?v=hdI2bqOjy3c' },
                { channel: 'Fireship',        title: 'Next.js in 100 Seconds + Tutorial',           desc: 'Server-side rendering, API routes, and deployment — Next.js fundamentals fast.',                      url: 'https://www.youtube.com/watch?v=Sklc_fQBmcs' },
                { channel: 'Kevin Powell',    title: 'CSS Flexbox and Grid Mastery',                desc: 'Deep-dive into modern CSS layouts — by the internet\'s best CSS teacher.',                            url: 'https://www.youtube.com/watch?v=u044iM9xsWU' },
                { channel: 'Web Dev Simplified', title: 'TypeScript Full Crash Course',            desc: 'Types, interfaces, generics, and real-world TypeScript patterns every frontend dev should know.',      url: 'https://www.youtube.com/watch?v=gp5H0Vw39yw' },
                { channel: 'The Net Ninja',   title: 'React Redux Full Tutorial',                   desc: 'Global state management with Redux Toolkit — covering actions, reducers, and async thunks.',         url: 'https://www.youtube.com/watch?v=iBUJVy8phqw' },
                { channel: 'Traversy Media',  title: 'Tailwind CSS Crash Course',                   desc: 'Utility-first CSS with Tailwind — build fast, beautiful UIs without writing custom CSS.',            url: 'https://www.youtube.com/watch?v=dFgzHOX84xQ' },
            ],
            backend: [
                { channel: 'freeCodeCamp',    title: 'Node.js & Express Full Course',              desc: 'Build REST APIs with Node.js and Express — covers routing, middleware, and databases.',               url: 'https://www.youtube.com/watch?v=Oe421EPjeBE' },
                { channel: 'Traversy Media',  title: 'Express JS Crash Course',                    desc: 'Jump into building APIs quickly with Express — routing, controllers, and error handling.',            url: 'https://www.youtube.com/watch?v=L72fhGm1tfE' },
                { channel: 'Fireship',        title: 'Node.js Ultimate Beginner\'s Guide',         desc: 'Concise but complete intro to Node.js runtime, events, and async patterns.',                         url: 'https://www.youtube.com/watch?v=ENrzD9HAZK4' },
                { channel: 'Traversy Media',  title: 'PostgreSQL & Node.js REST API',              desc: 'Real-world backend project with Postgres, pg library, and RESTful design.',                          url: 'https://www.youtube.com/watch?v=3GfuounRCRk' },
                { channel: 'Hussein Nasser',  title: 'Backend Engineering Fundamentals',           desc: 'Proxies, protocols, databases, and distributed systems — the theory behind every backend.',           url: 'https://www.youtube.com/watch?v=V3ZPPPKEipA' },
                { channel: 'Academind',       title: 'REST API Design Best Practices',             desc: 'Status codes, versioning, pagination, and authentication — build APIs that scale.',                  url: 'https://www.youtube.com/watch?v=0oXYLzuucwE' },
                { channel: 'freeCodeCamp',    title: 'MongoDB Full Tutorial',                      desc: 'Documents, collections, aggregation pipelines, and Mongoose — the complete MongoDB guide.',          url: 'https://www.youtube.com/watch?v=-56x56UppqQ' },
                { channel: 'The Net Ninja',   title: 'JWT Authentication with Node.js',            desc: 'Implement secure token-based auth — register, login, protect routes, and refresh tokens.',           url: 'https://www.youtube.com/watch?v=mbsmsi7l3r4' },
            ],
            fullstack: [
                { channel: 'freeCodeCamp',    title: 'MERN Stack Full Course',                     desc: 'End-to-end project with MongoDB, Express, React, and Node — a genuine full-stack build.',            url: 'https://www.youtube.com/watch?v=7CqJlxBYj-M' },
                { channel: 'Traversy Media',  title: 'MERN Stack Shopping Cart App',               desc: 'Build a real full-stack e-commerce app with auth, cart, and payments.',                              url: 'https://www.youtube.com/watch?v=CDtPMR5y0QU' },
                { channel: 'Fireship',        title: 'Full Stack Web Development in 2024',         desc: 'Opinionated overview of what a modern full-stack developer should know and use.',                    url: 'https://www.youtube.com/watch?v=ysEN5RaKOlA' },
                { channel: 'freeCodeCamp',    title: 'Next.js Full Stack App Tutorial',            desc: 'Build a complete full-stack app with Next.js, Prisma, and database integration.',                    url: 'https://www.youtube.com/watch?v=wm5gMKuwSYk' },
                { channel: 'Academind',       title: 'React + Node.js Full Project Build',        desc: 'Full-stack project from planning to deployment — REST API, React frontend, and MongoDB backend.',    url: 'https://www.youtube.com/watch?v=0oXYLzuucwE' },
                { channel: 'Traversy Media',  title: 'Django & React Full Stack App',             desc: 'Python backend with Django REST Framework paired with a modern React frontend.',                     url: 'https://www.youtube.com/watch?v=JD-age0BPVo' },
                { channel: 'The Net Ninja',   title: 'Full Stack Firebase & React',               desc: 'Real-time full-stack app with Firebase Firestore, Auth, and a React frontend.',                     url: 'https://www.youtube.com/watch?v=jCY6DH8F4oc' },
                { channel: 'Web Dev Simplified', title: 'Build a Full Stack App in 2 Hours',     desc: 'Fast, practical full-stack build — perfect for refreshing your skills or portfolio work.',           url: 'https://www.youtube.com/watch?v=9rEdXsA_dP0' },
            ],
            ai: [
                { channel: 'freeCodeCamp',    title: 'Machine Learning Full Course (Andrew Ng)',   desc: 'The gold-standard ML course — linear regression to neural networks, all explained clearly.',         url: 'https://www.youtube.com/watch?v=NWONeJKn6kc' },
                { channel: 'Sentdex',         title: 'Practical Machine Learning with Python',    desc: 'Hands-on ML projects using scikit-learn, pandas, and real datasets.',                               url: 'https://www.youtube.com/watch?v=OGxgnH8y2NM' },
                { channel: 'freeCodeCamp',    title: 'Deep Learning & Neural Networks Full Course', desc: 'Covers CNNs, RNNs, transformers, and PyTorch — from theory to implementation.',                  url: 'https://www.youtube.com/watch?v=dPWYUELwIdM' },
                { channel: 'Fireship',        title: 'TensorFlow in 100 Seconds',                 desc: 'Concise intro to TensorFlow — great for building intuition before diving into larger projects.',     url: 'https://www.youtube.com/watch?v=i8NETqtGHms' },
                { channel: 'freeCodeCamp',    title: 'NLP with Python — Full Course',             desc: 'Text preprocessing, tokenization, transformers, and BERT — modern NLP from scratch.',               url: 'https://www.youtube.com/watch?v=X2vAabgKiuM' },
                { channel: 'Academind',       title: 'PyTorch Full Tutorial for Beginners',       desc: 'Tensors, autograd, training loops, and building real neural networks with PyTorch.',               url: 'https://www.youtube.com/watch?v=Z_ikDlimN6A' },
                { channel: 'Sentdex',         title: 'Python for Finance & AI',                   desc: 'Real-world data pipelines, feature engineering, and deploying ML models with Python.',             url: 'https://www.youtube.com/watch?v=Z_ikDlimN6A' },
                { channel: 'freeCodeCamp',    title: 'Hugging Face Transformers Full Course',     desc: 'Fine-tune LLMs, build NLP pipelines, and deploy transformer models using Hugging Face.',           url: 'https://www.youtube.com/watch?v=QEaBAZQCtwE' },
            ],
            data: [
                { channel: 'freeCodeCamp',    title: 'Data Analysis with Python — Full Course',   desc: 'pandas, NumPy, Matplotlib, and real-world data cleaning — everything a data analyst needs.',        url: 'https://www.youtube.com/watch?v=r-uOLxNrNk8' },
                { channel: 'Alex The Analyst', title: 'SQL Basics to Advanced for Data Analysts', desc: 'Real SQL practice from beginner queries to window functions and CTEs.',                             url: 'https://www.youtube.com/watch?v=HXV3zeQKqGY' },
                { channel: 'freeCodeCamp',    title: 'Tableau for Beginners Full Course',         desc: 'Build professional dashboards and visualizations that stakeholders actually understand.',            url: 'https://www.youtube.com/watch?v=aHaOIvR00So' },
                { channel: 'Alex The Analyst', title: 'Excel for Data Analysts',                  desc: 'Pivot tables, VLOOKUP, Power Query and the Excel skills every data analyst must know.',            url: 'https://www.youtube.com/watch?v=PSNXoAs2FtQ' },
                { channel: 'freeCodeCamp',    title: 'Power BI Full Course',                      desc: 'DAX, data modelling, and building executive dashboards with Microsoft Power BI.',                  url: 'https://www.youtube.com/watch?v=fnA454MW0MQ' },
                { channel: 'Alex The Analyst', title: 'Python for Data Analysts',                 desc: 'pandas workflows, matplotlib charts, and reproducible analysis scripts.',                          url: 'https://www.youtube.com/watch?v=Ud5QLDOpNfY' },
                { channel: 'freeCodeCamp',    title: 'Statistics for Data Science Full Course',   desc: 'Hypothesis testing, distributions, regression, and A/B testing — the statistical core.',          url: 'https://www.youtube.com/watch?v=xxpc-HPKN28' },
                { channel: 'Academind',       title: 'Data Visualization with Python',            desc: 'Seaborn, Plotly, and Matplotlib — making data tell a story visually.',                            url: 'https://www.youtube.com/watch?v=UO98lJQ3QGI' },
            ],
            security: [
                { channel: 'freeCodeCamp',    title: 'Ethical Hacking Full Course',               desc: '15-hour comprehensive course on penetration testing, recon, exploitation, and reporting.',          url: 'https://www.youtube.com/watch?v=3Kq1MIfTWCE' },
                { channel: 'NetworkChuck',    title: 'Networking Fundamentals for Hackers',       desc: 'TCP/IP, subnetting, VLANs and the network knowledge that cybersecurity pros depend on.',           url: 'https://www.youtube.com/watch?v=qiQR5rTSshw' },
                { channel: 'freeCodeCamp',    title: 'CompTIA Security+ Full Course',             desc: 'Everything needed to pass Security+ and understand foundational cybersecurity concepts.',           url: 'https://www.youtube.com/watch?v=9NE33fpQuw8' },
                { channel: 'NetworkChuck',    title: 'Kali Linux Tutorial for Beginners',         desc: 'Set up Kali, use core tools, and run your first penetration testing workflow.',                    url: 'https://www.youtube.com/watch?v=U1soYsNso8s' },
                { channel: 'freeCodeCamp',    title: 'Wireshark Full Tutorial',                   desc: 'Capture and analyze network traffic — an essential skill for any cybersecurity professional.',     url: 'https://www.youtube.com/watch?v=lb1Dw0elw0Q' },
                { channel: 'NetworkChuck',    title: 'Python for Hackers',                        desc: 'Write automation scripts, scanners, and exploit tools with Python — the hacker\'s language.',     url: 'https://www.youtube.com/watch?v=FD-OfXhJJiY' },
                { channel: 'freeCodeCamp',    title: 'SOC Analyst Training Full Course',          desc: 'SIEM, threat hunting, log analysis and incident response — the complete SOC workflow.',            url: 'https://www.youtube.com/watch?v=Bt5fh3wQUAQ' },
                { channel: 'NetworkChuck',    title: 'Docker for Hackers',                        desc: 'Containers in security contexts — isolating tools, building labs, and practicing safely.',        url: 'https://www.youtube.com/watch?v=wCTTHhehJbU' },
            ],
            devops: [
                { channel: 'freeCodeCamp',       title: 'Docker & Kubernetes Full Course',        desc: 'Containers, orchestration, and production deployments — the core DevOps skill stack.',            url: 'https://www.youtube.com/watch?v=Wf2eSG3owoA' },
                { channel: 'TechWorld w/ Nana',  title: 'DevOps Bootcamp — Complete Series',      desc: 'CI/CD, Terraform, Ansible, Jenkins, Kubernetes — a full modern DevOps curriculum.',              url: 'https://www.youtube.com/watch?v=j5Zsa_eOXeY' },
                { channel: 'freeCodeCamp',       title: 'AWS Full Course for Beginners',           desc: 'EC2, S3, RDS, Lambda, and core AWS services used in real production environments.',             url: 'https://www.youtube.com/watch?v=ubCNZFXmFtQ' },
                { channel: 'Fireship',           title: 'DevOps CI/CD in 100 Seconds',            desc: 'GitHub Actions, pipelines, and continuous deployment concepts distilled super fast.',            url: 'https://www.youtube.com/watch?v=scEDHsr3APg' },
                { channel: 'TechWorld w/ Nana',  title: 'Terraform Full Course for Beginners',    desc: 'Infrastructure as code with Terraform — provision AWS resources declaratively.',                 url: 'https://www.youtube.com/watch?v=l5k1ai_GBDE' },
                { channel: 'freeCodeCamp',       title: 'Linux for DevOps Full Course',           desc: 'Shell scripting, cron jobs, permissions, and the Linux commands every DevOps engineer needs.',  url: 'https://www.youtube.com/watch?v=sWbUDq4S6Y8' },
                { channel: 'TechWorld w/ Nana',  title: 'GitHub Actions Full Tutorial',           desc: 'Build automated CI/CD pipelines with GitHub Actions — from basics to matrix builds.',           url: 'https://www.youtube.com/watch?v=R8_veQiYBjI' },
                { channel: 'freeCodeCamp',       title: 'Prometheus & Grafana Full Course',       desc: 'Monitor production systems with Prometheus metrics and beautiful Grafana dashboards.',          url: 'https://www.youtube.com/watch?v=h4Sl21AKiDg' },
            ],
            mobile: [
                { channel: 'freeCodeCamp',    title: 'React Native Full Course for Beginners',    desc: 'Build cross-platform mobile apps with React Native — covers navigation, state, and APIs.',        url: 'https://www.youtube.com/watch?v=0-S5a0eXPoc' },
                { channel: 'Traversy Media',  title: 'Flutter Crash Course',                      desc: 'Dart basics, Flutter widgets, and building a complete mobile app from scratch.',                 url: 'https://www.youtube.com/watch?v=1gDhl4leEzA' },
                { channel: 'freeCodeCamp',    title: 'Flutter & Dart Full Course',                desc: 'Complete Dart and Flutter deep dive — state management, Firebase, and App Store deployment.',   url: 'https://www.youtube.com/watch?v=VPvVD8t02U8' },
                { channel: 'Fireship',        title: 'React Native in 100 Seconds',               desc: 'Quick mental model of React Native architecture and how it compares to Flutter.',               url: 'https://www.youtube.com/watch?v=gvkqT_Uoahw' },
                { channel: 'Academind',       title: 'React Native & Expo Deep Dive',             desc: 'Expo Router, native APIs, push notifications and real device testing.',                        url: 'https://www.youtube.com/watch?v=qSRrxpdMpVc' },
                { channel: 'freeCodeCamp',    title: 'iOS Development with Swift for Beginners',  desc: 'Build native iOS apps with Swift and UIKit — Apple ecosystem fundamentals.',                   url: 'https://www.youtube.com/watch?v=comQ1-x2a1Q' },
                { channel: 'Traversy Media',  title: 'Firebase with React Native',                desc: 'Add Auth, Firestore, and real-time data to your React Native apps.',                          url: 'https://www.youtube.com/watch?v=UlZ1QnFF4Cw' },
                { channel: 'The Net Ninja',   title: 'Flutter Firebase Full App',                  desc: 'Full mobile app with Flutter frontend + Firebase backend — auth, data, storage.',             url: 'https://www.youtube.com/watch?v=sfA3NWDBPZ4' },
            ],
            uiux: [
                { channel: 'DesignCourse',    title: 'UI / UX Design Full Beginner Course',       desc: 'Principles of good design, Figma workflows, and real UI case studies explained clearly.',       url: 'https://www.youtube.com/watch?v=c9Wg6Cb_YlU' },
                { channel: 'freeCodeCamp',    title: 'Figma UI/UX Design Essentials',             desc: 'Auto-layout, components, prototyping, and handoff — all the Figma skills employers expect.',  url: 'https://www.youtube.com/watch?v=jwCmIBJ8Jtc' },
                { channel: 'DesignCourse',    title: 'UX Research Methods Explained',             desc: 'User interviews, usability tests, affinity mapping — the research toolkit every UX designer needs.', url: 'https://www.youtube.com/watch?v=fF9y8TmjBDM' },
                { channel: 'Traversy Media',  title: 'Web Design for Developers',                 desc: 'Color theory, typography, layout principles — design fundamentals for technically-minded people.', url: 'https://www.youtube.com/watch?v=ykn4XNDwW7Q' },
                { channel: 'DesignCourse',    title: 'Advanced Figma Components & Variables',     desc: 'Master Figma variables, component properties, and design tokens for scalable design systems.', url: 'https://www.youtube.com/watch?v=Dt4Qv3GwRaY' },
                { channel: 'freeCodeCamp',    title: 'Design Thinking Full Course',               desc: 'Empathize, define, ideate, prototype, test — the full design thinking process in practice.',  url: 'https://www.youtube.com/watch?v=gHGN6hs2gZY' },
                { channel: 'Kevin Powell',    title: 'CSS Design Patterns for UI Developers',    desc: 'Advanced CSS techniques that bridge the gap between design and front-end development.',        url: 'https://www.youtube.com/watch?v=u044iM9xsWU' },
                { channel: 'DesignCourse',    title: 'Mobile App UX Design Process',             desc: 'From wireframes to hi-fi prototypes — how professional UX designers approach mobile apps.',  url: 'https://www.youtube.com/watch?v=GVLQ0_zDTMs' },
            ],
            blockchain: [
                { channel: 'freeCodeCamp',    title: 'Solidity & Smart Contracts Full Course',    desc: 'Write, test, and deploy Solidity contracts on Ethereum — covers ERC standards and security.',  url: 'https://www.youtube.com/watch?v=M576WGiDBdQ' },
                { channel: 'Patrick Collins', title: 'Blockchain Developer Full Course (32hr)',   desc: 'The most complete free blockchain course — Hardhat, Foundry, DeFi, and more.',                url: 'https://www.youtube.com/watch?v=gyMwXuJrbJQ' },
                { channel: 'Dapp University', title: 'Build a DeFi App from Scratch',            desc: 'Real-world DeFi project with Solidity, Ethers.js and a React frontend.',                     url: 'https://www.youtube.com/watch?v=CgXQC4dbGUE' },
                { channel: 'Fireship',        title: 'Web3 Explained in 100 Seconds',            desc: 'Blockchain fundamentals, NFTs, and smart contracts distilled into a sharp overview.',         url: 'https://www.youtube.com/watch?v=nHhAEkG1y2U' },
                { channel: 'Patrick Collins', title: 'Foundry Full Course — Modern Solidity',    desc: 'Test and deploy contracts with Foundry — the fastest-growing Solidity development framework.', url: 'https://www.youtube.com/watch?v=umepbfKp5rI' },
                { channel: 'Dapp University', title: 'Build an NFT Marketplace',                 desc: 'List, buy, and sell NFTs in a full-stack DApp with Hardhat and Next.js.',                   url: 'https://www.youtube.com/watch?v=GKJBEEXUha0' },
                { channel: 'freeCodeCamp',    title: 'Web3.py & Ethereum for Python Devs',      desc: 'Interact with the Ethereum blockchain using Python — deploy contracts, read events.',         url: 'https://www.youtube.com/watch?v=M576WGiDBdQ' },
                { channel: 'Patrick Collins', title: 'DeFi Protocol Deep Dive',                  desc: 'Build a lending protocol from scratch — collateral, liquidation, and interest rates.',       url: 'https://www.youtube.com/watch?v=gyMwXuJrbJQ' },
            ],
            qa: [
                { channel: 'freeCodeCamp',    title: 'Software Testing Full Course',              desc: 'Unit, integration, and E2E testing fundamentals — with Jest, Mocha, and best practices.',    url: 'https://www.youtube.com/watch?v=Jv2uxzhPFl4' },
                { channel: 'freeCodeCamp',    title: 'Playwright End-to-End Testing Course',      desc: 'Write reliable E2E tests with Playwright — the modern alternative to Selenium.',             url: 'https://www.youtube.com/watch?v=wCTTHhehJbU' },
                { channel: 'Traversy Media',  title: 'Jest Testing Crash Course',                 desc: 'Unit testing with Jest — setup, matchers, mocks and async tests for JS projects.',          url: 'https://www.youtube.com/watch?v=7r4xVDI2vho' },
                { channel: 'freeCodeCamp',    title: 'Postman API Testing Full Course',           desc: 'Test REST APIs with Postman — collections, environments, automation, and Newman CLI.',       url: 'https://www.youtube.com/watch?v=VywxIQ2ZXw4' },
                { channel: 'Academind',       title: 'Cypress E2E Testing Tutorial',              desc: 'Real browser E2E testing with Cypress — intercept requests, mock responses, run CI.',       url: 'https://www.youtube.com/watch?v=7GrC4NGS_po' },
                { channel: 'freeCodeCamp',    title: 'Selenium WebDriver Full Course',            desc: 'Automate browser testing with Selenium and Python — cross-browser test automation.',        url: 'https://www.youtube.com/watch?v=j7VZsCCnptM' },
                { channel: 'Traversy Media',  title: 'Test Driven Development (TDD) in JS',      desc: 'Write tests first, code second — the TDD workflow that separates great QA engineers.',     url: 'https://www.youtube.com/watch?v=ISAjES_Gklc' },
                { channel: 'freeCodeCamp',    title: 'Performance Testing with k6',              desc: 'Load, stress, and spike testing with k6 — ensure your app handles real traffic.',          url: 'https://www.youtube.com/watch?v=Hu1K2ZGJ_K4' },
            ],
            default: [
                { channel: 'freeCodeCamp',    title: 'Git & GitHub Full Course for Beginners',   desc: 'Version control, branching strategies, PRs and collaboration — essential for any tech role.', url: 'https://www.youtube.com/watch?v=RGOj5yH7evk' },
                { channel: 'Traversy Media',  title: 'Linux Command Line Basics',                desc: 'Navigate and control any system from the terminal — a universal developer skill.',           url: 'https://www.youtube.com/watch?v=IVquJh3DXUA' },
                { channel: 'Fireship',        title: 'CS Concepts Every Developer Should Know',  desc: 'Data structures, algorithms, and system design — the foundations behind every tech interview.', url: 'https://www.youtube.com/watch?v=SzJ46YA_RaA' },
                { channel: 'freeCodeCamp',    title: 'Agile & Scrum Full Course',                desc: 'Sprints, standups, retrospectives, and working in product teams — essential soft skills.',   url: 'https://www.youtube.com/watch?v=502ILHjX9EE' },
                { channel: 'Traversy Media',  title: 'Docker Crash Course',                      desc: 'Containers, images, and volumes — the developer tool every team uses.',                    url: 'https://www.youtube.com/watch?v=31ieHmcTUOk' },
                { channel: 'freeCodeCamp',    title: 'Data Structures & Algorithms Full Course', desc: 'Arrays, trees, graphs, sorting, and dynamic programming — ace any technical interview.',   url: 'https://www.youtube.com/watch?v=8hly31xKli0' },
                { channel: 'Fireship',        title: 'System Design in 25 Minutes',             desc: 'Load balancers, caching, databases, and scaling — how big systems are built.',            url: 'https://www.youtube.com/watch?v=i53Gi_K3o7I' },
                { channel: 'Academind',       title: 'Clean Code — Principles & Practice',      desc: 'Naming, functions, SOLID principles, and refactoring — write code that lasts.',           url: 'https://www.youtube.com/watch?v=MSq_DCRxOxw' },
            ]
        };

        let pool;
        if (lower.includes('frontend'))                                          pool = all.frontend;
        else if (lower.includes('backend') && !lower.includes('full'))          pool = all.backend;
        else if (lower.includes('full') || lower.includes('full stack'))        pool = all.fullstack;
        else if (lower.includes('ai') || lower.includes('ml') || lower.includes('machine')) pool = all.ai;
        else if (lower.includes('data') || lower.includes('analyst'))           pool = all.data;
        else if (lower.includes('security') || lower.includes('cyber'))         pool = all.security;
        else if (lower.includes('devops') || lower.includes('cloud'))           pool = all.devops;
        else if (lower.includes('mobile'))                                       pool = all.mobile;
        else if (lower.includes('ui') || lower.includes('ux') || lower.includes('designer')) pool = all.uiux;
        else if (lower.includes('blockchain') || lower.includes('web3'))        pool = all.blockchain;
        else if (lower.includes('qa') || lower.includes('test engineer'))       pool = all.qa;
        else pool = all.default;

        // Shuffle using seed so every call to refresh gives a different set
        const shuffled = shuffleArray([...pool]);
        return shuffled.slice(0, 4).map(r => ({ ...r, badge: channelBadgeColor[r.channel] || { bg: '#1a1a2e', text: '#a0aec0', icon: '▶️' } }));
    }

    window.refreshYoutubeResources = function () {
        if (!lastResult) { showToast('Generate a career plan first.', 'error'); return; }
        const fresh = generateYoutubeResources(lastResult.role, Date.now());
        lastResult.youtubeResources = fresh;
        saveLastResult();
        const youtubeGrid = document.getElementById('youtubeGrid');
        if (youtubeGrid) {
            youtubeGrid.style.opacity = '0';
            youtubeGrid.style.transition = 'opacity 0.25s';
            setTimeout(() => {
                youtubeGrid.innerHTML = fresh.map(r => `
      <a class="youtube-card glass-card" href="${r.url}" target="_blank" rel="noopener noreferrer">
        <div class="yt-card-header" style="background:${r.badge.bg}">
          <span class="yt-channel-icon">${r.badge.icon}</span>
          <span class="yt-channel-name" style="color:${r.badge.text}">${r.channel}</span>
          <svg class="yt-ext-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${r.badge.text}" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </div>
        <div class="yt-card-body">
          <div class="yt-play-badge"><svg width="12" height="12" viewBox="0 0 24 24" fill="red"><polygon points="5 3 19 12 5 21 5 3"/></svg> Watch Now</div>
          <h4 class="yt-title">${r.title}</h4>
          <p class="yt-desc">${r.desc}</p>
        </div>
      </a>`).join('');
                youtubeGrid.style.opacity = '1';
            }, 250);
        }
        showToast('YouTube resources refreshed!', 'success');
    };

    function renderDashboard(result) {
        // Gradient re-animation: pause → reflow → restart
        const roleEl = DOM.dashboardRole;
        roleEl.classList.add('role-restart');
        void roleEl.offsetWidth;
        roleEl.classList.remove('role-restart');
        roleEl.textContent = result.role;

        DOM.roadmapCount.textContent = `${result.roadmap.length} milestones`;
        DOM.projectsCount.textContent = `${result.projects.length} suggestions`;
        DOM.questionsCount.textContent = `${result.questions.length} questions`;
        DOM.resumeCount.textContent = `${result.resumeTips.length} tips`;
        DOM.skillGapCount.textContent = `${result.skillGap.length} skills to learn`;

        DOM.roadmapTimeline.innerHTML = result.roadmap.map((item) => `
      <div class="roadmap-item">
        <div class="roadmap-dot"></div>
        <div class="roadmap-card">
          <span class="roadmap-phase">${item.phase}</span>
          <h4>${item.title}</h4>
          <p>${item.description}</p>
          <div class="roadmap-skills">${item.skills.map((skill) => `<span class="roadmap-skill-tag">${skill}</span>`).join('')}</div>
        </div>
      </div>
    `).join('');

        DOM.projectsGrid.innerHTML = result.projects.map((project) => `
      <article class="project-card">
        <span class="project-difficulty difficulty-${project.difficulty.toLowerCase()}">${project.difficulty}</span>
        <h4>${project.title}</h4>
        <p>${project.description}</p>
        <div class="project-tech">${project.stack.map((tech) => `<span>${tech}</span>`).join('')}</div>
      </article>
    `).join('');


        showAllQuestions = false;
        renderQuestions(result.questions);

        DOM.resumeTipsList.innerHTML = result.resumeTips.map((tip, index) => `
      <div class="resume-tip">
        <span class="tip-number">${index + 1}</span>
        <div class="tip-content">
          <h4>${tip.title}</h4>
          <p>${tip.description}</p>
        </div>
      </div>
    `).join('');

        DOM.skillGapGrid.innerHTML = result.skillGap.map((item) => `
      <div class="skill-gap-card">
        <div class="skill-name">${item.skill}</div>
        <div class="skill-priority priority-${item.priority.toLowerCase()}">${item.priority} priority</div>
        <div class="skill-bar-track"><div class="skill-bar-fill" style="width:${item.progress}%"></div></div>
        <p class="skill-reason">${item.reason}</p>
      </div>
    `).join('');

        // YouTube Resources
        const youtubeGrid = document.getElementById('youtubeGrid');
        if (youtubeGrid && result.youtubeResources && result.youtubeResources.length) {
            youtubeGrid.innerHTML = result.youtubeResources.map(r => `
      <a class="youtube-card glass-card" href="${r.url}" target="_blank" rel="noopener noreferrer">
        <div class="yt-card-header" style="background:${r.badge.bg}">
          <span class="yt-channel-icon">${r.badge.icon}</span>
          <span class="yt-channel-name" style="color:${r.badge.text}">${r.channel}</span>
          <svg class="yt-ext-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${r.badge.text}" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </div>
        <div class="yt-card-body">
          <div class="yt-play-badge"><svg width="12" height="12" viewBox="0 0 24 24" fill="red"><polygon points="5 3 19 12 5 21 5 3"/></svg> Watch Now</div>
          <h4 class="yt-title">${r.title}</h4>
          <p class="yt-desc">${r.desc}</p>
        </div>
      </a>
    `).join('');
        }

        setupQuestionToggle();
        showAllQuestions = false;
        renderQuestions(result.questions);

        DOM.dashboardSection.style.display = 'block';
        DOM.loadingSection.style.display = 'none';
        window.location.hash = '#dashboard';
        setTimeout(() => {
            DOM.dashboardSection.scrollIntoView({ behavior: 'smooth' });
        }, 50);
    }

    function renderQuestions(questions) {
        const visibleCount = showAllQuestions ? questions.length : QUESTIONS_PREVIEW_COUNT;
        const visibleQuestions = questions.slice(0, visibleCount);

        DOM.questionsList.innerHTML = visibleQuestions.map((item, index) => `
      <div class="question-item">
        <button class="question-header" type="button">
          <span class="question-num">${index + 1}</span>
          <span class="question-text">${item.question}</span>
          <span class="question-toggle">⌄</span>
        </button>
        <div class="question-answer">
          <div class="answer-content">
            <p>${item.answer}</p>
            <span class="question-category">${item.category}</span>
          </div>
        </div>
      </div>
    `).join('');

        if (DOM.viewMoreBtn) {
            if (questions.length > QUESTIONS_PREVIEW_COUNT) {
                DOM.viewMoreBtn.style.display = 'inline-flex';
                DOM.viewMoreBtn.textContent = showAllQuestions ? 'Show fewer questions' : `View more questions (${questions.length - visibleCount})`;
            } else {
                DOM.viewMoreBtn.style.display = 'none';
            }
        }

        setupQuestionToggle();
    }

    function toggleViewMoreQuestions() {
        showAllQuestions = !showAllQuestions;
        if (lastResult) {
            renderQuestions(lastResult.questions);
        }
    }

    function regenerateQuestions() {
        if (!lastResult) {
            showToast('Generate a plan first to regenerate questions.', 'error');
            return;
        }

        const role = lastResult.role;
        const roleData = lastResult.roleData || getRoleData(role);
        lastResult.questions = generateQuestions(role, roleData);
        saveLastResult();
        DOM.questionsCount.textContent = `${lastResult.questions.length} questions`;
        showAllQuestions = false;
        renderQuestions(lastResult.questions);
        showToast('Questions refreshed with new set.', 'success');
    }

    function setupQuestionToggle() {
        const questionHeaders = document.querySelectorAll('.question-header');
        questionHeaders.forEach((header) => {
            header.addEventListener('click', () => {
                const item = header.closest('.question-item');
                item.classList.toggle('open');
            });
        });
    }

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        DOM.toastContainer.appendChild(toast);
        window.setTimeout(() => {
            toast.remove();
        }, 3200);
    }

    function showError(title, message) {
        DOM.errorTitle.textContent = title;
        DOM.errorDesc.textContent = message;
        DOM.errorModal.style.display = 'flex';
    }

    window.closeErrorModal = function () {
        DOM.errorModal.style.display = 'none';
    };

    function loadHistory() {
        try {
            history = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.HISTORY) || '[]');
        } catch (error) {
            history = [];
        }
    }

    function saveHistoryItem(result) {
        const existingIndex = history.findIndex((item) => item.role.toLowerCase() === result.role.toLowerCase());
        const entry = {
            role: result.role,
            result,
            createdAt: new Date().toISOString()
        };

        if (existingIndex >= 0) {
            history.splice(existingIndex, 1);
        }

        history.unshift(entry);
        if (history.length > CONFIG.MAX_HISTORY) {
            history.length = CONFIG.MAX_HISTORY;
        }

        localStorage.setItem(CONFIG.STORAGE_KEYS.HISTORY, JSON.stringify(history));
        renderHistory();
    }

    function loadLastResult() {
        try {
            lastResult = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.LAST_RESULT));
        } catch (error) {
            lastResult = null;
        }
    }

    function saveLastResult() {
        localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_RESULT, JSON.stringify(lastResult));
    }

    function renderHistory() {
        if (!history.length) {
            DOM.historyEmpty.style.display = 'block';
            DOM.clearHistoryBtn.style.display = 'none';
            DOM.historyGrid.querySelectorAll('.history-card').forEach((card) => card.remove());
            return;
        }

        DOM.historyEmpty.style.display = 'none';
        DOM.clearHistoryBtn.style.display = 'inline-flex';
        DOM.historyGrid.innerHTML = history.map((entry, index) => `
      <article class="history-card" data-index="${index}">
        <div class="history-role">${entry.role}</div>
        <div class="history-date">${new Date(entry.createdAt).toLocaleString()}</div>
      </article>
    `).join('');
    }

    function clearHistory() {
        history = [];
        localStorage.removeItem(CONFIG.STORAGE_KEYS.HISTORY);
        renderHistory();
        showToast('Search history cleared.', 'success');
    }

    window.copySection = function (section) {
        let selector;
        switch (section) {
            case 'roadmap': selector = '#roadmapTimeline'; break;
            case 'projects': selector = '#projectsGrid'; break;
            case 'questions': selector = '#questionsList'; break;
            case 'resume': selector = '#resumeTipsList'; break;
            case 'skillgap': selector = '#skillGapGrid'; break;
            default: selector = null;
        }
        if (!selector) return;
        const sectionNode = document.querySelector(selector);
        if (!sectionNode) return;
        const text = sectionNode.innerText.trim();
        navigator.clipboard.writeText(text).then(() => {
            showToast('Section copied to clipboard.', 'success');
        }).catch(() => {
            showToast('Unable to copy content.', 'error');
        });
    };

    window.downloadPDF = function () {
        if (!lastResult) {
            showToast('Generate a plan first to export it.', 'error');
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = function () {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            const margin = 18;
            const contentW = pageW - margin * 2;
            let y = margin;

            function checkPage(needed) {
                if (y + (needed || 10) > pageH - 14) { doc.addPage(); y = margin; }
            }

            function drawHeader() {
                doc.setFillColor(15, 10, 30);
                doc.rect(0, 0, pageW, 28, 'F');
                doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
                doc.text('CareerForge AI', margin, 12);
                doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 200, 240);
                doc.text('AI-Powered Career Guidance', margin, 19);
                doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(180, 210, 255);
                doc.text(lastResult.role, pageW - margin, 14, { align: 'right' });
                doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 140, 180);
                doc.text('Generated: ' + new Date(lastResult.createdAt).toLocaleDateString(), pageW - margin, 20, { align: 'right' });
                y = 36;
            }

            function sectionTitle(title) {
                checkPage(18);
                doc.setFillColor(18, 58, 160);
                doc.roundedRect(margin - 2, y - 5, contentW + 4, 13, 3, 3, 'F');
                doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
                doc.text(title, margin + 2, y + 4);
                y += 14;
            }

            function bodyText(text, indent, color) {
                indent = indent || 0; color = color || [30, 30, 30];
                doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(color[0], color[1], color[2]);
                var lines = doc.splitTextToSize(text, contentW - indent);
                lines.forEach(function(line) { checkPage(7); doc.text(line, margin + indent, y); y += 5.5; });
            }

            function drawTag(text, x, col) {
                col = col || [80, 120, 200];
                var tw = doc.getStringUnitWidth(text) * 7.5 * 0.352 + 8;
                doc.setDrawColor(col[0], col[1], col[2]); doc.setLineWidth(0.3);
                doc.roundedRect(x, y - 4, tw, 6, 1.5, 1.5, 'S');
                doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(col[0], col[1], col[2]);
                doc.text(text, x + tw / 2, y, { align: 'center' });
                return tw;
            }

            function divider() {
                checkPage(6); doc.setDrawColor(210, 215, 225); doc.setLineWidth(0.3);
                doc.line(margin, y, pageW - margin, y); y += 5;
            }

            drawHeader();

            // ROADMAP
            sectionTitle('  Learning Roadmap');
            lastResult.roadmap.forEach(function(item, i) {
                checkPage(24);
                doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(18, 58, 160);
                doc.text(item.phase + ': ' + item.title, margin, y); y += 6;
                bodyText(item.description, 0, [30, 30, 30]);
                var tx = margin;
                item.skills.forEach(function(skill) {
                    var tw = doc.getStringUnitWidth(skill) * 7.5 * 0.352 + 8;
                    if (tx + tw > pageW - margin) { tx = margin; y += 8; }
                    drawTag(skill, tx, [80, 160, 240]); tx += tw + 4;
                });
                y += 9;
                if (i < lastResult.roadmap.length - 1) divider();
            });
            y += 4;

            // PROJECTS
            sectionTitle('  Recommended Projects');
            lastResult.projects.forEach(function(proj, i) {
                checkPage(22);
                var diffColors = { beginner: [16, 185, 129], intermediate: [251, 191, 36], advanced: [239, 68, 68] };
                var dc = diffColors[proj.difficulty.toLowerCase()] || [100, 100, 200];
                var dw = drawTag(proj.difficulty.toUpperCase(), margin, dc);
                doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(18, 58, 160);
                doc.text(proj.title, margin + dw + 5, y); y += 7;
                bodyText(proj.description, 0, [30, 30, 30]);
                doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(18, 58, 160);
                doc.text('Stack: ' + proj.stack.join(' / '), margin, y); y += 8;
                if (i < lastResult.projects.length - 1) divider();
            });
            y += 4;

            // QUESTIONS
            sectionTitle('  Interview Questions');
            lastResult.questions.forEach(function(q, i) {
                checkPage(16);
                doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(18, 58, 160);
                doc.text((i + 1) + '. ' + q.question, margin, y); y += 6;
                bodyText(q.answer, 4, [30, 30, 30]); y += 3;
                if (i < lastResult.questions.length - 1) divider();
            });
            y += 4;

            // RESUME TIPS
            sectionTitle('  Resume Tips');
            lastResult.resumeTips.forEach(function(tip, i) {
                checkPage(16);
                doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(18, 58, 160);
                doc.text((i + 1) + '. ' + tip.title, margin, y); y += 6;
                bodyText(tip.description, 4, [30, 30, 30]); y += 3;
                if (i < lastResult.resumeTips.length - 1) divider();
            });
            y += 4;

            // SKILL GAP
            sectionTitle('  Skill Gap Analysis');
            lastResult.skillGap.forEach(function(item, i) {
                checkPage(16);
                var priColors = { high: [239, 68, 68], medium: [251, 191, 36], low: [16, 185, 129] };
                var pc = priColors[item.priority.toLowerCase()] || [100, 100, 200];
                var pw2 = drawTag(item.priority.toUpperCase(), margin, pc);
                doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(18, 58, 160);
                doc.text(item.skill, margin + pw2 + 5, y); y += 7;
                bodyText(item.reason, 4, [30, 30, 30]); y += 3;
                if (i < lastResult.skillGap.length - 1) divider();
            });

            // Footer
            var totalPages = doc.internal.getNumberOfPages();
            for (var p = 1; p <= totalPages; p++) {
                doc.setPage(p);
                doc.setFillColor(15, 10, 30); doc.rect(0, pageH - 10, pageW, 10, 'F');
                doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 120, 160);
                doc.text('CareerForge AI', margin, pageH - 3.5);
                doc.text('Page ' + p + ' of ' + totalPages, pageW - margin, pageH - 3.5, { align: 'right' });
            }

            doc.save(lastResult.role.replace(/\s+/g, '_').toLowerCase() + '_career_plan.pdf');
            showToast('PDF exported successfully!', 'success');
        };
        script.onerror = function () { showToast('PDF library failed to load. Try again.', 'error'); };
        document.head.appendChild(script);
    };


    window.startNewSearch = function () {
        DOM.dashboardSection.style.display = 'none';
        DOM.roleInput.value = '';
        DOM.skillsInput.value = '';
        skills = [];
        renderSkills();
        DOM.roleInput.focus();
        window.location.hash = '#role-input';
    };

    function serializePlan(result) {
        const lines = [];
        lines.push(`Career Plan for: ${result.role}`);
        lines.push(`Generated: ${new Date(result.createdAt).toLocaleString()}`);
        lines.push('');
        lines.push('Learning Roadmap:');
        result.roadmap.forEach((item) => {
            lines.push(`- ${item.phase}: ${item.title}`);
            lines.push(`  ${item.description}`);
        });
        lines.push('');
        lines.push('Recommended Projects:');
        result.projects.forEach((project) => {
            lines.push(`- ${project.title} (${project.difficulty})`);
            lines.push(`  ${project.description}`);
            lines.push(`  Tech: ${project.stack.join(', ')}`);
        });
        lines.push('');
        lines.push('Interview Questions:');
        result.questions.forEach((question) => {
            lines.push(`- ${question.question}`);
            lines.push(`  Answer prompt: ${question.answer}`);
        });
        lines.push('');
        lines.push('Resume Tips:');
        result.resumeTips.forEach((tip) => {
            lines.push(`- ${tip.title}: ${tip.description}`);
        });
        lines.push('');
        lines.push('Skill Gap Analysis:');
        result.skillGap.forEach((item) => {
            lines.push(`- ${item.skill} (${item.priority})`);
            lines.push(`  ${item.reason}`);
        });
        return lines.join('\n');
    }

    function updateHeroStats() {
        const counters = document.querySelectorAll('[data-count]');
        counters.forEach((counter) => {
            const target = Number(counter.dataset.count) || 0;
            let value = 0;
            const step = Math.ceil(target / 40);
            const interval = setInterval(() => {
                value += step;
                if (value >= target) {
                    counter.textContent = target;
                    clearInterval(interval);
                    return;
                }
                counter.textContent = value;
            }, 30);
        });
    }


    init();
})();
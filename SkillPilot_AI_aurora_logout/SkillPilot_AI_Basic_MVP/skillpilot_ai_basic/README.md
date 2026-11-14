# SkillPilot AI — Basic MVP

A beginner-friendly hackathon starter with:
- HTML, CSS and JavaScript frontend
- Python FastAPI backend
- SQLite database (created automatically)
- Rule-based starter skill-gap analysis and roadmap

> This is a functional MVP foundation. The initial analyzer uses a simple role-to-skill mapping, not an AI model or true multi-agent orchestration yet. Add Gemini / Google ADK in the next development phase.

## 1. Requirements
- Python 3.10 or newer
- VS Code or another code editor
- A modern browser

## 2. Run the backend
Open a terminal in the `backend` folder:

Windows:
```powershell
py -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```

If PowerShell blocks activation, run:
```powershell
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe -m uvicorn main:app --reload
```

Backend address: http://127.0.0.1:8000  
API documentation: http://127.0.0.1:8000/docs

## 3. Run the frontend
Keep the backend terminal running. Open `frontend/index.html` in your browser.
Recommended: use the VS Code Live Server extension and choose **Open with Live Server**.

## 4. Test the demo
- Name: Demo Student
- Career: Full Stack Developer
- Skills: Python, SQL, HTML
- Click **Analyze my skills**

The application should show the skills matched to the selected starter role, missing skills and a learning roadmap. The profile and analysis are saved in `backend/skillpilot.db`.

## 5. Folder structure
```text
SkillPilot-AI/
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── backend/
│   ├── main.py
│   ├── database.py
│   └── requirements.txt
└── README.md
```

## Important demo note
The skill requirements are illustrative starter data. Explain that the next phase will connect verified job-role data, curated learning resources, assessments and coordinated AI agents. Do not present the current rule-based analyzer as a fully autonomous AI system.


## Frontend redesign (v2 UI)
The frontend was redesigned as a commercial-style EdTech SaaS. The backend is unchanged.

- `frontend/index.html` — landing page, login/sign-up and the app shell (dashboard, skill profile, skill gaps, roadmap, assessment, AI mentor, progress).
- `frontend/style.css` — design system (ivory #F8F7F2, forest #174C3C, sage #A8BDA9, orange #F29B50) and responsive layouts.
- `frontend/script.js` — router, demo accounts, charts and all calls to the existing API.
- `frontend/_original/` — the previous frontend, kept for reference.

Notes
- Login/sign-up are a front-end demo: accounts live in the browser (localStorage). The backend has no auth endpoints yet.
- The career readiness score is calculated in the browser: skill coverage 50%, assessment 30%, roadmap progress 20%.
- The AI mentor chat is rule-based and answers from the learner's own analysis data. It is not a live language model.
- Fonts (Bricolage Grotesque, Figtree) load from Google Fonts; the UI falls back to system fonts when offline.

## Aurora 3D redesign
- New files in `frontend/`: `aurora.css` (theme) and `aurora3d.js` (Three.js scenes + effects). `index.html` and `script.js` got small additive edits; backend untouched.
- Three.js r128 loads from `frontend/vendor/three.min.js` if present, else from cdnjs/jsDelivr. For offline use, drop that file in `frontend/vendor/`.
- If Three.js can't load, a CSS-animated orb is shown instead and the app works normally.
- Previous frontend is saved in `frontend/_before_aurora/`.

## Logout feature
- `frontend/logout.css` (new), plus additive edits in `index.html` and `script.js`; backend untouched.
- Sidebar "Log out" and the top-right profile menu (name, email, target career, readiness) both open a confirmation dialog ("Are you sure you want to log out?").
- On confirm: the `sp_session` login session is removed, in-memory learner state, sessionStorage and rendered dashboard content are cleared, a fade-out animation plays, and you land on `#/login` (history replaced, so Back can't reopen the dashboard).
- `#/app/*` routes re-check the stored session on every navigation; logging out in another tab locks this one too.

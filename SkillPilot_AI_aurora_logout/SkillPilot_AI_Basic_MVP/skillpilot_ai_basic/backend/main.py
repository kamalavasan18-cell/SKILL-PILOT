from ai_service import generate_career_analysis

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict

from database import (
    init_db,
    save_profile,
    save_analysis,
    get_progress,
    update_latest_roadmap
)

from agents import (
    orchestrate_learning,
    adaptation_agent,
    ASSESSMENT_QUESTIONS
)


app = FastAPI(
    title="SkillPilot AI - Multi Agent Learning Platform",
    version="2.0.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


CAREER_SKILLS = {
    "Full Stack Developer": [
        "HTML", "CSS", "JavaScript", "React",
        "Node.js", "SQL", "Git"
    ],

    "AI / ML Engineer": [
        "Python", "Mathematics", "Statistics",
        "Machine Learning", "Pandas", "Model Evaluation"
    ],

    "Data Analyst": [
        "SQL", "Python", "Excel", "Statistics",
        "Power BI", "Data Visualization"
    ],

    "Cybersecurity Analyst": [
        "Networking", "Linux", "Python",
        "Security Fundamentals", "Risk Analysis"
    ],

    "UI/UX Designer": [
        "Design Principles", "Figma",
        "Wireframing", "Prototyping", "User Research"
    ]
}


RESOURCE_HINTS = {
    "HTML": "Build a semantic multi-page website and learn forms and accessibility.",
    "CSS": "Practice Flexbox, Grid and responsive design.",
    "JavaScript": "Learn variables, functions, arrays, DOM and asynchronous programming.",
    "React": "Build reusable components and manage application state.",
    "Node.js": "Create REST APIs and understand backend development.",
    "SQL": "Practice SELECT, JOIN, GROUP BY and database relationships.",
    "Git": "Learn commits, branches, merges and GitHub collaboration.",
    "Python": "Practice Python syntax, functions, collections and projects.",
    "Mathematics": "Study algebra, vectors, probability and linear algebra.",
    "Statistics": "Study distributions, averages, variance and correlation.",
    "Machine Learning": "Learn supervised learning and model training.",
    "Pandas": "Clean, transform and analyze datasets.",
    "Model Evaluation": "Practice accuracy, precision, recall and model evaluation.",
    "Excel": "Practice formulas, sorting, filtering and pivot tables.",
    "Power BI": "Build interactive dashboards.",
    "Data Visualization": "Learn charts and communicate data insights.",
    "Networking": "Study IP, DNS, HTTP and network architecture.",
    "Linux": "Practice terminal commands and file permissions.",
    "Security Fundamentals": "Study authentication, encryption and vulnerabilities.",
    "Risk Analysis": "Identify and document security risks.",
    "Design Principles": "Study typography, spacing, hierarchy and contrast.",
    "Figma": "Create clickable interface mockups.",
    "Wireframing": "Sketch application layouts.",
    "Prototyping": "Connect screens into interactive user flows.",
    "User Research": "Conduct interviews and identify user needs."
}


# ==============================
# REQUEST MODELS
# ==============================

class LearnerProfile(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    career_goal: str
    skills: List[str] = Field(default_factory=list)
    experience: str = ""


class AssessmentSubmission(BaseModel):
    learner_id: int
    answers: Dict[int, str]


# ==============================
# STARTUP
# ==============================

@app.on_event("startup")
def startup():
    init_db()


# ==============================
# HOME
# ==============================

@app.get("/")
def home():
    return {
        "message": "SkillPilot AI 2.0 is running!",
        "system": "Multi-Agent Learning Platform",
        "agents": 5
    }


# ==============================
# CAREERS
# ==============================

@app.get("/careers")
def careers():
    return {
        "careers": list(CAREER_SKILLS.keys())
    }


# ==============================
# AI CAREER ANALYSIS
# ==============================

@app.post("/analyze")
def analyze(profile: LearnerProfile):

    if profile.career_goal not in CAREER_SKILLS:
        raise HTTPException(
            status_code=400,
            detail="Please choose a supported career goal."
        )

    # Save learner profile

    learner_id = save_profile(
        profile.name,
        profile.career_goal,
        profile.skills,
        profile.experience
    )

    required = CAREER_SKILLS[profile.career_goal]

    # Multi-agent orchestration

    result = orchestrate_learning(
        profile.career_goal,
        required,
        profile.skills,
        RESOURCE_HINTS
    )

    # Gemini AI Career Analysis

    ai_result = generate_career_analysis(
        profile.name,
        profile.career_goal,
        profile.skills,
        profile.experience,
        required
    )

    if ai_result:

        current = ai_result["current_skills"]
        gaps = ai_result["skill_gaps"]
        roadmap = ai_result["roadmap"]
        mentor = ai_result["mentor_message"]

    else:

        print("Using existing rule-based fallback")

        verification = result["skill_verification"]

        current = verification["claimed_skills"]
        gaps = verification["unlisted_skills"]

        roadmap = result["learning_plan"]["roadmap"]

        if not roadmap:
            roadmap = [{
                "skill": "Portfolio Project",
                "activity": "Build and document a project demonstrating your career skills."
            }]

        mentor = result["mentor"]["advice"]

    # Save analysis for BOTH AI and fallback

    save_analysis(
        learner_id,
        current,
        gaps,
        roadmap
    )

    return {
        "learner_id": learner_id,
        "name": profile.name,
        "career_goal": profile.career_goal,

        "current_skills": current,
        "other_skills": profile.skills,
        "skill_gaps": gaps,

        "roadmap": roadmap,
        "mentor_message": mentor,

        "agent_system": result
    }


# ==============================
# LEARNER PROGRESS
# ==============================

@app.get("/progress/{learner_id}")
def progress(learner_id: int):

    result = get_progress(learner_id)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Learner not found."
        )

    return result


# ==============================
# MULTI AGENT INFORMATION
# ==============================

@app.get("/agents")
def agents():

    return {
        "agents": [
            {
                "name": "Career Intelligence Agent",
                "role": "Identifies career requirements."
            },
            {
                "name": "Skill Verification Agent",
                "role": "Compares declared skills with career requirements."
            },
            {
                "name": "Learning Path Agent",
                "role": "Creates personalized learning roadmaps."
            },
            {
                "name": "AI Mentor Agent",
                "role": "Provides personalized learning guidance."
            },
            {
                "name": "Adaptive Learning Agent",
                "role": "Recommends changes based on assessment performance."
            }
        ]
    }


# ==============================
# ASSESSMENT QUESTIONS
# ==============================

@app.get("/assessment/questions")
def assessment_questions():

    questions = []

    for q in ASSESSMENT_QUESTIONS:

        questions.append({
            "id": q["id"],
            "skill": q["skill"],
            "question": q["question"],
            "options": q["options"]
        })

    return {
        "questions": questions
    }


# ==============================
# SUBMIT ASSESSMENT
# ==============================

@app.post("/assessment/submit")
def submit_assessment(data: AssessmentSubmission):

    learner = get_progress(data.learner_id)

    if learner is None:
        raise HTTPException(
            status_code=404,
            detail="Learner not found."
        )

    if not ASSESSMENT_QUESTIONS:
        raise HTTPException(
            status_code=500,
            detail="No assessment questions available."
        )

    score = 0
    weak_skills = []

    for q in ASSESSMENT_QUESTIONS:

        selected = data.answers.get(q["id"])

        if selected == q["answer"]:
            score += 1

        else:
            weak_skills.append(q["skill"])

    percentage = round(
        (score / len(ASSESSMENT_QUESTIONS)) * 100
    )

    # Adaptive learning agent

    adaptation = adaptation_agent(
        percentage,
        weak_skills
    )

    # Get existing roadmap

    latest_analysis = learner.get("latest_analysis")

    if not latest_analysis:
        raise HTTPException(
            status_code=404,
            detail="No learning roadmap found."
        )

    existing_roadmap = latest_analysis.get("roadmap", [])

    # Prioritize weak skills

    weak_set = {
        skill.lower()
        for skill in weak_skills
    }

    adaptive_roadmap = sorted(
        existing_roadmap,
        key=lambda item: (
            item["skill"].lower() not in weak_set
        )
    )

    # Add targeted practice recommendations

    for item in adaptive_roadmap:

        if item["skill"].lower() in weak_set:

            item["activity"] = (
                "Priority practice: " + item["activity"]
            )

    # Save updated roadmap

    update_latest_roadmap(
        data.learner_id,
        adaptive_roadmap
    )

    return {
        "learner_id": data.learner_id,
        "score": percentage,
        "correct_answers": score,
        "total_questions": len(ASSESSMENT_QUESTIONS),
        "weak_skills": weak_skills,
        "adaptation": adaptation,
        "adaptive_roadmap": adaptive_roadmap
    }
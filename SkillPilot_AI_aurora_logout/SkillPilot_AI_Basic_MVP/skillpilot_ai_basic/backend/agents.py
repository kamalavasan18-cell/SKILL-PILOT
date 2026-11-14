# SkillPilot AI 2.0 - Specialized Agents

CAREER_AGENT = "Career Intelligence Agent"
TRUTH_AGENT = "Skill Verification Agent"
LEARNING_AGENT = "Learning Path Agent"
MENTOR_AGENT = "AI Mentor Agent"
ADAPTATION_AGENT = "Adaptive Learning Agent"


def career_agent(career_goal, required_skills):
    """Identifies the skills required for the selected career."""

    return {
        "agent": CAREER_AGENT,
        "career": career_goal,
        "required_skills": required_skills,
        "message": f"Career profile created for {career_goal}."
    }


def skill_truth_agent(required_skills, declared_skills):
    """Compares declared skills against the career requirements."""

    declared = {s.strip().lower() for s in declared_skills}

    verified = [
        skill for skill in required_skills
        if skill.lower() in declared
    ]

    missing = [
        skill for skill in required_skills
        if skill.lower() not in declared
    ]

    return {
        "agent": TRUTH_AGENT,
        "declared_skills": declared_skills,
        "claimed_skills": verified,
        "unlisted_skills": missing,
        "message": "Declared skills identified. Practical assessment is needed to verify actual proficiency."
    }


def learning_agent(skill_gaps, resource_hints):
    """Creates a learning roadmap based on skill gaps."""

    roadmap = []

    for skill in skill_gaps:
        roadmap.append({
            "skill": skill,
            "activity": resource_hints.get(
                skill,
                f"Study {skill} fundamentals and complete a practical project."
            )
        })

    return {
        "agent": LEARNING_AGENT,
        "roadmap": roadmap
    }


def mentor_agent(skill_gaps):
    """Provides personalized guidance."""

    if len(skill_gaps) >= 5:
        message = (
            "Build your foundation first. Learn one skill at a time "
            "and practise with small projects."
        )
    elif skill_gaps:
        message = (
            "You have a good starting point. Focus on your missing "
            "skills and connect them through a practical project."
        )
    else:
        message = (
            "Your declared skills cover the starter career profile. "
            "Now demonstrate them through projects and assessments."
        )

    return {
        "agent": MENTOR_AGENT,
        "advice": message
    }


def adaptation_agent(score, weak_skills):
    """Adapts the learning plan using assessment performance."""

    if score < 50:
        action = "Foundation Recovery"
        message = "Your learning plan needs more foundational practice."
    elif score < 80:
        action = "Targeted Improvement"
        message = "Focus on the topics where you lost marks."
    else:
        action = "Advanced Learning"
        message = "Good performance! Move towards advanced projects."

    return {
        "agent": ADAPTATION_AGENT,
        "assessment_score": score,
        "weak_skills": weak_skills,
        "recommended_action": action,
        "message": message
    }


def orchestrate_learning(career_goal, required_skills, declared_skills, resource_hints):
    """Coordinates the specialized agents."""

    career = career_agent(career_goal, required_skills)

    verification = skill_truth_agent(
        required_skills,
        declared_skills
    )

    learning = learning_agent(
        verification["unlisted_skills"],
        resource_hints
    )

    mentor = mentor_agent(
        verification["unlisted_skills"]
    )

    return {
        "agents": [
            career,
            verification,
            learning,
            mentor
        ],
        "career_analysis": career,
        "skill_verification": verification,
        "learning_plan": learning,
        "mentor": mentor
    }
ASSESSMENT_QUESTIONS = [
    {
        "id": 1,
        "skill": "HTML",
        "question": "Which HTML tag is used to create a hyperlink?",
        "options": ["<p>", "<a>", "<div>", "<h1>"],
        "answer": "<a>"
    },
    {
        "id": 2,
        "skill": "CSS",
        "question": "Which CSS property changes text color?",
        "options": ["font-size", "background", "color", "margin"],
        "answer": "color"
    },
    {
        "id": 3,
        "skill": "JavaScript",
        "question": "Which keyword declares a block-scoped variable?",
        "options": ["var", "let", "print", "echo"],
        "answer": "let"
    },
    {
        "id": 4,
        "skill": "React",
        "question": "Which React hook is commonly used to manage state?",
        "options": ["useState", "useHTML", "useCSS", "usePage"],
        "answer": "useState"
    },
    {
        "id": 5,
        "skill": "SQL",
        "question": "Which SQL command retrieves records?",
        "options": ["INSERT", "DELETE", "SELECT", "UPDATE"],
        "answer": "SELECT"
    }
]
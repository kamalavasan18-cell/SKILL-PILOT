import os
import json

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

client = genai.Client(api_key=API_KEY) if API_KEY else None


def generate_career_analysis(
    name,
    career_goal,
    skills,
    experience,
    required_skills
):

    if client is None:
        return None

    prompt = f"""
    You are SkillPilot AI, an expert career learning architect.

    Student name: {name}
    Career goal: {career_goal}
    Existing skills: {skills}
    Experience: {experience}

    Expected career skills: {required_skills}

    Analyze this student and generate:

    1. Current skills.
    2. Missing skills.
    3. Personalized learning roadmap.
    4. Personalized mentor advice.

    Return ONLY valid JSON in this format:

    {{
      "current_skills": ["Python"],
      "skill_gaps": ["Statistics"],
      "roadmap": [
        {{
          "skill": "Statistics",
          "activity": "Learn probability and distributions"
        }}
      ],
      "mentor_message": "Your personalized advice"
    }}

    Be realistic, specific and beginner-friendly.
    Do not invent skills the student has not demonstrated.
    """

    try:

        response = client.models.generate_content(
            model=MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.3
            )
        )

        data = json.loads(response.text)

        current = data["current_skills"]
        gaps = data["skill_gaps"]
        roadmap = data["roadmap"]
        mentor = data["mentor_message"]

        if not all(isinstance(x, str) for x in current + gaps):
            return None

        if not isinstance(roadmap, list):
            return None

        if not isinstance(mentor, str):
            return None

        return {
            "current_skills": current,
            "skill_gaps": gaps,
            "roadmap": roadmap,
            "mentor_message": mentor
        }

    except Exception as error:

        print("Gemini AI error:", type(error).__name__)

        return None
import json
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).with_name("skillpilot.db")

def connect():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection

def init_db():
    with connect() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS learners (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                career_goal TEXT NOT NULL,
                skills_json TEXT NOT NULL,
                experience TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                learner_id INTEGER NOT NULL,
                current_skills_json TEXT NOT NULL,
                gaps_json TEXT NOT NULL,
                roadmap_json TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (learner_id) REFERENCES learners(id)
            )
        """)

def save_profile(name, career_goal, skills, experience):
    with connect() as db:
        cursor = db.execute(
            "INSERT INTO learners (name, career_goal, skills_json, experience) VALUES (?, ?, ?, ?)",
            (name, career_goal, json.dumps(skills), experience)
        )
        return cursor.lastrowid

def save_analysis(learner_id, current, gaps, roadmap):
    with connect() as db:
        db.execute(
            "INSERT INTO analyses (learner_id, current_skills_json, gaps_json, roadmap_json) VALUES (?, ?, ?, ?)",
            (learner_id, json.dumps(current), json.dumps(gaps), json.dumps(roadmap))
        )

def get_progress(learner_id):
    with connect() as db:
        learner = db.execute("SELECT * FROM learners WHERE id = ?", (learner_id,)).fetchone()
        if learner is None:
            return None
        analysis = db.execute(
            "SELECT * FROM analyses WHERE learner_id = ? ORDER BY id DESC LIMIT 1",
            (learner_id,)
        ).fetchone()
        return {
            "learner_id": learner["id"],
            "name": learner["name"],
            "career_goal": learner["career_goal"],
            "skills": json.loads(learner["skills_json"]),
            "latest_analysis": None if analysis is None else {
                "current_skills": json.loads(analysis["current_skills_json"]),
                "skill_gaps": json.loads(analysis["gaps_json"]),
                "roadmap": json.loads(analysis["roadmap_json"]),
                "created_at": analysis["created_at"]
            }
        }
def update_latest_roadmap(learner_id, roadmap):
    with connect() as db:
        db.execute(
            """
            UPDATE analyses
            SET roadmap_json = ?
            WHERE id = (
                SELECT id FROM analyses
                WHERE learner_id = ?
                ORDER BY id DESC
                LIMIT 1
            )
            """,
            (json.dumps(roadmap), learner_id)
        )

const form = document.getElementById("profile-form");
const API_BASE = "http://127.0.0.1:8000";

let currentLearnerId = null;
let assessmentQuestions = [];

// =====================================
// 1. PROFILE ANALYSIS
// =====================================

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
        name: document.getElementById("student-name").value.trim(),
        career_goal: document.getElementById("career").value,
        skills: document.getElementById("skills").value
            .split(",")
            .map(s => s.trim())
            .filter(Boolean),
        experience: document.getElementById("experience").value.trim()
    };

    const message = document.getElementById("form-message");
    message.textContent = "Analyzing your profile...";

    try {
        const response = await fetch(`${API_BASE}/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error("Profile analysis failed.");
        }

        const data = await response.json();

        currentLearnerId = data.learner_id;

        showResults(data);

        message.textContent = "Your learning path is ready!";

        document.getElementById("results")
            .scrollIntoView({ behavior: "smooth" });

        // Load assessment automatically
        loadAssessment();

    } catch (error) {
        message.textContent =
            `${error.message} Make sure the backend is running.`;
    }
});


// =====================================
// 2. DISPLAY PROFILE RESULTS
// =====================================

function showResults(data) {

    document.getElementById("stat-career").textContent =
        data.career_goal;

    document.getElementById("stat-skills").textContent =
        data.current_skills.length;

    document.getElementById("stat-gaps").textContent =
        data.skill_gaps.length;

    document.getElementById("stat-tasks").textContent =
        data.roadmap.length;

    document.getElementById("strengths").innerHTML =
        data.current_skills.length
            ? data.current_skills.map(skill =>
                `<span class="chip">${escapeHTML(skill)}</span>`
              ).join("")
            : '<span class="hint">No skills entered yet</span>';

    document.getElementById("gaps").innerHTML =
        data.skill_gaps.length
            ? data.skill_gaps.map(skill =>
                `<span class="chip gap">${escapeHTML(skill)}</span>`
              ).join("")
            : '<span class="chip">Great start!</span>';

    document.getElementById("roadmap-list").innerHTML =
        data.roadmap.map((item, index) => `
            <div class="roadmap-item">
                <span class="step-number">${index + 1}</span>
                <div>
                    <h4>${escapeHTML(item.skill)}</h4>
                    <p>${escapeHTML(item.activity)}</p>
                </div>
            </div>
        `).join("");

    document.getElementById("mentor-title").textContent =
        `A note for ${data.name}`;

    document.getElementById("mentor-message").textContent =
        data.mentor_message;

    document.getElementById("results").classList.remove("hidden");
}


// =====================================
// 3. CREATE ASSESSMENT SECTION
// =====================================

function createAssessmentSection() {

    const oldSection = document.getElementById("skill-assessment");

    if (oldSection) {
        oldSection.remove();
    }

    const section = document.createElement("article");

    section.id = "skill-assessment";
    section.className = "result-card";

    section.innerHTML = `
        <p class="eyebrow">SKILL TRUTH DETECTOR</p>

        <h2>🧠 AI Skill Verification</h2>

        <p class="subheading">
            Test your knowledge and discover your actual skill level.
        </p>

        <div id="assessment-content">
            <p>Preparing your assessment...</p>
        </div>

        <div id="assessment-result"></div>
    `;

    document.getElementById("results").appendChild(section);

    return section;
}


// =====================================
// 4. LOAD ASSESSMENT QUESTIONS
// =====================================

async function loadAssessment() {

    const section = createAssessmentSection();

    const content = document.getElementById("assessment-content");

    try {

        const response = await fetch(
            `${API_BASE}/assessment/questions`
        );

        if (!response.ok) {
            throw new Error("Unable to load assessment.");
        }

        const data = await response.json();

        assessmentQuestions = data.questions;

        if (!assessmentQuestions.length) {
            content.textContent = "No assessment questions available.";
            return;
        }

        renderQuestions();

    } catch (error) {

        content.textContent =
            error.message + " Please check your backend.";
    }
}


// =====================================
// 5. DISPLAY QUESTIONS
// =====================================

function renderQuestions() {

    const content = document.getElementById("assessment-content");

    content.innerHTML = `
        <h3>Answer all questions</h3>

        <p class="hint">
            ${assessmentQuestions.length} questions • Multiple choice
        </p>

        <form id="assessment-form">

            ${assessmentQuestions.map((question, index) => `

                <div class="assessment-question">

                    <h4>
                        ${index + 1}. ${escapeHTML(question.question)}
                    </h4>

                    <p class="hint">
                        Skill: ${escapeHTML(question.skill)}
                    </p>

                    ${question.options.map(option => `

                        <label class="assessment-option"
                            style="display:block; margin:10px 0;">

                            <input
                                type="radio"
                                name="question-${question.id}"
                                value="${escapeHTML(option)}"
                            />

                            ${escapeHTML(option)}

                        </label>

                    `).join("")}

                </div>

            `).join("")}

            <button class="primary-btn" type="submit">
                Submit Assessment →
            </button>

        </form>
    `;

    document.getElementById("assessment-form")
        .addEventListener("submit", submitAssessment);
}


// =====================================
// 6. SUBMIT ASSESSMENT
// =====================================

async function submitAssessment(event) {

    event.preventDefault();

    const answers = {};

    for (const question of assessmentQuestions) {

        const selected = document.querySelector(
            `input[name="question-${question.id}"]:checked`
        );

        if (!selected) {
            alert("Please answer all questions first!");
            return;
        }

        answers[question.id] = selected.value;
    }

    const button = document.querySelector(
        "#assessment-form button"
    );

    button.disabled = true;
    button.textContent = "Evaluating your answers...";

    try {

        const response = await fetch(
            `${API_BASE}/assessment/submit`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    learner_id: currentLearnerId,
                    answers: answers
                })
            }
        );

        if (!response.ok) {
            throw new Error("Assessment submission failed.");
        }

        const result = await response.json();

        showAssessmentResult(result);

    } catch (error) {

        alert(error.message);

        button.disabled = false;
        button.textContent = "Submit Assessment →";
    }
}


// =====================================
// 7. DISPLAY ASSESSMENT RESULTS
// =====================================

function showAssessmentResult(result) {

    const resultBox = document.getElementById("assessment-result");
    // Update dashboard with adaptive roadmap
if (result.adaptive_roadmap) {

    document.getElementById("roadmap-list").innerHTML =
        result.adaptive_roadmap.map((item, index) => `
            <div class="roadmap-item">
                <span class="step-number">${index + 1}</span>
                <div>
                    <h4>${escapeHTML(item.skill)}</h4>
                    <p>${escapeHTML(item.activity)}</p>
                </div>
            </div>
        `).join("");

    document.getElementById("stat-tasks").textContent =
        result.adaptive_roadmap.length;
}

    resultBox.innerHTML = `

        <div class="assessment-summary">

            <p class="eyebrow">ASSESSMENT COMPLETED</p>

            <h2>${result.score}%</h2>

            <h3>
                ${result.correct_answers} /
                ${result.total_questions} Correct Answers
            </h3>

            <p>
                Recommended action:
                <strong>
                    ${escapeHTML(
                        result.adaptation.recommended_action
                    )}
                </strong>
            </p>

            <h3>Skills needing attention</h3>

            <div class="chips">
                ${
                    result.weak_skills.length
                    ? result.weak_skills.map(skill =>
                        `<span class="chip gap">${escapeHTML(skill)}</span>`
                      ).join("")
                    : '<span class="chip">All questions answered correctly!</span>'
                }
            </div>

            <div class="mentor-card">

                <div>
                    <p class="eyebrow">ADAPTIVE LEARNING AGENT</p>

                    <p>
                        ${escapeHTML(result.adaptation.message)}
                    </p>
                </div>

            </div>

        </div>
    `;

    resultBox.scrollIntoView({ behavior: "smooth" });
}


// =====================================
// 8. SECURITY HELPER
// =====================================

function escapeHTML(value) {

    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    }[char]));
}
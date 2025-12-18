const express = require("express");
const {
  getQuestions,
  createAssessment,
  saveAnswer,
  finalizeAssessment,
} = require("../controllers/aiAssessmentController");

const router = express.Router();

// GET /api/ai/questions?persona=manager|c_suite|practitioner
router.get("/questions", getQuestions);

// POST /api/ai/assessment -> create aireadiness row
router.post("/assessment", createAssessment);

// POST /api/ai/assessment/:id/answer -> append questionnaire answers
router.post("/assessment/:id/answer", saveAnswer);

// POST /api/ai/assessment/:id/finalize -> save score/stage/report
router.post("/assessment/:id/finalize", finalizeAssessment);

module.exports = router;


const express = require("express");
const { getQuestions } = require("../controllers/aiAssessmentController");

const router = express.Router();

// GET /api/ai/questions?persona=manager|c_suite|practitioner
router.get("/questions", getQuestions);

module.exports = router;


const express = require("express");
const cors = require("cors");
const http = require("http");
require("dotenv").config();

const contactRoutes = require("./routes/contactRoutes");
const aiAssessmentRoutes = require("./routes/aiAssessmentRoutes");
const { initAIReadinessSocket } = require("./controllers/aiAssessmentController");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/contact", contactRoutes);
app.use("/api/ai", aiAssessmentRoutes);

const PORT = process.env.PORT || 3001;
const server = http.createServer(app);

initAIReadinessSocket(server);

server.listen(PORT, () => {
  console.log(` Server running on http://localhost:${PORT}`);
  console.log(` WebSocket ready at ws://localhost:${PORT}/ws/ai-readiness`);
});

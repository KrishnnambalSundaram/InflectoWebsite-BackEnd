const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
require("dotenv").config();

const contactRoutes = require("./routes/contactRoutes");
const aiAssessmentRoutes = require("./routes/aiAssessmentRoutes");
const blogRoutes = require("./routes/blogRoutes");
const { initAIReadinessSocket } = require("./controllers/aiAssessmentController");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    maxAge: "7d",
  })
);

// Routes
app.use("/api/contact", contactRoutes);
app.use("/api/ai", aiAssessmentRoutes);
app.use("/api/blogs", blogRoutes);

const PORT = process.env.PORT || 3001;
const server = http.createServer(app);

initAIReadinessSocket(server);

server.listen(PORT, () => {
  console.log(` Server running on http://localhost:${PORT}`);
  console.log(` WebSocket ready at ws://localhost:${PORT}/ws/ai-readiness`);
});

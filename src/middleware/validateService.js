const allowedServices = [
  "Products For Real-life problems",
  "Digital Advisory",
  "AI Enablement",
  "App Developemnt and Support",
  "UI/UX Consulting and Revamp",
  "Performance Tuning",
  "Business Automation"
];

const validateService = (req, res, next) => {
  const { service } = req.body;
  if (!allowedServices.includes(service)) {
    return res.status(400).json({ error: "Invalid service value." });
  }
  next();
};

module.exports = validateService;

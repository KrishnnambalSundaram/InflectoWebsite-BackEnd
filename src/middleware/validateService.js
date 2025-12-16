const allowedServices = [
  "Intelligent Experience Engineering",
  "Digital Reinvention",
  "FutureCraft Advisory",
  "AI-First Enterprise Shift",
  "AI Maturity Assessment",
  "DAI Labs",
  "Inflecto ValueSphere"
];

const validateService = (req, res, next) => {
  const { service } = req.body;
  if (!allowedServices.includes(service)) {
    return res.status(400).json({ error: "Invalid service value." });
  }
  next();
};

module.exports = validateService;

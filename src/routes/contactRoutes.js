const express = require("express");
const router = express.Router();
const contactController = require("../controllers/contactController");
const validateService = require("../middleware/validateService");

// POST → Insert a contact record
router.post("/", validateService, contactController.addContact);

// GET → Fetch all contact records
router.get("/", contactController.getAllContacts);

router.delete("/", contactController.deleteAllContacts);


module.exports = router;

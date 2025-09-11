const pool = require("../database");

// Insert a new record
exports.addContact = async (req, res) => {
  try {
    const { name, email, phone_number, service, message } = req.body;

    const result = await pool.query(
      `INSERT INTO contactus (name, email, phone_number, service, message) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, email, phone_number, service, message]
    );

    res.status(201).json({
      message: "Contact record added successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("❌ Error inserting contact:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get all contacts (latest first)
exports.getAllContacts = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM contactus ORDER BY created_at DESC"
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("❌ Error fetching contacts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.deleteAllContacts = async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM contactus"
    );
    res.status(200).json({ message: "All contacts deleted successfully." });
  } catch (error) {
    console.error("❌ Error deleting contacts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

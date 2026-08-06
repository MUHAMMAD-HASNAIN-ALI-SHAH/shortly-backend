const pool = require("../config/database");

const getLimit = async (req, res) => {
    try {
        const user = req.user;

        const plan = await pool.query("SELECT * FROM plans WHERE user_id = $1", [user.id,]);
        if (!plan.rows[0]) {
            return res.status(404).json({ message: "Plan not found" });
        }

        res.status(200).json({
            urls: plan.rows[0].urls,
            qrCodes: plan.rows[0].qr_codes,
            expiresAt: plan.rows[0].expires_at,
        });
    } catch (err) {
        console.error("Error fetching URL code limit:", err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = { getLimit };
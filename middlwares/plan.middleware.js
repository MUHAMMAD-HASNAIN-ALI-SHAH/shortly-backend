const pool = require("../config/database");

const PlanMiddleware = async (req, res, next) => {
    try {
        const getUser = req.user;
        let getPlan = await pool.query("SELECT * FROM plans WHERE user_id = $1", [getUser.id]);
        getPlan = getPlan.rows[0];

        if (!getPlan) {
            const newPlan = await pool.query("INSERT INTO plans (user_id, plan_type, urls, qr_codes, expires_at) VALUES ($1, $2, $3, $4, $5) RETURNING *", [getUser.id, "free", 10, 5, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)]);
            getPlan = newPlan.rows[0];
        }

        if (getPlan.expires_at < new Date()) {
            await pool.query("UPDATE plans SET plan_type = $1, urls = $2, qr_codes = $3, expires_at = $4 WHERE user_id = $5", ["free", 10, 5, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), getUser.id]);
            getPlan.plan_type = "free";
            getPlan.urls = 10;
            getPlan.qr_codes = 5;
            getPlan.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        }

        req.plan = getPlan;
        return next();
    } catch (error) {
        console.error("Plan middleware error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

module.exports = { PlanMiddleware };
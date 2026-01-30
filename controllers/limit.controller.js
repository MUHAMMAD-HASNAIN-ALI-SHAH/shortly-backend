const Plan = require("../models/plan.model");

const getLimit = async (req, res) => {
    try {
        const user = req.user;
        const userId = user._id;
        if (!userId) return res.status(401).json({ msg: "Unauthorized" });

        const plan = await Plan.findOne({ userId });
        if (!plan) {
            return res.status(404).json({ msg: "Plan not found" });
        }

        res.status(200).json({
            urls: plan.urls,
            qrCodes: plan.qrCodes,
            expiresAt: plan.expiresAt,
        });
    } catch (err) {
        console.error("Error fetching URL code limit:", err);
        res.status(500).json({ msg: "Server error" });
    }
};

module.exports = { getLimit };
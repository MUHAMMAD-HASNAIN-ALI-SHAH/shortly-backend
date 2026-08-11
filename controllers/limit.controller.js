const getLimit = async (req, res) => {
    try {
        const plan = req.plan;

        res.status(200).json({
            urls: plan.urls,
            qrCodes: plan.qr_codes,
            expiresAt: plan.expires_at,
        });
    } catch (err) {
        console.error("Error fetching URL code limit:", err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = { getLimit };
const Plan = require("../models/plan.model");
const {
    encodeBase62,
} = require("../config/links");
const ShortUrl = require("../models/short-url.schema");
const User = require("../models/user.model");

const generateShortUrlForLink = async (req, res) => {
    try {
        const { email } = req.user;
        const { originalUrl, title, password } = req.body;

        if (!originalUrl)
            return res.status(400).json({ message: "Original URL is required" });

        const getUser = await User.findOne({ email });
        if (!getUser) return res.status(404).json({ message: "User not found" });

        let getPlan = await Plan.findOne({ userId: getUser._id });
        if (!getPlan) {
            getPlan = await Plan.create({
                userId: getUser._id,
                planType: "free",
                urls: 10,
                qrCodes: 5,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            });
        }

        if (getPlan.expiresAt < new Date()) {
            await Plan.updateOne(
                { userId: getUser._id },
                {
                    planType: "free",
                    urls: 10,
                    qrCodes: 5,
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                }
            );
            getPlan.urls = 10;
        }

        if (getPlan.urls <= 0)
            return res.status(400).json({ message: "Short URL limit reached" });

        const latestItem = await ShortUrl.findOne().sort({ createdAt: -1 });
        let nextIndex = latestItem ? latestItem.index + 1 : 100;

        const shortId = encodeBase62(nextIndex);
        const fullShortUrl = `${process.env.FRONTEND_URL}/s/${shortId}`;

        const newUrl = await ShortUrl.create({
            index: nextIndex,
            userId: getUser._id,
            title: title || "Shortened Link",
            originalUrl,
            shortUrl: fullShortUrl,
            isPasswordProtected: password ? true : false,
            password: password || null,
        });

        await Plan.updateOne({ userId: getUser._id }, { $inc: { urls: -1 } });

        res.status(201).json({ result: newUrl });
    } catch (error) {
        console.error("Short URL error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

const getUserShortUrls = async (req, res) => {
    try {
        const userId = req.user._id;
        const shortUrls = await ShortUrl.find({ userId }).sort({
            createdAt: -1,
        });
        res.status(200).json({ shortUrls });
    } catch (err) {
        console.error("Error fetching short URLs:", err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = { generateShortUrlForLink, getUserShortUrls };

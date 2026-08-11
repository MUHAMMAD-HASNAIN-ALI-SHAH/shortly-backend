const {
    encodeBase62,
    decodeBase62,
} = require("../config/links");
const pool = require("../config/database");
const redis = require("../config/redis");

const generateShortUrlForLink = async (req, res) => {
    try {
        const getUser = req.user;
        const getPlan = req.plan;
        const { originalUrl, title, password } = req.body;

        if (!originalUrl)
            return res.status(400).json({ message: "Original URL is required" });

        if (getPlan.urls <= 0)
            return res.status(400).json({ message: "Short URL limit reached" });

        let latestItem = await pool.query("SELECT index_number FROM short_urls WHERE user_id = $1 ORDER BY index_number DESC LIMIT 1", [getUser.id]);
        let nextIndex = latestItem.rows[0]?.index_number ? Number(latestItem.rows[0].index_number) + 1 : 100;
        nextIndex = Number(nextIndex);

        const shortId = encodeBase62(nextIndex);
        const fullShortUrl = `${process.env.FRONTEND_URL}/s/${shortId}`;

        const newUrl = await pool.query(
            "INSERT INTO short_urls (user_id, title, original_url, short_url, index_number, password, is_password_protected) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
            [getUser.id, title || "Untitled", originalUrl, fullShortUrl, nextIndex, password || null, password ? true : false]
        );

        await pool.query("UPDATE plans SET urls = urls - 1 WHERE user_id = $1", [getUser.id]);

        // 1. Update cached short URLs list directly (prepend new one)
        const urlListKey = `shorturls:${getUser.id}`;
        let cachedList = await redis.get(urlListKey);
        cachedList = typeof cachedList === "string" ? JSON.parse(cachedList) : cachedList;

        if (cachedList) {
            cachedList.unshift(newUrl.rows[0]);
            await redis.set(urlListKey, JSON.stringify(cachedList), { ex: 24 * 60 * 60 });
        }

        // 2. Update cached plan directly (decrement urls)
        const planKey = `plan:${getUser.id}`;
        let cachedPlan = await redis.get(planKey);
        cachedPlan = typeof cachedPlan === "string" ? JSON.parse(cachedPlan) : cachedPlan;

        if (cachedPlan) {
            cachedPlan.urls = cachedPlan.urls - 1;
            await redis.set(planKey, JSON.stringify(cachedPlan), { ex: 24 * 60 * 60 });
        }

        res.status(201).json({ result: newUrl.rows[0] });
    } catch (error) {
        console.error("Short URL error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

const getUserShortUrls = async (req, res) => {
    try {
        const userId = req.user.id;
        const redisKey = `shorturls:${userId}`;

        // 1. Try Redis first
        let shortUrls = await redis.get(redisKey);
        shortUrls = typeof shortUrls === "string" ? JSON.parse(shortUrls) : shortUrls;

        // 2. Cache miss -> fall back to DB
        if (!shortUrls) {
            const dbResult = await pool.query(
                "SELECT * FROM short_urls WHERE user_id = $1 ORDER BY created_at DESC",
                [userId]
            );
            shortUrls = dbResult.rows;

            // 3. Cache it for next time
            await redis.set(redisKey, JSON.stringify(shortUrls), { ex: 24 * 60 * 60 }); // 1 day TTL
        }

        res.status(200).json({ shortUrls });
    } catch (err) {
        console.error("Error fetching short URLs:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const redirect = async (req, res) => {
    try {
        const { index } = req.query;
        if (!index) {
            return res.status(400).json({ message: "Missing link" });
        }

        const decodedIndex = decodeBase62(index);
        if (decodedIndex < 100) {
            return res.status(400).json({ message: "Invalid link" });
        }

        let url = await pool.query("SELECT * FROM short_urls WHERE index_number = $1", [decodedIndex]);
        url = url.rows[0];
        if (!url) {
            return res.status(404).json({ message: "URL not found" });
        }

        if (url.is_password_protected) {
            return res.status(200).json({
                isPasswordProtected: true,
            });
        }

        url.clicks += 1;
        await pool.query("UPDATE short_urls SET clicks = $1 WHERE index_number = $2", [url.clicks, decodedIndex]);

        // If this user's short URL list is cached, update the click count in-place
        const urlListKey = `shorturls:${url.user_id}`;
        let cachedList = await redis.get(urlListKey);
        cachedList = typeof cachedList === "string" ? JSON.parse(cachedList) : cachedList;

        if (cachedList) {
            const itemIndex = cachedList.findIndex((item) => Number(item.index_number) === decodedIndex);
            if (itemIndex !== -1) {
                cachedList[itemIndex].clicks = url.clicks;
                await redis.set(urlListKey, JSON.stringify(cachedList), { ex: 24 * 60 * 60 });
            }
        }

        return res.status(200).json({
            isPasswordProtected: false,
            originalUrl: url.original_url,
        });
    } catch (err) {
        console.error("Redirect error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const verifyPassword = async (req, res) => {
    try {
        const { index, password } = req.body;
        if (!index || !password) {
            return res.status(400).json({ message: "Missing data" });
        }

        const decodedIndex = decodeBase62(index);
        let url = await pool.query("SELECT * FROM short_urls WHERE index_number = $1", [decodedIndex]);
        url = url.rows[0];

        if (!url) {
            return res.status(404).json({ message: "URL not found" });
        }

        if (!url.is_password_protected) {
            return res.status(400).json({ message: "Link is not password protected" });
        }

        if (url.password !== password) {
            return res.status(401).json({ message: "Incorrect password" });
        }

        url.clicks += 1;
        await pool.query("UPDATE short_urls SET clicks = $1 WHERE index_number = $2", [url.clicks, decodedIndex]);

        // If this user's short URL list is cached, update the click count in-place
        const urlListKey = `shorturls:${url.user_id}`;
        let cachedList = await redis.get(urlListKey);
        cachedList = typeof cachedList === "string" ? JSON.parse(cachedList) : cachedList;

        if (cachedList) {
            const itemIndex = cachedList.findIndex((item) => Number(item.index_number) === decodedIndex);
            if (itemIndex !== -1) {
                cachedList[itemIndex].clicks = url.clicks;
                await redis.set(urlListKey, JSON.stringify(cachedList), { ex: 24 * 60 * 60 });
            }
        }

        return res.status(200).json({
            originalUrl: url.original_url,
        });
    } catch (err) {
        console.error("Verify password error:", err);
        res.status(500).json({ message: "Server error" });
    }
};


module.exports = { generateShortUrlForLink, getUserShortUrls, redirect, verifyPassword };

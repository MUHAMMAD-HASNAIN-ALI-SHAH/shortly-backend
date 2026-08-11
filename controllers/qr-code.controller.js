const {
  generateQrCode,
} = require("../config/links");
const cloudinary = require("../config/cloudinary");
const pool = require("../config/database");
const redis = require("../config/redis");

// ---------- QR Code Generator ----------
const generateQrCodeForLink = async (req, res) => {
  try {
    const getUser = req.user;
    const getPlan = req.plan;
    const { originalUrl, title } = req.body;

    if (!originalUrl)
      return res.status(400).json({ message: "Original URL is required" });

    if (getPlan.qrCodes <= 0)
      return res.status(400).json({ message: "QR code limit reached" });

    const qrCodeDataURL = await generateQrCode(originalUrl);
    const uploadResult = await cloudinary.uploader.upload(qrCodeDataURL, {
      folder: "shortly/qr-codes",
    });

    const newUrl = await pool.query(
      "INSERT INTO qr_codes (user_id, title, original_url, qr_code_link) VALUES ($1, $2, $3, $4) RETURNING *",
      [getUser.id, title || "Untitled", originalUrl, uploadResult.secure_url]
    );

    await pool.query("UPDATE plans SET qr_codes = qr_codes - 1 WHERE user_id = $1", [getUser.id]);

    // 1. Update cached QR codes list directly (prepend new one)
    const qrListKey = `qrcodes:${getUser.id}`;
    let cachedList = await redis.get(qrListKey);
    cachedList = typeof cachedList === "string" ? JSON.parse(cachedList) : cachedList;

    if (cachedList) {
      cachedList.unshift(newUrl.rows[0]);
      await redis.set(qrListKey, JSON.stringify(cachedList), { ex: 24 * 60 * 60 });
    }

    // 2. Update cached plan directly (decrement qr_codes)
    const planKey = `plan:${getUser.id}`;
    let cachedPlan = await redis.get(planKey);
    cachedPlan = typeof cachedPlan === "string" ? JSON.parse(cachedPlan) : cachedPlan;

    if (cachedPlan) {
      cachedPlan.qr_codes = cachedPlan.qr_codes - 1;
      await redis.set(planKey, JSON.stringify(cachedPlan), { ex: 24 * 60 * 60 });
    }

    res.status(201).json({ result: newUrl.rows[0] });
  } catch (error) {
    console.error("QR error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ---------- Get My QR Codes ----------
const getMyQrCodes = async (req, res) => {
  try {
    const getUser = req.user;
    const redisKey = `qrcodes:${getUser.id}`;

    // 1. Try Redis first
    let qrCodes = await redis.get(redisKey);
    qrCodes = typeof qrCodes === "string" ? JSON.parse(qrCodes) : qrCodes;

    // 2. Cache miss -> fall back to DB
    if (!qrCodes) {
      const dbResult = await pool.query(
        "SELECT * FROM qr_codes WHERE user_id = $1 ORDER BY created_at DESC",
        [getUser.id]
      );
      qrCodes = dbResult.rows;

      // 3. Cache it for next time
      await redis.set(redisKey, JSON.stringify(qrCodes), { ex: 24 * 60 * 60 }); // 1 day TTL
    }

    res.status(200).json({ qrCodes });
  } catch (error) {
    console.error("Error fetching QR codes:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = { generateQrCodeForLink, getMyQrCodes };

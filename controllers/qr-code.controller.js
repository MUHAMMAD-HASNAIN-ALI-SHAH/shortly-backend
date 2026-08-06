const {
  generateQrCode,
} = require("../config/links");
const cloudinary = require("../config/cloudinary");
const pool = require("../config/database");

// ---------- QR Code Generator ----------
const generateQrCodeForLink = async (req, res) => {
  try {
    const getUser = req.user;
    const getPlan = req.plan
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
    const qrCodes = await pool.query("SELECT * FROM qr_codes WHERE user_id = $1 ORDER BY created_at DESC", [getUser.id]);
    res.status(200).json({ qrCodes: qrCodes.rows });
  }
  catch (error) {
    console.error("Error fetching QR codes:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = { generateQrCodeForLink, getMyQrCodes };

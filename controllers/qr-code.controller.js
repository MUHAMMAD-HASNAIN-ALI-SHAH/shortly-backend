const Plan = require("../models/plan.model");
const {
  generateQrCode,
} = require("../config/links");
const Url = require("../models/url.schema");
const cloudinary = require("../config/cloudinary");
const QrCode = require("../models/qr-code.schema");

// ---------- QR Code Generator ----------
const generateQrCodeForLink = async (req, res) => {
  try {
    const getUser = req.user;
    const { originalUrl, title } = req.body;

    if (!originalUrl)
      return res.status(400).json({ message: "Original URL is required" });

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
      getPlan.qrCodes = 5;
    }

    if (getPlan.qrCodes <= 0)
      return res.status(400).json({ message: "QR code limit reached" });

    const latestItem = await QrCode.findOne().sort({ createdAt: -1 });

    let nextIndex;

    if (!latestItem) {
      nextIndex = 100;
    } else {
      nextIndex = latestItem.index + 1;
    }

    const qrCodeDataURL = await generateQrCode(originalUrl);
    const uploadResult = await cloudinary.uploader.upload(qrCodeDataURL, {
      folder: "shortly/qr-codes",
    });

    const newUrl = await QrCode.create({
      title,
      originalUrl,
      qrCodeLink: uploadResult.secure_url,
      userId: getUser._id,
    });

    await Plan.updateOne({ userId: getUser._id }, { $inc: { qrCodes: -1 } });

    res.status(201).json({ result: newUrl });
  } catch (error) {
    console.error("QR error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ---------- Get My QR Codes ----------
const getMyQrCodes = async (req, res) => {
  try {
    const getUser = req.user;
    const qrCodes = await QrCode.find({ userId: getUser._id }).sort({
      createdAt: -1,
    });
    res.status(200).json({ qrCodes });
  }
  catch (error) {
    console.error("Error fetching QR codes:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = { generateQrCodeForLink, getMyQrCodes };

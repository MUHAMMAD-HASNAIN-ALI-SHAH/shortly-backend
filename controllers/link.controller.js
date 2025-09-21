const Plan = require("../models/plan.model");
const {
  generateQrCode,
  encodeBase62,
  decodeBase62,
} = require("../config/links");
const Url = require("../models/url.schema");
const cloudinary = require("../config/cloudinary");
const User = require("../models/user.model");

// 🧠 Helper function to get userId from session
const getUserIdFromSession = async (session) => {
  if (!session?.user?.email) return null;
  const user = await User.findOne({ email: session.user.email });
  return user?._id;
};

// ---------- QR Code Generator ----------
const generateQrCodeForLink = async (req, res) => {
  try {
    const { email } = req.session.user;
    const { originalUrl, title } = req.body;

    if (!originalUrl)
      return res.status(400).json({ msg: "Original URL is required" });

    const getUser = await User.findOne({ email });
    if (!getUser) return res.status(404).json({ msg: "User not found" });

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
      return res.status(400).json({ msg: "QR code limit reached" });

    const latestItem = await Url.findOne().sort({ createdAt: -1 }); // ✅ safer than sorting by _id

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

    const newUrl = await Url.create({
      index: nextIndex,
      userId: getUser._id,
      type: "qr-code",
      title: title || "QR Code Link",
      originalUrl,
      qrCodeLink: uploadResult.secure_url,
    });

    await Plan.updateOne({ userId: getUser._id }, { $inc: { qrCodes: -1 } });

    res.status(201).json({ result: newUrl });
  } catch (error) {
    console.error("QR error:", error);
    res.status(500).json({ msg: "Internal Server Error" });
  }
};

// ---------- Short URL Generator ----------
const generateShortUrlForLink = async (req, res) => {
  try {
    const { email } = req.session.user;
    const { originalUrl, title, password } = req.body;

    if (!originalUrl)
      return res.status(400).json({ msg: "Original URL is required" });

    const getUser = await User.findOne({ email });
    if (!getUser) return res.status(404).json({ msg: "User not found" });

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
      return res.status(400).json({ msg: "Short URL limit reached" });

    const latestItem = await Url.findOne().sort({ createdAt: -1 });
    let nextIndex = latestItem ? latestItem.index + 1 : 100;

    const shortId = encodeBase62(nextIndex);
    const fullShortUrl = `${process.env.FRONTEND_URL}/s/${shortId}`;

    const newUrl = await Url.create({
      index: nextIndex,
      userId: getUser._id,
      type: "short-url",
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
    res.status(500).json({ msg: "Internal Server Error" });
  }
};

// ✏️ Edit URL/QR title (requires owner check)
const editUrlTitle = async (req, res) => {
  try {
    const userId = await getUserIdFromSession(req.session);
    if (!userId) return res.status(401).json({ msg: "Unauthorized" });

    const { id } = req.params; // URL document _id
    const { title } = req.body;

    const url = await Url.findById(id);
    if (!url) return res.status(404).json({ msg: "Not found" });

    if (!url.userId.equals(userId)) {
      return res.status(403).json({ msg: "You do not have permission" });
    }

    url.title = title;
    await url.save();
    res.status(200).json({ msg: "Title updated", url });
  } catch (err) {
    console.error("Error editing title:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// 🔗 Get all short URLs of the user
const getUserShortUrls = async (req, res) => {
  try {
    const userId = await getUserIdFromSession(req.session);
    if (!userId) return res.status(401).json({ msg: "Unauthorized" });

    const shortUrls = await Url.find({ userId, type: "short-url" }).sort({
      createdAt: -1,
    });
    res.status(200).json({ urls: shortUrls });
  } catch (err) {
    console.error("Error fetching short URLs:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// 🔳 Get all QR codes of the user
const getUserQRCodes = async (req, res) => {
  try {
    const userId = await getUserIdFromSession(req.session);
    if (!userId) return res.status(401).json({ msg: "Unauthorized" });

    const qrCodes = await Url.find({ userId, type: "qr-code" }).sort({
      createdAt: -1,
    });
    res.status(200).json({ qrs: qrCodes });
  } catch (err) {
    console.error("Error fetching QR codes:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// 🔳 DELETE: /api/url/:id
const deleteUrlOrQr = async (req, res) => {
  try {
    const urlId = req.params.id;

    if (!req.session?.user?.email) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Get user from session
    const user = await User.findOne({ email: req.session.user.email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find the URL/QR code and ensure it belongs to the user
    const existingUrl = await Url.findById(urlId);
    if (!existingUrl) {
      return res.status(404).json({ message: "URL or QR Code not found" });
    }

    if (!existingUrl.userId.equals(user._id)) {
      return res.status(403).json({ message: "Forbidden: Not your item" });
    }

    // Delete the entry
    await Url.findByIdAndDelete(urlId);
    res.status(200).json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// 📦 Get all links (QR + short URLs) for the user
const getUserLinks = async (req, res) => {
  try {
    const userId = await getUserIdFromSession(req.session);
    if (!userId) return res.status(401).json({ msg: "Unauthorized" });

    const links = await Url.find({ userId }).sort({ createdAt: -1 });
    res.status(200).json({ links });
  } catch (err) {
    console.error("Error fetching user links:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

const getLimit = async (req, res) => {
  try {
    const userId = await getUserIdFromSession(req.session);
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

const redirect = async (req, res) => {
  try {
    const { index } = req.query;
    if (!index) return res.status(400).json({ msg: "Missing Link" });

    const getIndex = decodeBase62(index);
    if (getIndex < 100) return res.status(400).json({ msg: "Invalid Link" });

    const url = await Url.findOne({ index: getIndex, type: "short-url" });
    if (!url) return res.status(404).json({ msg: "URL not found" });

    if(!url.isPasswordProtected){
      url.clicks+=1;
      await url.save();
    }

    res.status(200).json({ url });
  } catch (err) {
    console.error("Error fetching URL:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Verify Password Endpoint
const verifyPassword = async (req, res) => {
  try {
    const { index, password } = req.body;
    if (!index || !password)
      return res.status(400).json({ success: false, msg: "Missing data" });

    const getIndex = decodeBase62(index);
    const url = await Url.findOne({ index: getIndex, type: "short-url" });
    if (!url) return res.status(404).json({ success: false, msg: "URL not found" });

    if (url.password !== password) {
      return res.status(401).json({ success: false, msg: "Incorrect password" });
    }

    url.clicks += 1;
    await url.save();

    res.status(200).json({ success: true, originalUrl: url.originalUrl });
  } catch (err) {
    console.error("Password verification error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};


module.exports = {
  generateQrCodeForLink,
  generateShortUrlForLink,
  editUrlTitle,
  getUserShortUrls,
  getUserQRCodes,
  deleteUrlOrQr,
  getUserLinks,
  getLimit,
  redirect,
  verifyPassword
};

const express = require("express");
require("dotenv").config();
const app = express();
const cors = require("cors");
const { globalLimiter } = require("./config/limiter");
const cookieParser = require("cookie-parser");
const redis = require("./config/redis");

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

app.set("trust proxy", 1);

app.use(globalLimiter);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use("/api/v1/auth", require("./routes/auth.route"));
app.use("/api/v2/short-url", require("./routes/short-url.route"));
app.use("/api/v3/qr-code", require("./routes/qr-code.route"));
app.use("/api/v4/limit", require("./routes/limit.route"));

// Route 1: Clear all Redis data
app.get('/redis-clear', async (req, res) => {
  try {
    await redis.flushdb(); // clears all keys in current database
    res.json({ success: true, message: 'All Redis data cleared' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route 2: Print all Redis data
app.get('/redis-data', async (req, res) => {
  try {
    const keys = await redis.keys('*'); // get all keys

    if (keys.length === 0) {
      return res.json({ success: true, data: {} });
    }

    const data = {};
    for (const key of keys) {
      const type = await redis.type(key);

      switch (type) {
        case 'string':
          data[key] = await redis.get(key);
          break;
        case 'hash':
          data[key] = await redis.hgetall(key);
          break;
        case 'list':
          data[key] = await redis.lrange(key, 0, -1);
          break;
        case 'set':
          data[key] = await redis.smembers(key);
          break;
        case 'zset':
          data[key] = await redis.zrange(key, 0, -1);
          break;
        default:
          data[key] = null;
      }
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const port = process.env.PORT || 8080;

app.listen(port, () => {
  console.info(`Server is running on http://localhost:${port}`);
});

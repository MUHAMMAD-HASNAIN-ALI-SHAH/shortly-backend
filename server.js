const express = require("express");
require("dotenv").config();
const app = express();
const cors = require("cors");
const { globalLimiter } = require("./config/limiter");
const cookieParser = require("cookie-parser");

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

const port = process.env.PORT || 8080;

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

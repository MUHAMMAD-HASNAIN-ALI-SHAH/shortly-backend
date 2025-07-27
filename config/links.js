import QRCode from "qrcode";
const base62Chars =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

const generateQrCode = async (url) => {
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(url);
    return qrCodeDataUrl;
  } catch (error) {
    console.error("Error generating QR code:", error);
    throw new Error("Could not generate QR code");
  }
};

function encodeBase62(num) {
  let result = "";
  while (num > 0) {
    result = base62Chars[num % 62] + result;
    num = Math.floor(num / 62);
  }
  return result || "0";
}

function decodeBase62(str) {
  let num = 0;
  for (let char of str) {
    num = num * 62 + base62Chars.indexOf(char);
  }
  return num;
}

export { encodeBase62, decodeBase62, generateQrCode };

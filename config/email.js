const sendCode = (code) => `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Verification Code</title>
  </head>
  <body style="font-family: Arial, sans-serif; background-color: #f7f7f7; margin: 0; padding: 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <tr>
        <td style="background-color: #e3342f; padding: 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">shortly</h1>
        </td>
      </tr>
      <tr>
        <td style="padding: 30px; text-align: center;">
          <p style="font-size: 16px; color: #333;">Your verification code is:</p>
          <h2 style="font-size: 32px; color: #e3342f; margin: 10px 0;">${code}</h2>
          <p style="color: #555;">This code will expire in 10 minutes.</p>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

const getResetPasswordEmail = (userId, code) => `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Reset Password</title>
  </head>
  <body style="font-family: Arial, sans-serif; background-color: #f7f7f7; margin: 0; padding: 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <tr>
        <td style="background-color: #e3342f; padding: 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">shortly</h1>
        </td>
      </tr>
      <tr>
        <td style="padding: 30px; text-align: center;">
          <p style="font-size: 16px; color: #333;">Your reset password link is:</p>
          <a href="${process.env.FRONTEND_URL}/reset-password?userId=${userId}&code=${code}" style="display: inline-block; margin-top: 20px; background-color: #e3342f; color: white; padding: 12px 20px; text-decoration: none; font-weight: bold; border-radius: 6px;">
            Reset Password
          </a>
        </td>
      </tr>
    </table>
  </body>
</html>`;

module.exports = {
  sendCode,
  getResetPasswordEmail,
};

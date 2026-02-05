
const getVerificationEmailTemplate = (code, type = 'Verification') => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${type} Code</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f4f7f6;
      margin: 0;
      padding: 0;
      line-height: 1.6;
      color: #333;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
    }
    .header {
      background: linear-gradient(135deg, #2E7D32 0%, #43A047 100%);
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .content {
      padding: 40px 30px;
      text-align: center;
    }
    .welcome-text {
      font-size: 18px;
      color: #555;
      margin-bottom: 30px;
    }
    .code-box {
      background-color: #f0fdf4;
      border: 2px dashed #43A047;
      border-radius: 8px;
      padding: 20px;
      display: inline-block;
      margin: 0 auto 30px;
    }
    .code {
      font-size: 36px;
      font-weight: 800;
      color: #1B5E20;
      letter-spacing: 4px;
      font-family: 'Courier New', Courier, monospace;
    }
    .expiry {
      font-size: 14px;
      color: #777;
      margin-top: 10px;
    }
    .footer {
      background-color: #f9fafb;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #999;
      border-top: 1px solid #eee;
    }
    .footer a {
      color: #43A047;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Coco Guard</h1>
    </div>
    <div class="content">
      <p class="welcome-text">Hello User,</p>
      <p class="welcome-text">Use the code below to complete your ${type.toLowerCase()} process.</p>
      
      <div class="code-box">
        <div class="code">${code}</div>
      </div>
      
      <p class="expiry">This code will expire in 15 minutes.</p>
      <p class="expiry">If you didn't request this, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Coco Guard. All rights reserved.</p>
      <p>Protecting Coconut Crops with AI</p>
    </div>
  </div>
</body>
</html>
  `;
};

module.exports = { getVerificationEmailTemplate };

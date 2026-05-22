const { betterAuth } = require("better-auth");

const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,

  baseURL: process.env.BETTER_AUTH_URL,

  trustedOrigins: [
    "http://localhost:3000",
    "https://medi-queue-zeta.vercel.app",
  ],
});

module.exports = { auth };
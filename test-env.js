const fs = require("fs");
const path = require("path");

console.log("\n========================================");
console.log("🔬 ENVIRONMENT DIAGNOSTIC TOOL");
console.log("========================================\n");

// ================================================
// 1. DIRECTORY INFORMATION
// ================================================
console.log("📂 DIRECTORY INFORMATION:");
console.log("   Current working directory:", process.cwd());
console.log("   Script directory:", __dirname);
console.log("   Node version:", process.version);
console.log("");

// ================================================
// 2. CHECK FOR .env FILE
// ================================================
console.log("📄 .env FILE CHECK:");

const possibleEnvPaths = [
  path.join(process.cwd(), ".env"),
  path.join(__dirname, ".env"),
  path.join(process.cwd(), "../.env"),
];

let envFilePath = null;

possibleEnvPaths.forEach((envPath) => {
  const exists = fs.existsSync(envPath);
  console.log(`   ${envPath}: ${exists ? "✅ EXISTS" : "❌ NOT FOUND"}`);
  if (exists && !envFilePath) {
    envFilePath = envPath;
  }
});

console.log("");

// ================================================
// 3. READ .env FILE CONTENT
// ================================================
if (envFilePath) {
  console.log("📖 .env FILE CONTENT:");
  console.log(`   Reading from: ${envFilePath}`);

  try {
    const envContent = fs.readFileSync(envFilePath, "utf8");
    const lines = envContent.split("\n");

    console.log(`   Total lines: ${lines.length}`);
    console.log("");

    console.log("🔍 SEARCHING FOR KEY VARIABLES:");

    const keysToFind = [
      "RESEND_API_KEY",
      "JWT_SECRET",
      "MONGODB_URI",
      "PAYSTACK_SECRET_KEY",
      "PORT",
    ];

    keysToFind.forEach((key) => {
      const line = lines.find((l) => l.trim().startsWith(key));
      if (line) {
        const value = line.split("=")[1]?.trim();
        console.log(`   ${key}:`);
        console.log(`      Found: ✅`);
        console.log(`      Line: "${line}"`);
        console.log(`      Value length: ${value?.length || 0} chars`);
        console.log(
          `      First 15 chars: ${value?.substring(0, 15) || "EMPTY"}...`
        );
      } else {
        console.log(`   ${key}: ❌ NOT FOUND IN FILE`);
      }
    });
  } catch (error) {
    console.error("   ❌ Error reading .env file:", error.message);
  }
} else {
  console.log("❌ NO .env FILE FOUND!");
}

console.log("");

// ================================================
// 4. LOAD WITH DOTENV
// ================================================
console.log("🔄 LOADING WITH DOTENV:");

require("dotenv").config();

console.log("   After dotenv.config():");
console.log(
  `   RESEND_API_KEY: ${
    process.env.RESEND_API_KEY ? "✅ LOADED" : "❌ NOT LOADED"
  }`
);
console.log(
  `   JWT_SECRET: ${process.env.JWT_SECRET ? "✅ LOADED" : "❌ NOT LOADED"}`
);
console.log(
  `   MONGODB_URI: ${process.env.MONGODB_URI ? "✅ LOADED" : "❌ NOT LOADED"}`
);
console.log(
  `   PAYSTACK_SECRET_KEY: ${
    process.env.PAYSTACK_SECRET_KEY ? "✅ LOADED" : "❌ NOT LOADED"
  }`
);
console.log(`   PORT: ${process.env.PORT || "❌ NOT LOADED"}`);

console.log("");

if (process.env.RESEND_API_KEY) {
  console.log("✅ SUCCESS! RESEND_API_KEY Details:");
  console.log(`   Length: ${process.env.RESEND_API_KEY.length} characters`);
  console.log(`   Preview: ${process.env.RESEND_API_KEY.substring(0, 15)}...`);
  console.log(
    `   Starts with 're_': ${
      process.env.RESEND_API_KEY.startsWith("re_") ? "✅ YES" : "❌ NO"
    }`
  );
} else {
  console.log("❌ RESEND_API_KEY NOT LOADED!");
  console.log("\n🔍 TROUBLESHOOTING:");
  console.log(
    "   1. Make sure .env file is in the same directory as server.js"
  );
  console.log("   2. Check for typos in the variable name");
  console.log("   3. Ensure no spaces around the = sign");
  console.log("   4. Try running: npm install dotenv --save");
  console.log("   5. Restart your terminal/IDE");
}

console.log("\n========================================");
console.log("🏁 DIAGNOSTIC COMPLETE");
console.log("========================================\n");

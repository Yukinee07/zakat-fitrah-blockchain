const mongoose = require("mongoose");
const { exec }  = require("child_process");

let _connected = false;

async function tryStartMongoService() {
  if (process.platform !== "win32") return;
  return new Promise((resolve) => {
    exec("net start MongoDB", (_err, stdout, stderr) => {
      const out = (stdout + stderr).toLowerCase();
      if (out.includes("started successfully")) {
        console.log("[DB] MongoDB Windows service started.");
      } else if (out.includes("already been started")) {
        console.log("[DB] MongoDB service already running.");
      }
      resolve(); // always continue regardless of result
    });
  });
}

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI env var is required");

  await tryStartMongoService();

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  _connected = true;
  console.log("[MongoDB] Connected to", uri.replace(/\/\/.*@/, "//***@"));
}

function isDbConnected() {
  return _connected && mongoose.connection.readyState === 1;
}

module.exports = { connectDB, isDbConnected };

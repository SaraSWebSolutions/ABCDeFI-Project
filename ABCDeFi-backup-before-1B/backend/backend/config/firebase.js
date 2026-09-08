const admin = require("firebase-admin");

let mainApp = null;

const path = require("path");
const fs = require("fs");

try {
    let serviceAccount = null;

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        } catch (e) {
            // Might be a file path
        }
    }

    if (!serviceAccount) {
        const jsonPath = path.join(__dirname, "firebase-service-account.json");
        if (fs.existsSync(jsonPath)) {
            serviceAccount = require(jsonPath);
        }
    }

    if (serviceAccount) {
        if (serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
        }

        mainApp =
            admin.apps.find(app => app.name === "mainApp") ||
            admin.initializeApp(
                {
                    credential: admin.credential.cert(serviceAccount),
                },
                "mainApp"
            );
        console.log("Firebase Admin SDK initialized successfully.");
    }
} catch (err) {
    console.warn("Failed to initialize Firebase:", err.message);
}

module.exports = mainApp;
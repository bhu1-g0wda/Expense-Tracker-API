const admin = require('firebase-admin');

let serviceAccount;

try {
    // 1. Try to parse from Vercel Environment Variable first
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    }
    // 2. Fallback to local file for development
    else {
        serviceAccount = require('../firebase-service-account.json');
    }
} catch (error) {
    console.error('Failed to load Firebase credentials. Ensure firebase-service-account.json exists locally or FIREBASE_SERVICE_ACCOUNT env var is set in Vercel.');
    process.exit(1);
}

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase initialized successfully');
} catch (err) {
    console.error('Firebase initialization error:', err);
    process.exit(1);
}

const db = admin.firestore();

// Maintain a connectDB function to not break server.js structure
const connectDB = async () => {
    return true; // Connection is synchronous in Firebase
};

module.exports = { db, connectDB, admin };

const admin = require('firebase-admin');

// Ensure the credential file exists before trying to require it
let serviceAccount;
try {
    serviceAccount = require('../firebase-service-account.json');
} catch (error) {
    console.error('Missing firebase-service-account.json. Please add it to the project root.');
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

const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB } = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const userRoutes = require('./routes/userRoutes');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files with absolute path

// API Routes
app.use('/auth', authRoutes);
app.use('/expenses', expenseRoutes);
app.use('/users', userRoutes);

// Explicit page routes (in case static middleware misses them)
app.get('/analytics.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'analytics.html'));
});

// Fallback: serve index.html for any other GET request
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Connect to Database and start server
if (process.env.NODE_ENV !== 'production') {
    const startServer = async () => {
        await connectDB();
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    };
    startServer();
} else {
    // In production (Vercel), we just need to establish the DB connection
    // and export the app. Vercel's serverless environment handles the listening.
    connectDB();
}

// Export the app for Vercel Serverless Functions
module.exports = app;

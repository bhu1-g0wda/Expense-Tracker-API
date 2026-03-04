const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

exports.signup = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // In Firestore, we must manually check for uniqueness
        const emailCheck = await User.where('email', '==', email).limit(1).get();
        if (!emailCheck.empty) {
            return res.status(400).json({ error: `The email "${email}" is already in use.` });
        }

        const usernameCheck = await User.where('username', '==', username).limit(1).get();
        if (!usernameCheck.empty) {
            return res.status(400).json({ error: `The username "${username}" is already in use.` });
        }

        // hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        const userRef = await User.add({
            username,
            email,
            password: hashedPassword,
            budget: 0,
            createdAt: new Date().toISOString()
        });

        res.status(201).json({ message: 'User created successfully', userId: userRef.id });
    } catch (error) {
        res.status(500).json({ error: 'Error creating user', details: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user by email only
        const snapshot = await User.where('email', '==', email).limit(1).get();

        if (snapshot.empty) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const userData = snapshot.docs[0].data();
        const userId = snapshot.docs[0].id;

        const isMatch = await bcrypt.compare(password, userData.password);

        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: userId, email: userData.email }, JWT_SECRET, { expiresIn: '1h' });

        res.json({ token, userId: userId, email: userData.email, username: userData.username });
    } catch (error) {
        res.status(500).json({ error: 'Error logging in', details: error.message });
    }
};

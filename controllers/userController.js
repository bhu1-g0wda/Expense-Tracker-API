const User = require('../models/User');

exports.getBudget = async (req, res) => {
    try {
        const userDoc = await User.doc(req.user.id).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }
        const data = userDoc.data();
        res.json({ budget: data.budget, username: data.username });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching budget', details: error.message });
    }
};

exports.updateBudget = async (req, res) => {
    try {
        const { budget } = req.body;
        const userRef = User.doc(req.user.id);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }

        await userRef.update({ budget });

        res.json({ budget: budget, message: 'Budget updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error updating budget', details: error.message });
    }
};

// Endpoint to search users by username for splitting expenses
exports.searchUsers = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query || query.length < 2) {
            return res.json([]);
        }

        // Firestore regex is limited, so we use string prefix matching
        const snapshot = await User
            .where('username', '>=', query)
            .where('username', '<=', query + '\uf8ff')
            .limit(10)
            .get();

        let users = [];
        snapshot.forEach(doc => {
            // Don't allow splitting with yourself
            if (doc.id !== req.user.id) {
                users.push({ _id: doc.id, username: doc.data().username });
            }
        });

        res.json(users);

    } catch (error) {
        res.status(500).json({ error: 'Error searching users', details: error.message });
    }
};

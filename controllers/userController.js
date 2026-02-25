const User = require('../models/User');

exports.getBudget = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ budget: user.budget, username: user.username });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching budget', details: error.message });
    }
};

exports.updateBudget = async (req, res) => {
    try {
        const { budget } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.budget = budget;
        await user.save();

        res.json({ budget: user.budget, message: 'Budget updated successfully' });
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

        // Search for usernames matching the query (case-insensitive), excluding the current user
        const users = await User.find({
            username: { $regex: query, $options: 'i' },
            _id: { $ne: req.user.id } // Don't allow splitting with yourself
        }).select('username _id').limit(10); // Limit results to prevent huge payloads

        res.json(users);

    } catch (error) {
        res.status(500).json({ error: 'Error searching users', details: error.message });
    }
};

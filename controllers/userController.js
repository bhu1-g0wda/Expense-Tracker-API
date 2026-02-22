const User = require('../models/User');

exports.getBudget = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ budget: user.budget });
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

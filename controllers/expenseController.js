const Expense = require('../models/Expense');

exports.createExpense = async (req, res) => {
    try {
        const { description, amount, category, date } = req.body;
        const userId = req.user.id; // from auth middleware

        const expense = await Expense.create({
            description,
            amount,
            category,
            date,
            userId
        });

        res.status(201).json(expense);
    } catch (error) {
        res.status(500).json({ error: 'Error creating expense', details: error.message });
    }
};

exports.getExpenses = async (req, res) => {
    try {
        const userId = req.user.id;
        const expenses = await Expense.find({ userId });
        res.json(expenses);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching expenses', details: error.message });
    }
};

exports.updateExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { description, amount, category, date } = req.body;

        const expense = await Expense.findOne({ _id: id, userId });

        if (!expense) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        expense.description = description ?? expense.description;
        expense.amount = amount ?? expense.amount;
        expense.category = category ?? expense.category;
        expense.date = date ?? expense.date;

        await expense.save();

        res.json(expense);
    } catch (error) {
        res.status(500).json({ error: 'Error updating expense', details: error.message });
    }
};

exports.deleteExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const expense = await Expense.findOneAndDelete({ _id: id, userId });

        if (!expense) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        res.json({ message: 'Expense deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting expense', details: error.message });
    }
};

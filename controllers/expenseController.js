const mongoose = require('mongoose');
const Expense = require('../models/Expense');

exports.createExpense = async (req, res) => {
    try {
        const { description, amount, category, date, splitWithUsers } = req.body;
        const userId = req.user.id; // from auth middleware

        // If splitWithUsers is provided and valid, split the expense
        if (splitWithUsers && Array.isArray(splitWithUsers) && splitWithUsers.length > 0) {
            const User = require('../models/User'); // Need User model to resolve names

            // Get all usernames involved
            const splitUsers = await User.find({ _id: { $in: splitWithUsers } }, 'username');
            const creator = await User.findById(userId, 'username');

            const splitUsernames = splitUsers.map(u => u.username).join(', ');
            const creatorName = creator ? creator.username : 'Someone';

            const totalPeople = splitWithUsers.length + 1; // including the creator
            const splitAmount = amount / totalPeople;

            const splitGroupId = new mongoose.Types.ObjectId().toString();

            // 1. Create expense for the creator (logging the Full Amount they paid)
            const expense = await Expense.create({
                description: `${description} (Paid by you, split with ${splitUsernames})`,
                amount: amount,
                category,
                date,
                userId,
                splitGroupId,
                isSplitCreator: true,
                splitUsers: splitWithUsers
            });

            // 2. Create identical expenses for everyone else (logging their fraction)
            const splitPromises = splitWithUsers.map(splitUserId => {
                return Expense.create({
                    description: `${description} (Split share paid by ${creatorName})`,
                    amount: splitAmount,
                    category,
                    date,
                    userId: splitUserId,
                    splitGroupId
                });
            });

            await Promise.all(splitPromises);
            return res.status(201).json(expense);
        }

        // Standard single-user expense
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
        const expenses = await Expense.find({ userId }).populate('splitUsers', 'username');
        res.json(expenses);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching expenses', details: error.message });
    }
};

exports.updateExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { description, amount, category, date, splitWithUsers } = req.body;

        const expense = await Expense.findOne({ _id: id, userId });

        if (!expense) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        // If this is the creator of a split group, we need to completely recalculate and recreate the split shares
        if (expense.isSplitCreator && expense.splitGroupId) {

            // Delete all existing child shares for this group
            await Expense.deleteMany({ splitGroupId: expense.splitGroupId, isSplitCreator: false });

            // If the user removed all splits, we convert it back to a standard expense
            if (!splitWithUsers || !Array.isArray(splitWithUsers) || splitWithUsers.length === 0) {
                expense.description = description ?? expense.description.replace(/ \(Paid by you, split with .*\)/, ''); // Attempt to clean old tracking
                expense.amount = amount ?? expense.amount;
                expense.category = category ?? expense.category;
                expense.date = date ?? expense.date;
                expense.splitGroupId = null;
                expense.isSplitCreator = false;
                expense.splitUsers = [];
                await expense.save();
                return res.json(expense);
            }

            // Otherwise, recalculate and recreate the splits
            const User = require('../models/User');
            const splitUsersModels = await User.find({ _id: { $in: splitWithUsers } }, 'username');
            const creator = await User.findById(userId, 'username');

            const splitUsernames = splitUsersModels.map(u => u.username).join(', ');
            const creatorName = creator ? creator.username : 'Someone';

            const totalPeople = splitWithUsers.length + 1; // including the creator
            const newTotalAmount = amount ?? expense.amount;
            const splitAmount = newTotalAmount / totalPeople;
            const baseDescription = description ?? expense.description.replace(/ \(Paid by you, split with .*\)/, '');

            // 1. Update creator's expense
            expense.description = `${baseDescription} (Paid by you, split with ${splitUsernames})`;
            expense.amount = newTotalAmount;
            expense.category = category ?? expense.category;
            expense.date = date ?? expense.date;
            expense.splitUsers = splitWithUsers;
            await expense.save();

            // 2. Recreate identical expenses for everyone else (logging their fraction)
            const splitPromises = splitWithUsers.map(splitUserId => {
                return Expense.create({
                    description: `${baseDescription} (Split share paid by ${creatorName})`,
                    amount: splitAmount,
                    category: category ?? expense.category,
                    date: date ?? expense.date,
                    userId: splitUserId,
                    splitGroupId: expense.splitGroupId
                });
            });

            await Promise.all(splitPromises);
            return res.json(expense);
        }

        // Standard update if not a split creator (just updating your own share or a normal task)
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

        const expense = await Expense.findOne({ _id: id, userId });

        if (!expense) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        // If this is the creator of a split group, cascade delete all child shares
        if (expense.isSplitCreator && expense.splitGroupId) {
            await Expense.deleteMany({ splitGroupId: expense.splitGroupId });
        } else {
            // Otherwise just delete the single record
            await Expense.deleteOne({ _id: id });
        }

        res.json({ message: 'Expense deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting expense', details: error.message });
    }
};

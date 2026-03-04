const Expense = require('../models/Expense');
const User = require('../models/User');

exports.createExpense = async (req, res) => {
    try {
        const { description, amount, category, date, splitWithUsers } = req.body;
        const userId = req.user.id; // from auth middleware

        // If splitWithUsers is provided and valid, split the expense
        if (splitWithUsers && Array.isArray(splitWithUsers) && splitWithUsers.length > 0) {
            // Get all usernames involved
            // Note: Firestore 'in' queries are limited to 10 items.
            const splitUsersSnapshot = await User.where('__name__', 'in', splitWithUsers.slice(0, 10)).get();
            const creatorDoc = await User.doc(userId).get();

            const splitUsernames = splitUsersSnapshot.docs.map(u => u.data().username).join(', ');
            const creatorName = creatorDoc.exists ? creatorDoc.data().username : 'Someone';

            const totalPeople = splitWithUsers.length + 1; // including the creator
            const splitAmount = amount / totalPeople;

            // Generate a unique split group ID
            const splitGroupId = Expense.doc().id;

            // 1. Create expense for the creator (logging the Full Amount they paid)
            const expenseData = {
                description: `${description} (Paid by you, split with ${splitUsernames})`,
                amount: amount,
                category,
                date: date || new Date().toISOString(),
                userId,
                splitGroupId,
                isSplitCreator: true,
                splitUsers: splitWithUsers,
                createdAt: new Date().toISOString()
            };
            const expenseRef = await Expense.add(expenseData);

            // 2. Create identical expenses for everyone else (logging their fraction)
            const splitPromises = splitWithUsers.map(splitUserId => {
                return Expense.add({
                    description: `${description} (Split share paid by ${creatorName})`,
                    amount: splitAmount,
                    category,
                    date: date || new Date().toISOString(),
                    userId: splitUserId,
                    splitGroupId,
                    isSplitCreator: false,
                    splitUsers: [],
                    createdAt: new Date().toISOString()
                });
            });

            await Promise.all(splitPromises);
            return res.status(201).json({ _id: expenseRef.id, ...expenseData });
        }

        // Standard single-user expense
        const expenseData = {
            description,
            amount,
            category,
            date: date || new Date().toISOString(),
            userId,
            splitGroupId: null,
            isSplitCreator: false,
            splitUsers: [],
            createdAt: new Date().toISOString()
        };
        const expenseRef = await Expense.add(expenseData);

        res.status(201).json({ _id: expenseRef.id, ...expenseData });
    } catch (error) {
        res.status(500).json({ error: 'Error creating expense', details: error.message });
    }
};

exports.getExpenses = async (req, res) => {
    try {
        const userId = req.user.id;
        const snapshot = await Expense.where('userId', '==', userId).get();

        let expenses = [];
        for (let doc of snapshot.docs) {
            let data = doc.data();
            data._id = doc.id;

            // Manual populate for splitUsers
            if (data.splitUsers && data.splitUsers.length > 0) {
                try {
                    const usersSnapshot = await User.where('__name__', 'in', data.splitUsers.slice(0, 10)).get();
                    data.splitUsers = usersSnapshot.docs.map(u => ({ _id: u.id, username: u.data().username }));
                } catch (err) {
                    console.error('Failed to populate users', err);
                    data.splitUsers = [];
                }
            } else {
                data.splitUsers = [];
            }
            expenses.push(data);
        }

        // Sort by date descending (manual sort since we fetched all)
        expenses.sort((a, b) => new Date(b.date) - new Date(a.date));

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

        const expenseRef = Expense.doc(id);
        const expenseSnap = await expenseRef.get();

        if (!expenseSnap.exists || expenseSnap.data().userId !== userId) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        let expense = expenseSnap.data();
        expense._id = expenseSnap.id;

        // If this is the creator of a split group, we need to completely recalculate and recreate the split shares
        if (expense.isSplitCreator && expense.splitGroupId) {

            // Delete all existing child shares for this group
            const childrenSnap = await Expense
                .where('splitGroupId', '==', expense.splitGroupId)
                .where('isSplitCreator', '==', false)
                .get();

            const deletePromises = childrenSnap.docs.map(doc => doc.ref.delete());
            await Promise.all(deletePromises);

            // If the user removed all splits, we convert it back to a standard expense
            if (!splitWithUsers || !Array.isArray(splitWithUsers) || splitWithUsers.length === 0) {
                const updatedData = {
                    description: description ?? expense.description.replace(/ \(Paid by you, split with .*\)/, ''),
                    amount: amount ?? expense.amount,
                    category: category ?? expense.category,
                    date: date ?? expense.date,
                    splitGroupId: null,
                    isSplitCreator: false,
                    splitUsers: []
                };
                await expenseRef.update(updatedData);
                return res.json({ ...expense, ...updatedData });
            }

            // Otherwise, recalculate and recreate the splits
            const splitUsersModels = await User.where('__name__', 'in', splitWithUsers.slice(0, 10)).get();
            const creatorDoc = await User.doc(userId).get();

            const splitUsernames = splitUsersModels.docs.map(u => u.data().username).join(', ');
            const creatorName = creatorDoc.exists ? creatorDoc.data().username : 'Someone';

            const totalPeople = splitWithUsers.length + 1; // including the creator
            const newTotalAmount = amount ?? expense.amount;
            const splitAmount = newTotalAmount / totalPeople;
            const baseDescription = description ?? expense.description.replace(/ \(Paid by you, split with .*\)/, '');

            // 1. Update creator's expense
            const updatedCreatorData = {
                description: `${baseDescription} (Paid by you, split with ${splitUsernames})`,
                amount: newTotalAmount,
                category: category ?? expense.category,
                date: date ?? expense.date,
                splitUsers: splitWithUsers
            };
            await expenseRef.update(updatedCreatorData);

            // 2. Recreate identical expenses for everyone else (logging their fraction)
            const splitPromises = splitWithUsers.map(splitUserId => {
                return Expense.add({
                    description: `${baseDescription} (Split share paid by ${creatorName})`,
                    amount: splitAmount,
                    category: category ?? expense.category,
                    date: date ?? expense.date,
                    userId: splitUserId,
                    splitGroupId: expense.splitGroupId,
                    isSplitCreator: false,
                    splitUsers: []
                });
            });

            await Promise.all(splitPromises);
            return res.json({ ...expense, ...updatedCreatorData });
        }

        // Standard update if not a split creator (just updating your own share or a normal task)
        const updatedData = {
            description: description ?? expense.description,
            amount: amount ?? expense.amount,
            category: category ?? expense.category,
            date: date ?? expense.date
        };

        await expenseRef.update(updatedData);

        res.json({ ...expense, ...updatedData });
    } catch (error) {
        res.status(500).json({ error: 'Error updating expense', details: error.message });
    }
};

exports.deleteExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const expenseRef = Expense.doc(id);
        const expenseSnap = await expenseRef.get();

        if (!expenseSnap.exists || expenseSnap.data().userId !== userId) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        const expense = expenseSnap.data();

        // If this is the creator of a split group, cascade delete all child shares
        if (expense.isSplitCreator && expense.splitGroupId) {
            const childrenSnap = await Expense.where('splitGroupId', '==', expense.splitGroupId).get();
            const deletePromises = childrenSnap.docs.map(doc => doc.ref.delete());
            await Promise.all(deletePromises);
        } else {
            // Otherwise just delete the single record
            await expenseRef.delete();
        }

        res.json({ message: 'Expense deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting expense', details: error.message });
    }
};

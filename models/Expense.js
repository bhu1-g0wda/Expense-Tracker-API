const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    description: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    category: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true,
        default: Date.now,
        validate: {
            validator: function (v) {
                return v <= new Date();
            },
            message: 'Date cannot be in the future'
        }
    },
    splitGroupId: {
        type: String,
        default: null
    },
    isSplitCreator: {
        type: Boolean,
        default: false
    },
    splitUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

const Expense = mongoose.model('Expense', expenseSchema);

module.exports = Expense;

/**
 * Expense Tracker - Full API Test Suite
 * Tests: Auth, Expenses (CRUD + Split), User (Budget, Search)
 *
 * Run with: npm test
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// ─── App Bootstrap (without starting the HTTP server) ─────────────────────────
// We import express and wire everything up exactly as server.js does,
// but we don't call app.listen() so the test runner controls the port.
const express = require('express');
const cors = require('cors');
const path = require('path');

// Point dotenv at a fake secret so JWT works without a real .env
process.env.JWT_SECRET = 'test_secret_key_for_jest';

const authRoutes = require('../routes/authRoutes');
const expenseRoutes = require('../routes/expenseRoutes');
const userRoutes = require('../routes/userRoutes');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/auth', authRoutes);
app.use('/expenses', expenseRoutes);
app.use('/users', userRoutes);

// ─── In-Memory MongoDB Setup ──────────────────────────────────────────────────
let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

afterEach(async () => {
    // Wipe all collections between tests for isolation
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function registerUser(username, email, password = 'Password123!') {
    return request(app)
        .post('/auth/signup')
        .send({ username, email, password });
}

async function loginUser(email, password = 'Password123!') {
    const res = await request(app)
        .post('/auth/login')
        .send({ email, password });
    return res.body; // { token, userId, email, username }
}

async function registerAndLogin(username = 'testuser', email = 'test@example.com') {
    await registerUser(username, email);
    return loginUser(email);
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. AUTH ROUTES
// ═════════════════════════════════════════════════════════════════════════════
describe('🔐 Auth – POST /auth/signup', () => {

    test('should register a new user and return 201', async () => {
        const res = await registerUser('alice', 'alice@example.com');
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('message', 'User created successfully');
        expect(res.body).toHaveProperty('userId');
    });

    test('should reject duplicate email with 400', async () => {
        await registerUser('alice', 'alice@example.com');
        const res = await registerUser('alice2', 'alice@example.com');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/already in use/i);
    });

    test('should reject duplicate username with 400', async () => {
        await registerUser('alice', 'alice@example.com');
        const res = await registerUser('alice', 'alice2@example.com');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/already in use/i);
    });

    test('should not store plain-text password', async () => {
        await registerUser('alice', 'alice@example.com', 'mysecret');
        const User = require('../models/User');
        const user = await User.findOne({ email: 'alice@example.com' });
        expect(user.password).not.toBe('mysecret');
        expect(user.password.length).toBeGreaterThan(20); // bcrypt hash
    });
});

describe('🔐 Auth – POST /auth/login', () => {

    beforeEach(async () => {
        await registerUser('alice', 'alice@example.com');
    });

    test('should return a JWT token and user info on valid credentials', async () => {
        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'alice@example.com', password: 'Password123!' });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body).toHaveProperty('userId');
        expect(res.body).toHaveProperty('email', 'alice@example.com');
        expect(res.body).toHaveProperty('username', 'alice');
    });

    test('should reject wrong password with 400', async () => {
        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'alice@example.com', password: 'WrongPass!' });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Invalid credentials');
    });

    test('should reject non-existent email with 400', async () => {
        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'nobody@example.com', password: 'Password123!' });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Invalid credentials');
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. AUTH MIDDLEWARE
// ═════════════════════════════════════════════════════════════════════════════
describe('🛡️  Auth Middleware', () => {

    test('should block requests with no token (401)', async () => {
        const res = await request(app).get('/expenses');
        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/no token/i);
    });

    test('should block requests with an invalid/tampered token (400)', async () => {
        const res = await request(app)
            .get('/expenses')
            .set('Authorization', 'Bearer this.is.not.valid');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/invalid token/i);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. EXPENSE ROUTES – CRUD
// ═════════════════════════════════════════════════════════════════════════════
describe('💰 Expenses – POST /expenses (create)', () => {

    let token;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;
    });

    test('should create a standard expense and return 201', async () => {
        const res = await request(app)
            .post('/expenses')
            .set('Authorization', `Bearer ${token}`)
            .send({
                description: 'Coffee',
                amount: 5.5,
                category: 'Food',
                date: new Date().toISOString()
            });
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('description', 'Coffee');
        expect(res.body).toHaveProperty('amount', 5.5);
        expect(res.body).toHaveProperty('category', 'Food');
        expect(res.body).toHaveProperty('_id');
    });

    test('should reject an expense with amount < 0', async () => {
        const res = await request(app)
            .post('/expenses')
            .set('Authorization', `Bearer ${token}`)
            .send({
                description: 'Refund',
                amount: -10,
                category: 'Other',
                date: new Date().toISOString()
            });
        expect(res.status).toBe(500); // Mongoose validation error bubbles to 500
        expect(res.body).toHaveProperty('error');
    });

    test('should reject if required fields are missing', async () => {
        const res = await request(app)
            .post('/expenses')
            .set('Authorization', `Bearer ${token}`)
            .send({ amount: 20 }); // missing description & category
        expect(res.status).toBe(500);
    });
});

describe('💰 Expenses – GET /expenses (list)', () => {

    let token;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;
    });

    test('should return an empty array when no expenses exist', async () => {
        const res = await request(app)
            .get('/expenses')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(0);
    });

    test('should return only expenses belonging to the authenticated user', async () => {
        // Create expense for primary user
        await request(app)
            .post('/expenses')
            .set('Authorization', `Bearer ${token}`)
            .send({ description: 'Lunch', amount: 12, category: 'Food', date: new Date().toISOString() });

        // Register + login a second user and create their expense
        await registerUser('bob', 'bob@example.com');
        const bob = await loginUser('bob@example.com');
        await request(app)
            .post('/expenses')
            .set('Authorization', `Bearer ${bob.token}`)
            .send({ description: 'Uber', amount: 20, category: 'Transport', date: new Date().toISOString() });

        // Primary user should only see their own expense
        const res = await request(app)
            .get('/expenses')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].description).toBe('Lunch');
    });

    test('should return multiple expenses for the user', async () => {
        const expensesData = [
            { description: 'Groceries', amount: 50, category: 'Food', date: new Date().toISOString() },
            { description: 'Netflix', amount: 15, category: 'Entertainment', date: new Date().toISOString() },
            { description: 'Gym', amount: 40, category: 'Health', date: new Date().toISOString() },
        ];
        for (const e of expensesData) {
            await request(app).post('/expenses').set('Authorization', `Bearer ${token}`).send(e);
        }
        const res = await request(app).get('/expenses').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(3);
    });
});

describe('💰 Expenses – PUT /expenses/:id (update)', () => {

    let token, expenseId;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;
        const createRes = await request(app)
            .post('/expenses')
            .set('Authorization', `Bearer ${token}`)
            .send({ description: 'Original', amount: 30, category: 'Food', date: new Date().toISOString() });
        expenseId = createRes.body._id;
    });

    test('should update description and amount', async () => {
        const res = await request(app)
            .put(`/expenses/${expenseId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ description: 'Updated', amount: 99 });
        expect(res.status).toBe(200);
        expect(res.body.description).toBe('Updated');
        expect(res.body.amount).toBe(99);
    });

    test('should update category only', async () => {
        const res = await request(app)
            .put(`/expenses/${expenseId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ category: 'Transport' });
        expect(res.status).toBe(200);
        expect(res.body.category).toBe('Transport');
        // description should remain unchanged
        expect(res.body.description).toBe('Original');
    });

    test('should return 404 when updating a non-existent expense', async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();
        const res = await request(app)
            .put(`/expenses/${fakeId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ description: 'Ghost' });
        expect(res.status).toBe(404);
    });

    test('should not allow one user to update another user\'s expense', async () => {
        await registerUser('bob', 'bob@example.com');
        const bob = await loginUser('bob@example.com');
        const res = await request(app)
            .put(`/expenses/${expenseId}`)
            .set('Authorization', `Bearer ${bob.token}`)
            .send({ description: 'Hacked' });
        expect(res.status).toBe(404); // looks non-existent to bob
    });
});

describe('💰 Expenses – DELETE /expenses/:id', () => {

    let token, expenseId;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;
        const createRes = await request(app)
            .post('/expenses')
            .set('Authorization', `Bearer ${token}`)
            .send({ description: 'To Delete', amount: 10, category: 'Misc', date: new Date().toISOString() });
        expenseId = createRes.body._id;
    });

    test('should delete the expense and return success message', async () => {
        const res = await request(app)
            .delete(`/expenses/${expenseId}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message', 'Expense deleted successfully');
    });

    test('should confirm expense is gone after deletion', async () => {
        await request(app).delete(`/expenses/${expenseId}`).set('Authorization', `Bearer ${token}`);
        const listRes = await request(app).get('/expenses').set('Authorization', `Bearer ${token}`);
        expect(listRes.body.length).toBe(0);
    });

    test('should return 404 when deleting a non-existent expense', async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();
        const res = await request(app)
            .delete(`/expenses/${fakeId}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });

    test('should not allow one user to delete another user\'s expense', async () => {
        await registerUser('bob', 'bob@example.com');
        const bob = await loginUser('bob@example.com');
        const res = await request(app)
            .delete(`/expenses/${expenseId}`)
            .set('Authorization', `Bearer ${bob.token}`);
        expect(res.status).toBe(404);
        // Original expense should still exist
        const listRes = await request(app).get('/expenses').set('Authorization', `Bearer ${token}`);
        expect(listRes.body.length).toBe(1);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. SPLIT EXPENSES
// ═════════════════════════════════════════════════════════════════════════════
describe('🤝 Split Expenses', () => {

    let alice, bob, charlie;

    beforeEach(async () => {
        await registerUser('alice', 'alice@example.com');
        await registerUser('bob', 'bob@example.com');
        await registerUser('charlie', 'charlie@example.com');
        alice = await loginUser('alice@example.com');
        bob = await loginUser('bob@example.com');
        charlie = await loginUser('charlie@example.com');
    });

    test('should create a split expense and assign shares to each user', async () => {
        const res = await request(app)
            .post('/expenses')
            .set('Authorization', `Bearer ${alice.token}`)
            .send({
                description: 'Dinner',
                amount: 90,
                category: 'Food',
                date: new Date().toISOString(),
                splitWithUsers: [bob.userId, charlie.userId]
            });

        expect(res.status).toBe(201);
        expect(res.body.amount).toBe(90);      // Alice sees the full amount she paid
        expect(res.body.isSplitCreator).toBe(true);
        expect(res.body.splitGroupId).toBeTruthy();
    });

    test('creator sees full amount; split members see their fractional share', async () => {
        await request(app)
            .post('/expenses')
            .set('Authorization', `Bearer ${alice.token}`)
            .send({
                description: 'Movie',
                amount: 60,
                category: 'Entertainment',
                date: new Date().toISOString(),
                splitWithUsers: [bob.userId]  // 2 people → $30 each
            });

        // Alice (creator) should see $60
        const aliceExpenses = await request(app)
            .get('/expenses')
            .set('Authorization', `Bearer ${alice.token}`);
        expect(aliceExpenses.body[0].amount).toBe(60);

        // Bob (split member) should see $30
        const bobExpenses = await request(app)
            .get('/expenses')
            .set('Authorization', `Bearer ${bob.token}`);
        expect(bobExpenses.body[0].amount).toBe(30);
    });

    test('deleting a split expense (by creator) should cascade-delete all shares', async () => {
        const createRes = await request(app)
            .post('/expenses')
            .set('Authorization', `Bearer ${alice.token}`)
            .send({
                description: 'Hotel',
                amount: 300,
                category: 'Travel',
                date: new Date().toISOString(),
                splitWithUsers: [bob.userId, charlie.userId]
            });

        const groupExpenseId = createRes.body._id;

        // Delete as creator
        const delRes = await request(app)
            .delete(`/expenses/${groupExpenseId}`)
            .set('Authorization', `Bearer ${alice.token}`);
        expect(delRes.status).toBe(200);

        // Bob and Charlie should have no expenses left
        const bobExpenses = await request(app).get('/expenses').set('Authorization', `Bearer ${bob.token}`);
        const charlieExpenses = await request(app).get('/expenses').set('Authorization', `Bearer ${charlie.token}`);
        expect(bobExpenses.body.length).toBe(0);
        expect(charlieExpenses.body.length).toBe(0);
    });

    test('updating a split expense should recalculate shares for all members', async () => {
        const createRes = await request(app)
            .post('/expenses')
            .set('Authorization', `Bearer ${alice.token}`)
            .send({
                description: 'Pizza',
                amount: 40,
                category: 'Food',
                date: new Date().toISOString(),
                splitWithUsers: [bob.userId]
            });

        // Update amount to 60 (+ add charlie)
        await request(app)
            .put(`/expenses/${createRes.body._id}`)
            .set('Authorization', `Bearer ${alice.token}`)
            .send({ amount: 60, splitWithUsers: [bob.userId, charlie.userId] });

        // Bob should now see 60/3 = $20
        const bobExpenses = await request(app).get('/expenses').set('Authorization', `Bearer ${bob.token}`);
        expect(bobExpenses.body[0].amount).toBe(20);

        // Charlie should also see $20
        const charlieExpenses = await request(app).get('/expenses').set('Authorization', `Bearer ${charlie.token}`);
        expect(charlieExpenses.body[0].amount).toBe(20);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. USER ROUTES – Budget
// ═════════════════════════════════════════════════════════════════════════════
describe('👤 Users – Budget (GET/PUT /users/budget)', () => {

    let token;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;
    });

    test('should return default budget of 0 for a new user', async () => {
        const res = await request(app)
            .get('/users/budget')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('budget', 0);
        expect(res.body).toHaveProperty('username', 'testuser');
    });

    test('should update the budget and return the new value', async () => {
        const res = await request(app)
            .put('/users/budget')
            .set('Authorization', `Bearer ${token}`)
            .send({ budget: 2500 });
        expect(res.status).toBe(200);
        expect(res.body.budget).toBe(2500);
        expect(res.body.message).toBe('Budget updated successfully');
    });

    test('should persist the updated budget on subsequent GET', async () => {
        await request(app)
            .put('/users/budget')
            .set('Authorization', `Bearer ${token}`)
            .send({ budget: 5000 });

        const res = await request(app)
            .get('/users/budget')
            .set('Authorization', `Bearer ${token}`);
        expect(res.body.budget).toBe(5000);
    });

    test('should require auth to access budget routes', async () => {
        const getRes = await request(app).get('/users/budget');
        expect(getRes.status).toBe(401);

        const putRes = await request(app).put('/users/budget').send({ budget: 100 });
        expect(putRes.status).toBe(401);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. USER ROUTES – Search
// ═════════════════════════════════════════════════════════════════════════════
describe('🔍 Users – Search (GET /users/search)', () => {

    let aliceToken;

    beforeEach(async () => {
        await registerUser('alice', 'alice@example.com');
        await registerUser('alicia', 'alicia@example.com');
        await registerUser('bob', 'bob@example.com');
        const data = await loginUser('alice@example.com');
        aliceToken = data.token;
    });

    test('should return matching users (case-insensitive)', async () => {
        const res = await request(app)
            .get('/users/search?query=ali')
            .set('Authorization', `Bearer ${aliceToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        // "alicia" should match; "alice" is the current user so should be excluded
        const usernames = res.body.map(u => u.username);
        expect(usernames).toContain('alicia');
        expect(usernames).not.toContain('alice'); // can't split with yourself
    });

    test('should return empty array for query shorter than 2 chars', async () => {
        const res = await request(app)
            .get('/users/search?query=a')
            .set('Authorization', `Bearer ${aliceToken}`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('should return empty array when no users match', async () => {
        const res = await request(app)
            .get('/users/search?query=zzzzz')
            .set('Authorization', `Bearer ${aliceToken}`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('should not return more than 10 users (limit check)', async () => {
        // Register 15 extra users starting with "test"
        for (let i = 0; i < 15; i++) {
            await registerUser(`testuser${i}`, `testuser${i}@example.com`);
        }
        const res = await request(app)
            .get('/users/search?query=testuser')
            .set('Authorization', `Bearer ${aliceToken}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBeLessThanOrEqual(10);
    });

    test('should require auth to search users', async () => {
        const res = await request(app).get('/users/search?query=ali');
        expect(res.status).toBe(401);
    });
});

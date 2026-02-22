
const API_URL = 'http://localhost:3000';

const timestamp = Date.now();
const user = {
    username: `testuser_${timestamp}`,
    email: `test_${timestamp}@example.com`,
    password: 'password123'
};

let token = '';
let userId = '';
let expenseId = '';

async function request(url, method = 'GET', data = null, authToken = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const options = { method, headers };
    if (data) options.body = JSON.stringify(data);

    const res = await fetch(API_URL + url, options);
    const json = await res.json().catch(() => ({})); // Handle empty responses
    return { status: res.status, data: json };
}

async function runTests() {
    console.log('--- Starting Full Flow Tests (using fetch) ---');

    try {
        // 1. Signup
        console.log(`1. Testing Signup (${user.username})...`);
        const signupRes = await request('/auth/signup', 'POST', user);
        console.log('   Signup Status:', signupRes.status);
        if (signupRes.status !== 201) throw new Error(`Signup failed: ${JSON.stringify(signupRes.data)}`);

        // 2. Login with Email
        console.log('2. Testing Login with Email...');
        const loginEmailRes = await request('/auth/login', 'POST', {
            identifier: user.email,
            password: user.password
        });
        console.log('   Login (Email) Status:', loginEmailRes.status);
        if (loginEmailRes.status !== 200) throw new Error('Login with Email failed');
        token = loginEmailRes.data.token;
        userId = loginEmailRes.data.userId;

        // 3. Login with Username
        console.log('3. Testing Login with Username...');
        const loginUserRes = await request('/auth/login', 'POST', {
            identifier: user.username,
            password: user.password
        });
        console.log('   Login (Username) Status:', loginUserRes.status);
        if (loginUserRes.status !== 200) throw new Error('Login with Username failed');
        // Update token just in case
        token = loginUserRes.data.token;

        // 4. Create Expense
        console.log('4. Testing Create Expense...');
        const expenseData = {
            description: 'Test Expense',
            amount: 50.00,
            category: 'Testing',
            date: new Date().toISOString().split('T')[0]
        };
        const createExpRes = await request('/expenses', 'POST', expenseData, token);
        console.log('   Create Expense Status:', createExpRes.status);
        if (createExpRes.status !== 201) throw new Error('Create Expense failed');
        expenseId = createExpRes.data._id;
        console.log('   Created Expense ID:', expenseId);

        // 5. Update Expense (PUT)
        console.log('5. Testing Update Expense...');
        const updateData = {
            description: 'Updated Test Expense',
            amount: 75.00
        };
        const updateExpRes = await request(`/expenses/${expenseId}`, 'PUT', updateData, token);
        console.log('   Update Expense Status:', updateExpRes.status);
        if (updateExpRes.status !== 200) throw new Error('Update Expense failed');
        if (updateExpRes.data.amount !== 75) throw new Error('Update verify failed: Amount mismatch');

        // 6. Get Expenses & Verify Update
        console.log('6. Testing Get Expenses...');
        const getExpRes = await request('/expenses', 'GET', null, token);
        console.log('   Get Expenses Status:', getExpRes.status);
        const fetchedExp = getExpRes.data.find(e => e._id === expenseId);
        if (!fetchedExp) throw new Error('Expense not found in list');
        if (fetchedExp.description !== 'Updated Test Expense') throw new Error('Description update not persisted');
        console.log('   Verified Updated Expense:', fetchedExp.description, fetchedExp.amount);

        // 7. Update Budget
        console.log('7. Testing Update Budget...');
        const budgetRes = await request('/users/budget', 'PUT', { budget: 1000 }, token);
        console.log('   Update Budget Status:', budgetRes.status);

        // 8. Delete Expense
        console.log('8. Testing Delete Expense...');
        const deleteRes = await request(`/expenses/${expenseId}`, 'DELETE', null, token);
        console.log('   Delete Expense Status:', deleteRes.status);

        // Verify Deletion
        const verifyDeleteRes = await request('/expenses', 'GET', null, token);
        const deletedExp = verifyDeleteRes.data.find(e => e._id === expenseId);
        if (deletedExp) throw new Error('Expense still exists after delete');
        console.log('   Verified Deletion.');

        console.log('--- All Tests Passed Successfully! ---');

    } catch (error) {
        console.error('!!! TEST FAILED !!!');
        console.error(error.message);
        process.exit(1);
    }
}

runTests();

const API_URL = 'http://localhost:3000'; // Reverted for local testing

// Auth State
let token = localStorage.getItem('token');
let user = localStorage.getItem('user');
let userBudget = 0;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (token) {
        showDashboard();
    } else {
        showAuth();
    }

    // Set max date to today
    const dateInput = document.getElementById('date');
    if (dateInput) {
        dateInput.max = new Date().toISOString().split('T')[0];
    }
});

// UI Logic
function showTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    if (tab === 'login') {
        document.getElementById('login-form').style.display = 'block';
        document.getElementById('signup-form').style.display = 'none';
    } else {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('signup-form').style.display = 'block';
    }
    document.getElementById('auth-message').textContent = '';
}

function showDashboard() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'flex'; // Changed to flex for full height layout
    document.getElementById('user-display').textContent = user || 'User';
    loadExpenses();
    loadBudget();
}

function showAuth() {
    document.getElementById('auth-section').style.display = 'block';
    document.getElementById('dashboard-section').style.display = 'none';
}

// API Calls
async function signup() {
    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    try {
        const res = await fetch(`${API_URL}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();

        if (res.ok) {
            document.getElementById('auth-message').textContent = 'Signup successful! Please login.';
            // Trigger click on the login tab button to switch view and update UI state
            document.querySelector('.tab-btn[onclick="showTab(\'login\')"]').click();
        } else {
            document.getElementById('auth-message').textContent = data.error;
        }
    } catch (err) {
        console.error(err);
    }
}

async function login() {
    const identifier = document.getElementById('login-identifier').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password })
        });
        const data = await res.json();

        if (res.ok) {
            token = data.token;
            user = data.username;
            localStorage.setItem('token', token);
            localStorage.setItem('user', user);
            showDashboard();
        } else {
            document.getElementById('auth-message').textContent = data.error;
        }
    } catch (err) {
        console.error(err);
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    token = null;
    user = null;
    showAuth();
}

let allExpenses = []; // Store expenses globally

async function loadExpenses() {
    try {
        const res = await fetch(`${API_URL}/expenses`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        allExpenses = await res.json();
        // Sort by date (newest first)
        allExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));
        renderExpenses(allExpenses);
    } catch (err) {
        console.error(err);
    }
}

function renderExpenses(expensesToRender) {
    const list = document.getElementById('expenses-ul');
    const totalSpan = document.getElementById('total-amount');
    list.innerHTML = '';

    let total = 0;

    expensesToRender.forEach(exp => {
        total += parseFloat(exp.amount);
        const li = document.createElement('li');
        li.className = 'expense-item';
        li.id = `expense-${exp.id}`;

        // Format creation date
        const createdDate = new Date(exp.createdAt).toLocaleString();

        // Escape quotes for onclick params
        const safeDesc = exp.description.replace(/'/g, "\\'");
        const safeCat = exp.category.replace(/'/g, "\\'");

        li.innerHTML = `
            <div class="expense-info">
                <strong>${exp.description}</strong>
                <small>${exp.category} • ${createdDate}</small>
            </div>
            <div style="display:flex; align-items:center;">
                <span class="expense-amount">$${exp.amount}</span>
                <div class="expense-actions" id="actions-${exp.id}">
                    <button onclick="enableInlineEdit('${exp.id}', '${safeDesc}', '${exp.amount}', '${safeCat}', '${exp.date}')" class="edit-btn" title="Edit">✎</button>
                    <button onclick="requestDelete('${exp.id}')" title="Delete">✕</button>
                </div>
            </div>
        `;
        list.appendChild(li);
    });

    totalSpan.textContent = total.toFixed(2);
    updateBudgetUI(); // Update progress bar with new total
}

function handleSearch(event) {
    if (event.key === 'Enter') {
        const query = event.target.value.toLowerCase().trim();

        if (!query) {
            renderExpenses(allExpenses);
            return;
        }

        const filtered = allExpenses.filter(exp =>
            exp.description.toLowerCase().includes(query) ||
            exp.category.toLowerCase().includes(query)
        );
        renderExpenses(filtered);
    }
}

function handleSearchInput(event) {
    // Reset if cleared
    if (event.target.value === '') {
        renderExpenses(allExpenses);
    }
}

async function addExpense(e) {
    e.preventDefault();
    const description = document.getElementById('desc').value;
    const amount = document.getElementById('amount').value;
    const category = document.getElementById('category').value;
    const date = document.getElementById('date').value;

    try {
        const res = await fetch(`${API_URL}/expenses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ description, amount, category, date })
        });

        if (res.ok) {
            document.getElementById('expense-form').reset();
            // Reset date to today after reset
            document.getElementById('date').value = new Date().toISOString().split('T')[0];
            loadExpenses();
        }
    } catch (err) {
        console.error(err);
    }
}

function requestDelete(id) {
    const actionsDiv = document.getElementById(`actions-${id}`);
    actionsDiv.innerHTML = `
        <button onclick="deleteExpense('${id}')" class="confirm-btn" title="Confirm">Confirm</button>
        <button onclick="cancelDelete('${id}')" class="cancel-btn" title="Cancel">Cancel</button>
    `;
}

function cancelDelete(id) {
    const actionsDiv = document.getElementById(`actions-${id}`);
    actionsDiv.innerHTML = `
        <button onclick="requestDelete('${id}')" title="Delete">✕</button>
    `;
}

async function deleteExpense(id) {
    // No confirm() prompt needed here anymore
    try {
        const res = await fetch(`${API_URL}/expenses/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            loadExpenses();
        }
    } catch (err) {
        console.error(err);
    }
}

async function loadBudget() {
    try {
        const res = await fetch(`${API_URL}/users/budget`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
            userBudget = data.budget || 0;
            updateBudgetUI();
        }
    } catch (err) {
        console.error(err);
    }
}

function toggleBudgetEdit() {
    const displayWrapper = document.getElementById('budget-display-wrapper');
    const inputWrapper = document.getElementById('budget-input-wrapper');
    const input = document.getElementById('budget-input');

    displayWrapper.style.display = 'none';
    inputWrapper.style.display = 'inline-flex';

    input.value = userBudget;
    input.focus();
}

function handleBudgetInput(event) {
    if (event.key === 'Enter') {
        saveBudget();
    } else if (event.key === 'Escape') {
        cancelBudgetEdit();
    }
}

function cancelBudgetEdit() {
    document.getElementById('budget-display-wrapper').style.display = 'inline-flex';
    document.getElementById('budget-input-wrapper').style.display = 'none';
}

async function saveBudget() {
    const input = document.getElementById('budget-input');
    const newBudget = input.value;

    // Prevent multiple calls (e.g. enter + blur)
    if (input.dataset.saving === 'true') return;

    // If empty or invalid, just cancel
    if (!newBudget || isNaN(newBudget) || parseFloat(newBudget) < 0) {
        cancelBudgetEdit();
        return;
    }

    if (parseFloat(newBudget) === userBudget) {
        cancelBudgetEdit();
        return;
    }

    input.dataset.saving = 'true';

    try {
        const res = await fetch(`${API_URL}/users/budget`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ budget: parseFloat(newBudget) })
        });

        if (res.ok) {
            userBudget = parseFloat(newBudget);
            updateBudgetUI();
        }
    } catch (err) {
        console.error(err);
    } finally {
        input.dataset.saving = 'false';
        cancelBudgetEdit();
    }
}

function updateBudgetUI() {
    // Calculate total spent from global allExpenses array to ensure accuracy even when filtering
    const totalSpent = allExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

    const totalElement = document.getElementById('total-amount');
    // Note: totalElement might show filtered total, but we use totalSpent for budget bar

    document.getElementById('budget-amount').textContent = userBudget.toFixed(2);

    const progressFill = document.getElementById('budget-progress');
    const budgetText = document.getElementById('budget-text');

    let percentage = 0;
    if (userBudget > 0) {
        percentage = (totalSpent / userBudget) * 100;
    }

    // Cap bar width at 100% cleanly
    progressFill.style.width = `${Math.min(percentage, 100)}%`;

    // Remove classes
    progressFill.classList.remove('over-budget', 'warning-budget');

    if (percentage >= 90) {
        progressFill.classList.add('over-budget');
    } else if (percentage >= 75) {
        progressFill.classList.add('warning-budget');
    }

    budgetText.textContent = `Spent $${totalSpent.toFixed(2)} of $${userBudget.toFixed(2)} (${percentage.toFixed(1)}%)`;
}


// Inline Edit Functions
function enableInlineEdit(id, description, amount, category, date) {
    const li = document.getElementById(`expense-${id}`);

    // Format date for input
    const dateObj = new Date(date);
    const formattedDate = dateObj.toISOString().split('T')[0];

    // Escape quotes for values
    const safeDesc = description.replace(/"/g, '&quot;');
    const safeCat = category.replace(/"/g, '&quot;');

    li.innerHTML = `
        <div class="expense-info inline-edit-form">
            <input type="text" id="edit-desc-${id}" value="${safeDesc}" placeholder="Description" class="inline-input">
            <input type="text" id="edit-cat-${id}" value="${safeCat}" placeholder="Category" class="inline-input">
            <input type="date" id="edit-date-${id}" value="${formattedDate}" max="${new Date().toISOString().split('T')[0]}" class="inline-input">
        </div>
        <div style="display:flex; align-items:center; gap: 10px;">
            <input type="number" id="edit-amount-${id}" value="${amount}" step="0.01" class="inline-input-amount">
            <div class="expense-actions">
                <button onclick="saveInlineEdit('${id}')" class="confirm-btn" title="Save">Save</button>
                <button onclick="cancelInlineEdit()" class="cancel-btn" title="Cancel">Cancel</button>
            </div>
        </div>
    `;
}

function cancelInlineEdit() {
    loadExpenses(); // Simply reload to revert
}

async function saveInlineEdit(id) {
    const description = document.getElementById(`edit-desc-${id}`).value;
    const amount = document.getElementById(`edit-amount-${id}`).value;
    const category = document.getElementById(`edit-cat-${id}`).value;
    const date = document.getElementById(`edit-date-${id}`).value;

    try {
        const res = await fetch(`${API_URL}/expenses/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ description, amount, category, date })
        });

        if (res.ok) {
            loadExpenses();
        }
    } catch (err) {
        console.error(err);
    }
}

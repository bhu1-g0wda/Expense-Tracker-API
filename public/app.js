let API_URL = '';
if (window.location.protocol === 'file:' || ((window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') && window.location.port !== '3000')) {
    API_URL = 'http://localhost:3000';
}

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

    // Set default date to today and restrict future dates
    const dateInput = document.getElementById('date');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.max = today;
        dateInput.value = today; // Default to today so form can submit without manual selection
    }
});

// UI Logic
function showTab(tab, event) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');

    if (tab === 'login') {
        document.getElementById('login-form').style.display = 'block';
        document.getElementById('signup-form').style.display = 'none';
    } else {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('signup-form').style.display = 'block';
    }
    document.getElementById('auth-message').textContent = '';
}

// Utility: safely escape HTML to prevent XSS
function escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
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
            // Switch to login tab
            showTab('login', null);
            document.querySelectorAll('.tab-btn').forEach((btn, i) => {
                btn.classList.toggle('active', i === 0);
            });
            // Show success message after switching tabs so it doesn't get cleared
            document.getElementById('auth-message').style.color = 'green';
            document.getElementById('auth-message').textContent = 'Signup successful! Please login.';
        } else {
            document.getElementById('auth-message').style.color = '#ef4444';
            let errMsg = data.error || 'Signup failed';
            if (data.details) errMsg += ': ' + data.details;
            document.getElementById('auth-message').textContent = errMsg;
        }
    } catch (err) {
        console.error(err);
    }
}

async function login() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
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

        // Handle expired/invalid token
        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            token = null;
            user = null;
            showAuth();
            return;
        }

        const data = await res.json();

        // Guard against non-array responses (e.g. error objects)
        if (!Array.isArray(data)) {
            console.error('Unexpected response from /expenses:', data);
            allExpenses = [];
        } else {
            allExpenses = data;
        }

        // Sort by creation date (newest first)
        allExpenses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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

        // Format expense date (the date the task/expense actually occurred)
        let displayDate = 'No date';
        if (exp.date) {
            // Add timezone offset to prevent off-by-one errors when formatting UTC dates
            const d = new Date(exp.date);
            displayDate = new Date(d.getTime() + d.getTimezoneOffset() * 60000).toLocaleDateString();
        } else if (exp.createdAt) {
            displayDate = new Date(exp.createdAt).toLocaleDateString();
        }

        // Split Logic: an expense is a share if it has a splitGroupId but isSplitCreator is falsy.
        const isSplitShare = exp.splitGroupId && !exp.isSplitCreator;

        // Escape quotes for onclick params
        const safeDesc = exp.description.replace(/'/g, "\\'");
        const safeCat = exp.category.replace(/'/g, "\\'");

        // If the expense has splitUsers populated, pass them along
        let splitUsersJson = '[]';
        if (exp.isSplitCreator && exp.splitUsers) {
            // Encode the JSON so that quotes don't break the HTML attribute
            splitUsersJson = encodeURIComponent(JSON.stringify(exp.splitUsers));
        }

        // Only render the action buttons if it's NOT a split share
        const actionsHtml = isSplitShare
            ? ''
            : `<button onclick="enableInlineEdit('${exp.id}', '${safeDesc}', '${exp.amount}', '${safeCat}', '${exp.date}', ${exp.isSplitCreator || false}, '${splitUsersJson}')" class="edit-btn" title="Edit">✎</button>
               <button onclick="requestDelete('${exp.id}')" title="Delete">✕</button>`;

        li.innerHTML = `
            <div class="expense-info">
                <strong>${escapeHTML(exp.description)}</strong>
                <small>${escapeHTML(exp.category)} • ${displayDate}</small>
            </div>
            <div style="display:flex; align-items:center;">
                <span class="expense-amount">$${parseFloat(exp.amount).toFixed(2)}</span>
                <div class="expense-actions" id="actions-${exp.id}">
                    ${actionsHtml}
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

let splitWithUsers = []; // Array of { id, username } to split the expense with
let searchTimeout = null;

async function handleUserSearch(event) {
    const query = event.target.value.trim();
    const resultsContainer = document.getElementById('split-search-results');

    if (query.length < 2) {
        resultsContainer.style.display = 'none';
        return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        try {
            const res = await fetch(`${API_URL}/users/search?query=${encodeURIComponent(query)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const users = await res.json();
                renderSearchResults(users);
            }
        } catch (err) {
            console.error('Error searching users:', err);
        }
    }, 300); // Debounce
}

function renderSearchResults(users) {
    const resultsContainer = document.getElementById('split-search-results');
    resultsContainer.innerHTML = '';

    // Filter out users already selected
    const unselectedUsers = users.filter(u => !splitWithUsers.some(selected => selected.id === u._id));

    if (unselectedUsers.length === 0) {
        resultsContainer.style.display = 'none';
        return;
    }

    unselectedUsers.forEach(u => {
        const li = document.createElement('li');
        li.textContent = u.username;
        li.style.padding = '0.5rem 1rem';
        li.style.cursor = 'pointer';
        li.style.borderBottom = '1px solid #f0f0f0';
        li.onmouseover = () => li.style.backgroundColor = '#f8fafc';
        li.onmouseout = () => li.style.backgroundColor = 'transparent';
        li.onclick = () => selectUserToSplit(u._id, u.username);
        resultsContainer.appendChild(li);
    });

    resultsContainer.style.display = 'block';
}

function selectUserToSplit(id, username) {
    splitWithUsers.push({ id, username });
    renderSelectedUsers();

    // Clear search
    const searchInput = document.getElementById('split-search');
    searchInput.value = '';
    document.getElementById('split-search-results').style.display = 'none';
    searchInput.focus();
}

function removeSplitUser(id) {
    splitWithUsers = splitWithUsers.filter(u => u.id !== id);
    renderSelectedUsers();
}

function renderSelectedUsers() {
    const container = document.getElementById('split-selected-users');
    container.innerHTML = '';

    splitWithUsers.forEach(u => {
        const badge = document.createElement('div');
        badge.style.display = 'inline-flex';
        badge.style.alignItems = 'center';
        badge.style.background = '#e0e7ff';
        badge.style.color = 'var(--primary)';
        badge.style.padding = '0.25rem 0.75rem';
        badge.style.borderRadius = '9999px';
        badge.style.fontSize = '0.85rem';
        badge.style.fontWeight = '500';

        badge.innerHTML = `
            ${escapeHTML(u.username)}
            <button type="button" onclick="removeSplitUser('${u.id}')" style="background: none; border: none; color: var(--primary); margin-left: 5px; font-weight: bold; cursor: pointer; padding: 0;">&times;</button>
        `;
        container.appendChild(badge);
    });
}

// Close search results when clicking outside
document.addEventListener('click', (e) => {
    const searchSection = document.querySelector('.split-section');
    const results = document.getElementById('split-search-results');
    if (searchSection && results && !searchSection.contains(e.target)) {
        results.style.display = 'none';
    }
});

async function addExpense(e) {
    e.preventDefault();
    let description = document.getElementById('desc').value.trim();
    if (description) {
        description = description.charAt(0).toUpperCase() + description.slice(1);
    }
    const amount = parseFloat(document.getElementById('amount').value);
    const category = document.getElementById('category').value.trim();
    const date = document.getElementById('date').value;

    if (!date) {
        alert('Please select a date.');
        return;
    }

    if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid positive amount.');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/expenses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                description,
                amount,
                category,
                date,
                splitWithUsers: splitWithUsers.map(u => u.id)
            })
        });

        if (res.ok) {
            // Save the currently selected date so we don't reset it to today if they are entering a batch for yesterday
            const currentSelectedDate = document.getElementById('date').value;

            document.getElementById('expense-form').reset();

            // Re-apply the selected date instead of forcing today
            document.getElementById('date').value = currentSelectedDate || new Date().toISOString().split('T')[0];

            // Clear split users
            splitWithUsers = [];
            renderSelectedUsers();

            loadExpenses();
        } else {
            let data;
            try {
                data = await res.json();
            } catch (parseErr) {
                // If the response is not JSON (e.g. 404 HTML page), handle it gracefully
                alert(`Failed to add task: Server returned a non-JSON response (Status ${res.status}). Make sure the backend is running.`);
                return;
            }
            alert(`Failed to add task: ${data.error || data.details || 'Unknown error'}`);
        }
    } catch (err) {
        console.error(err);
        alert(`Network error — could not add task. ${err.message}`);
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

    // Find the expense so we can rebuild the edit button with its data
    const exp = allExpenses.find(e => e.id === id || e._id === id);
    if (!exp) {
        // Fallback: reload if expense not found in memory
        loadExpenses();
        return;
    }

    const safeDesc = exp.description.replace(/'/g, "\\'");
    const safeCat = exp.category.replace(/'/g, "\\'");

    // Validate if it is a split share
    const isSplitShare = exp.splitGroupId && !exp.isSplitCreator;

    // Only render the action buttons if it's NOT a split share
    let splitUsersJson = '[]';
    if (exp.isSplitCreator && exp.splitUsers) {
        splitUsersJson = encodeURIComponent(JSON.stringify(exp.splitUsers));
    }
    const actionsHtml = isSplitShare
        ? ''
        : `<button onclick="enableInlineEdit('${exp.id}', '${safeDesc}', '${exp.amount}', '${safeCat}', '${exp.date}', ${exp.isSplitCreator || false}, '${splitUsersJson}')" class="edit-btn" title="Edit">✎</button>
           <button onclick="requestDelete('${id}')" title="Delete">✕</button>`;

    actionsDiv.innerHTML = actionsHtml;
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
            if (data.username) {
                user = data.username;
                localStorage.setItem('user', user);
                document.getElementById('user-display').textContent = user;
            }
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
// We need a global state map to track split edits per row because inline edits can technically happen on multiple rows 
// (though our UI usually just opens one). 
let editSplitUsersMap = {};

function toggleEditSplitUserSearch(id) {
    const searchSection = document.getElementById(`edit-split-section-${id}`);
    if (searchSection.style.display === 'none') {
        searchSection.style.display = 'block';
    } else {
        searchSection.style.display = 'none';
    }
}

async function handleEditUserSearch(event, id) {
    const query = event.target.value.trim();
    const resultsContainer = document.getElementById(`edit-split-search-results-${id}`);

    if (query.length < 2) {
        resultsContainer.style.display = 'none';
        return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        try {
            const res = await fetch(`${API_URL}/users/search?query=${encodeURIComponent(query)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const users = await res.json();
                renderEditSearchResults(users, id);
            }
        } catch (err) {
            console.error('Error searching users:', err);
        }
    }, 300);
}

function renderEditSearchResults(users, objId) {
    const resultsContainer = document.getElementById(`edit-split-search-results-${objId}`);
    resultsContainer.innerHTML = '';

    const currentSplitUsers = editSplitUsersMap[objId] || [];

    // Filter out users already selected in this specific edit row
    const unselectedUsers = users.filter(u => !currentSplitUsers.some(selected => selected.id === u._id || selected._id === u._id));

    if (unselectedUsers.length === 0) {
        resultsContainer.style.display = 'none';
        return;
    }

    unselectedUsers.forEach(u => {
        const li = document.createElement('li');
        li.textContent = u.username;
        li.style.padding = '0.5rem 1rem';
        li.style.cursor = 'pointer';
        li.style.borderBottom = '1px solid #f0f0f0';
        li.onmouseover = () => li.style.backgroundColor = '#f8fafc';
        li.onmouseout = () => li.style.backgroundColor = 'transparent';
        li.onclick = () => selectEditUserToSplit(u._id, u.username, objId);
        resultsContainer.appendChild(li);
    });

    resultsContainer.style.display = 'block';
}

function selectEditUserToSplit(userId, username, objId) {
    if (!editSplitUsersMap[objId]) editSplitUsersMap[objId] = [];
    editSplitUsersMap[objId].push({ _id: userId, username });
    renderEditSelectedUsers(objId);

    const searchInput = document.getElementById(`edit-split-search-${objId}`);
    searchInput.value = '';
    document.getElementById(`edit-split-search-results-${objId}`).style.display = 'none';
}

function removeEditSplitUser(userId, objId) {
    if (editSplitUsersMap[objId]) {
        editSplitUsersMap[objId] = editSplitUsersMap[objId].filter(u => u._id !== userId);
        renderEditSelectedUsers(objId);
    }
}

function renderEditSelectedUsers(objId) {
    const container = document.getElementById(`edit-split-selected-${objId}`);
    if (!container) return;

    container.innerHTML = '';
    const users = editSplitUsersMap[objId] || [];

    users.forEach(u => {
        const badge = document.createElement('div');
        badge.style.display = 'inline-flex';
        badge.style.alignItems = 'center';
        badge.style.background = '#e0e7ff';
        badge.style.color = 'var(--primary)';
        badge.style.padding = '0.2rem 0.5rem';
        badge.style.borderRadius = '9999px';
        badge.style.fontSize = '0.75rem';
        badge.style.fontWeight = '500';

        badge.innerHTML = `
            ${escapeHTML(u.username)}
            <button type="button" onclick="removeEditSplitUser('${u._id}', '${objId}')" style="background: none; border: none; color: var(--primary); margin-left: 5px; font-weight: bold; cursor: pointer; padding: 0;">&times;</button>
        `;
        container.appendChild(badge);
    });
}


function enableInlineEdit(id, description, amount, category, date, isSplitCreator = false, splitUsersJson = '[]') {
    const li = document.getElementById(`expense-${id}`);

    // Format date for input — split the ISO string directly to avoid timezone-shift issues
    const formattedDate = date ? date.split('T')[0] : '';

    // Escape quotes for values
    const safeDesc = description.replace(/"/g, '&quot;');
    const safeCat = category.replace(/"/g, '&quot;');

    let splitHTML = '';

    // If it's a split creator, decode the JSON and setup the split editing UI
    if (isSplitCreator) {
        try {
            const decodedJson = decodeURIComponent(splitUsersJson);
            const initialSplitUsers = JSON.parse(decodedJson);
            editSplitUsersMap[id] = initialSplitUsers;

            splitHTML = `
                <div style="width: 100%; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--glass-border); font-size: 0.85rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <label style="font-weight: 500; color: var(--text-main);">Modify Split Participants:</label>
                        <button onclick="toggleEditSplitUserSearch('${id}')" style="background: none; border: 1px solid #ccc; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">+ Add User</button>
                    </div>
                    
                    <div id="edit-split-selected-${id}" style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 5px;">
                        <!-- Badges injected here -->
                    </div>
                    
                    <div id="edit-split-section-${id}" style="display: none; position: relative; margin-top: 5px;">
                        <input type="text" id="edit-split-search-${id}" placeholder="Search user..." oninput="handleEditUserSearch(event, '${id}')" autocomplete="off" style="width: 100%; padding: 0.4rem; font-size: 0.85rem; border: 1px solid #ccc; border-radius: 4px;">
                        <ul id="edit-split-search-results-${id}" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #ddd; list-style: none; padding: 0; margin: 0; z-index: 100; max-height: 120px; overflow-y: auto; border-radius: 0 0 4px 4px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);"></ul>
                    </div>
                </div>
            `;
        } catch (e) {
            console.error("Failed to parse split users", e);
        }
    }

    li.innerHTML = `
        <div style="flex-direction: column; width: 100%;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; gap: 10px;">
                <div class="expense-info inline-edit-form" style="flex: 1;">
                    <input type="text" id="edit-desc-${id}" value="${safeDesc}" placeholder="Description" class="inline-input">
                    <input type="text" id="edit-cat-${id}" value="${safeCat}" placeholder="Category" class="inline-input">
                    <input type="date" id="edit-date-${id}" value="${formattedDate}" max="${new Date().toISOString().split('T')[0]}" class="inline-input">
                </div>
                <div style="display:flex; align-items:center; gap: 10px;">
                    <input type="number" id="edit-amount-${id}" value="${amount}" step="any" min="0" class="inline-input-amount">
                    <div class="expense-actions">
                        <button onclick="saveInlineEdit('${id}')" class="confirm-btn" title="Save">Save</button>
                        <button onclick="cancelInlineEdit()" class="cancel-btn" title="Cancel">Cancel</button>
                    </div>
                </div>
            </div>
            ${splitHTML}
        </div>
    `;

    // If there were initial splits, render their badges immediately
    if (isSplitCreator) {
        renderEditSelectedUsers(id);
    }
}

function cancelInlineEdit() {
    loadExpenses(); // Simply reload to revert
}

async function saveInlineEdit(id) {
    let description = document.getElementById(`edit-desc-${id}`).value.trim();
    if (description) {
        description = description.charAt(0).toUpperCase() + description.slice(1);
    }
    const amount = parseFloat(document.getElementById(`edit-amount-${id}`).value);
    const category = document.getElementById(`edit-cat-${id}`).value;
    const date = document.getElementById(`edit-date-${id}`).value;

    let splitWithUsers = [];
    if (editSplitUsersMap[id]) {
        splitWithUsers = editSplitUsersMap[id].map(u => u._id || u.id);
    }

    try {
        const res = await fetch(`${API_URL}/expenses/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ description, amount, category, date, splitWithUsers })
        });

        if (res.ok) {
            // Clean up the local memory state
            delete editSplitUsersMap[id];
            loadExpenses();
        }
    } catch (err) {
        console.error(err);
    }
}

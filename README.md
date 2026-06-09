# 💸 Collaborative Expense & Task Tracker

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2018.0.0-blue.svg)](https://nodejs.org/)
[![Express Framework](https://img.shields.io/badge/express-v5.x-lightgrey.svg)](https://expressjs.com/)
[![Firebase Database](https://img.shields.io/badge/firebase-firestore-orange.svg)](https://firebase.google.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Platform: Vercel](https://img.shields.io/badge/platform-vercel-black.svg)](https://vercel.com/)

A modern, full-stack, responsive web application and REST API designed to track tasks and expenses individually or collaboratively. The application features secure token-based user authentication, cooperative cost-splitting (Splitwise-style), visual budget tracking with color-coded alerts, and a detailed Analytics dashboard featuring machine learning-inspired blended forecasting.

Developed using **Node.js, Express, and Firebase Firestore** on the backend, with a highly interactive, responsive **Vanilla HTML5, CSS3, and JavaScript** frontend using **Chart.js**. It is fully pre-configured for serverless deployment on **Vercel**.

---

## 🚀 Key Features

*   **🔐 Secure User Authentication**: JWT token-based authentication (1-hour expiration) with password hashing using `bcryptjs`. Includes validation against duplicate usernames/emails.
*   **➕ Personal Expense & Task Management**: Full CRUD operations for personal items, allowing users to define a description, cost/amount, category, and date.
*   **🤝 Collaborative Expense Splitting**:
    *   Search for other registered users by username.
    *   Create split expenses: The creator pays the full cost, and the bill is divided equally among selected users.
    *   The creator sees the full amount paid, whereas other group members see their exact fractional share under their own dashboards.
    *   **Cascading Updates and Deletes**: Deleting or editing a split expense by the creator automatically propagates changes (recalculating shares, updating info, or removing shares) across all group members using a shared `splitGroupId`.
*   **🎯 Interactive Budgeting & Progress Indicators**:
    *   Set and update a monthly budget.
    *   Dynamic progress bar tracks overall monthly spending against the budget.
    *   Color-coded warning system: Progress bar transitions to yellow (warnings at $\ge$ 75%) or red (alerts at $\ge$ 90%).
*   **📊 Rich Analytics & Business Intelligence Dashboard**:
    *   **Spending by Category**: Interactive `Chart.js` doughnut chart showing visual breakdown, percentages, and custom legend interaction.
    *   **Daily Spending Distribution**: Interactive bar chart displaying spending for each day of the current month. Click on any bar to drill down and see the detailed line-item list of expenses for that specific day.
    *   **Blended Forecasting**: Employs a blended forecasting calculation to predict next month's spending and calculate trend percentages:
        *   60% weight is given to the extrapolation of the current month's daily run-rate.
        *   40% weight is given to the historical average of past months.
    *   **Historical Monthly Comparison**: Continuous monthly line chart comparing totals across the last 6 months.

---

## 🛠️ Technology Stack

*   **Frontend**: HTML5 (Semantic Structure), CSS3 (Modern HSL variables, glassmorphic containers, gradients, animations, full responsive grid layout), Vanilla JavaScript (ES6+, Fetch API, async/await), Chart.js (UMD v4.x).
*   **Backend**: Node.js, Express.js (v5.x), Firebase Admin SDK (Firestore), JSON Web Tokens (`jsonwebtoken`), `bcryptjs` for encryption.
*   **Environment & Testing**: `dotenv` for configuration, `jest` and `supertest` for integration testing, `mongodb-memory-server` and `mongoose` (legacy testing configuration).
*   **Deployment**: Vercel Serverless Functions.

---

## 📂 Project Structure

```text
Expense Tracker/
├── config/
│   └── database.js               # Firebase admin credentials parsing & DB initialization
├── controllers/
│   ├── authController.js         # Signup, login, password checks, JWT generation
│   ├── expenseController.js      # Expense CRUD & complex Splitwise cascade logic
│   └── userController.js         # Budget updates & prefix-based user search
├── middleware/
│   └── authMiddleware.js         # Verify JWT tokens in Authorization headers
├── models/
│   ├── Expense.js                # Exports Firestore 'expenses' collection reference
│   └── User.js                   # Exports Firestore 'users' collection reference
├── public/                       # Frontend Static Web Files
│   ├── analytics.html            # Analytics page (Charts, Drilldown, Forecasting)
│   ├── app.js                    # UI logic, API calls, event handlers, inline editing
│   ├── index.html                # Main App Shell & Login/Dashboard View
│   └── style.css                 # Premium glassmorphic styling, animations & responsive variables
├── tests/
│   └── app.test.js               # Integration test suite (legacy mongoose implementation)
├── .env                          # Local environment secrets (ignored by git)
├── firebase-service-account.json # Firebase Admin SDK Service Account JSON file (ignored by git)
├── package.json                  # Node dependency and script manager
├── server.js                     # Main Express server configuration & Vercel export
└── vercel.json                   # Vercel Serverless configuration routes
```

---

## ⚙️ Configuration & Setup

### Prerequisites
*   Node.js (v18.0.0 or higher)
*   A Firebase project with **Firestore Database** enabled.

### 1. Retrieve Firebase Admin SDK Credentials
1.  Go to the [Firebase Console](https://console.firebase.google.com/).
2.  Navigate to **Project Settings** > **Service accounts**.
3.  Click **Generate new private key** and download the JSON file.
4.  Rename this file to `firebase-service-account.json` and save it directly in the root directory of this project.

### 2. Configure Environment Variables
Create a file named `.env` in the root of the project and add the following variables:

```ini
JWT_SECRET=your_custom_long_jwt_secret_key_here
PORT=3000
```

*Note: For production, you will also need to supply the credentials as a stringified environment variable (see Deployment section).*

### 3. Installation
Install the project dependencies locally:

```bash
npm install
```

---

## 💻 Running the Application

### Development Server
Run the local development server with hot-reloading (via `nodemon`):

```bash
npm run dev
```
The server will start at [http://localhost:3000](http://localhost:3000). The frontend is automatically served from this URL.

### Production Execution
Start the application in production mode:

```bash
npm start
```

---

## 📡 API Endpoints Reference

All endpoints except authentication require a valid JWT token sent in the `Authorization` header as a Bearer token:
`Authorization: Bearer <your_jwt_token>`

### Auth Routes (`/auth`)
| Method | Route | Description | Auth Required | Payload |
| :--- | :--- | :--- | :---: | :--- |
| `POST` | `/auth/signup` | Register a new user | No | `{ username, email, password }` |
| `POST` | `/auth/login` | Login and receive a JWT | No | `{ email, password }` |

### Expense Routes (`/expenses`)
| Method | Route | Description | Auth Required | Payload / Response |
| :--- | :--- | :--- | :---: | :--- |
| `POST` | `/expenses` | Create a personal or split expense | Yes | `{ description, amount, category, date, splitWithUsers: [id1, id2] }` |
| `GET` | `/expenses` | Get all expenses belonging/assigned to user | Yes | Returns array of user and split-share expenses |
| `PUT` | `/expenses/:id` | Update expense details (recalculates split shares if creator) | Yes | `{ description, amount, category, date, splitWithUsers }` |
| `DELETE` | `/expenses/:id` | Delete expense (cascades delete if creator) | Yes | Returns success confirmation message |

### User & Budget Routes (`/users`)
| Method | Route | Description | Auth Required | Payload / Query |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/users/budget` | Fetch authenticated user's budget | Yes | Returns `{ budget, username }` |
| `PUT` | `/users/budget` | Update user's monthly budget | Yes | `{ budget }` |
| `GET` | `/users/search` | Search users by username prefix (min 2 chars) | Yes | Query param: `?query=username_prefix` |

---

## ☁️ Deployment to Vercel

The application is pre-configured to run as serverless functions on Vercel.

1.  Install the Vercel CLI:
    ```bash
    npm install -g vercel
    ```
2.  Link the project and configure environment variables on Vercel:
    ```bash
    vercel link
    ```
3.  Add the environment variables inside your Vercel Dashboard:
    *   `JWT_SECRET`: Your secret key.
    *   `FIREBASE_SERVICE_ACCOUNT`: The **entire contents** of your `firebase-service-account.json` copy-pasted as a single raw JSON string.
4.  Deploy to production:
    ```bash
    vercel --prod
    ```

---

## 🧪 Legacy Test Suite Note

The project contains an integration test suite located at `tests/app.test.js` configured with `jest` and `supertest`. 

> [!WARNING]
> **Database Discrepancy**: The testing file is structured using `mongodb-memory-server` and Mongoose queries (e.g. `User.findOne()`), while the actual application code was migrated to use Firebase Firestore (`firebase-admin`). 
> Due to this migration:
> 1. Running `npm test` directly will fail out-of-the-box because `mongoose` is not declared as a dependency in `package.json`.
> 2. The tests do not mock the Firebase Admin SDK, meaning that importing controllers directly inside the test runner invokes Firestore methods on a MongoDB-backed Mock server.
> 
> To restore test functionality, the test suite needs to be rewritten to mock `firebase-admin` methods or run against a local Firebase Emulator suite.

---

## 📄 License
This project is licensed under the ISC License. See `package.json` for details.


# How to Push Your Project to GitHub

I have already created a `.gitignore` file for you, which is critical. It prevents your `node_modules` (heavy dependencies) and `.env` file (secrets/passwords) from being uploaded to GitHub.

## Step-by-Step Instructions

1.  **Initialize Git**:
    Open your terminal in the project folder (`c:\Users\sampa\OneDrive\Desktop\project\node`) and run:
    ```bash
    git init
    ```

2.  **Add Files**:
    Stage all your files for the commit:
    ```bash
    git add .
    ```

3.  **Commit**:
    Save your changes locally:
    ```bash
    git commit -m "Initial commit of Expense Tracker"
    ```

4.  **Rename Branch**:
    Ensure your main branch is called `main` (GitHub standard):
    ```bash
    git branch -M main
    ```

5.  **Link Repository**:
    *Go to GitHub.com, create a new repository, and copy its URL (e.g., `https://github.com/yourname/expense-tracker.git`).*
    Then run:
    ```bash
    git remote add origin <PASTE_YOUR_REPO_URL_HERE>
    ```

6.  **Push**:
    Upload your code to GitHub:
    ```bash
    git push -u origin main
    ```

## Future Updates
When you make changes later, just run:
1.  `git add .`
2.  `git commit -m "Description of changes"`
3.  `git push`

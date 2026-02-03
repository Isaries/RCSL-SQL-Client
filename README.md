# RCSL SQL Client

A lightweight, secure, and user-friendly SQL client designed specifically for interacting with the RCSL remote database API. This application wraps the raw API endpoints into a modern web interface, providing features like history tracking, quick access management, and an editable data grid.

## Overview

The RCSL SQL Client abstracts the complexity of manually crafting API requests. It provides a local web server (Flask) that serves a responsive frontend, allowing users to execute SQL queries, view results in a formatted table, and manage their workflow efficiently.

Key features include:
- **Web-Based Interface**: A modern, clean interface accessible via any web browser.
- **Secure Configuration**: Credentials are stored locally in a hidden configuration file and are never exposed in the source code or URL parameters.
- **Setup Wizard**: A user-friendly graphical interface for initial configuration.
- **Query History**: Automatically logs all executed queries locally for easy retrieval.
- **Quick Access**: Allows users to save frequently used queries with custom names and reorder them.
- **Editable Grid**: Supports inline editing, row duplication, and deletion for simple tables.
- **Standalone Support**: Can be built into a single executable file for usage without a Python installation.

## Installation and Usage

There are two ways to use this application: running the standalone executable or running from the source code.

> **Important Limitation (Permission Issues)**
>
> Since configuration files and local databases are stored in the same directory as the application, please place the executable in a writable directory such as **Desktop** or **Documents**.
>
> Avoid directories like `C:\Program Files` as restricted write permissions may cause errors when saving configuration or history.

### Method 1: Standalone Executable (Recommended)

This method does not require Python to be installed on your system.

1.  **Download**: Obtain the latest `RCSL-SQL-Client.exe` from the [Releases Page](../../releases/latest).
2.  **Run**: Double-click the executable file.
3.  **Setup**:
    -   The application will automatically open your default web browser.
    -   On the first run, you will be presented with an "Initial Setup" modal.
    -   Enter the API URL, your Username, and Password.
    -   Click "Connect & Save".
4.  **Usage**: You can now start writing and executing SQL queries.

### Method 2: Running from Source

This method requires Python installed on your system.

**Prerequisites:**
-   Python 3.8 or higher
-   Pip (Python Package Installer)

**Steps:**
1.  **Clone or Download**: Download the repository to your local machine.
2.  **Launch**:
    -   Navigate to the project folder.
    -   Double-click the `run.bat` script.
    -   The script will automatically set up a virtual environment, install necessary dependencies, and launch the application.
3.  **Configuration**: Follow the same on-screen Setup Wizard as described in Method 1.

## Features in Detail

### SQL Editor
The main interface features a text area for inputting standard SQL queries.
-   **Run Query**: Executes the SQL command against the remote API.
-   **Clear**: Clears the editor content.
-   Support for keyboard shortcuts (Ctrl+Enter to run).

### Query History
Every successfully executed query is saved to a local SQLite database.
-   The history list is displayed in the sidebar.
-   Clicking a history item inserts it back into the editor.
-   Individual history items can be deleted.

### Quick Access
A section in the sidebar for storing favorite or complex queries.
-   **Add**: Create a new Quick Access item with a custom name.
-   **Edit**: Modify existing items.
-   **Reorder**: Drag and drop items to organize your list.
-   **Context**: Ideal for storing daily reports or complex JOIN queries.

### Editable Grid
When a SELECT query returns data from a single table and includes a unique ID column, the application automatically enables "Edit Mode".
-   **Inline Editing**: Click any cell to edit its value. Changes are saved immediately upon blurring the field.
-   **Add Row**: Click the "Add Row" button to insert a new record.
-   **Duplicate**: Click the copy icon on a row to duplicate its data.
-   **Delete**: Click the trash icon to remove a row.

**Note**: Read-only mode is enforced for queries involving JOINs, lacking an ID column, or using aggregate functions.

## Development and Building

### Project Structure
-   `app.py`: The main Flask backend application.
-   `static/`: Contains CSS, JavaScript, and asset files.
-   `templates/`: Contains HTML templates.
-   `run.bat`: Helper script for one-click startup.
-   `build_exe.bat`: Script to package the application using PyInstaller.

### Building the Executable
To create a standalone executable file from the source code:

1.  Ensure you have Python installed.
2.  Double-click `build_exe.bat`.
3.  The script will install specific dependencies and package the application.
4.  The output file `RCSL-SQL-Client.exe` will be located in the `dist` folder.

### Continuous Integration
This repository is configured with GitHub Actions.
-   Every push to the `main` branch or tag creation triggers an automated build workflow.
-   The workflow sets up the environment, installs dependencies, and builds the executable.


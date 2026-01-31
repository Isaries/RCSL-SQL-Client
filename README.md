# RCSL SQL Client

A lightweight, local web-based SQL client designed to interface securely with the RCSL remote database API. This tool provides a convenient interface for executing queries, managing query history, and saving frequently used SQL commands.

## Features

- **Remote Execution**: Securely send SQL commands to the RCSL API.
- **Local History**: Automatically saves executed queries to a local SQLite database for easy retrieval.
- **Quick Access**: Save and categorize frequently used SQL snippets for rapid execution.
- **Secure Configuration**: Uses environment variables to manage sensitive credentials, ensuring they are never hardcoded in the source code.
- **User-Friendly Interface**: A clean web interface built with Flask and Vanilla JavaScript.

## Prerequisites

- Python 3.8 or higher
- pip (Python package installer)

## Installation

1. Clone this repository to your local machine.
2. Create value virtual environment (recommended):
   ```bash
   python -m venv venv
   # Windows
   .\venv\Scripts\activate
   # macOS/Linux
   source venv/bin/activate
   ```
3. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Configuration

1. Create a `.env` file in the root directory. You can use `.env.example` as a template:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in your RCSL API credentials:
   ```env
   API_URL="https://example.com/api"
   DEFAULT_USER="your_username"
   DEFAULT_PASS="your_password"
   ```

   **Note:** The `.env` file is excluded from version control to protect your credentials.

## Usage

1. Start the application:
   ```bash
   python app.py
   ```
2. Open your web browser and navigate to:
   ```
   http://127.0.0.1:5000
   ```
3. Enter your SQL query in the text area and click "Execute".

## Project Structure

- `app.py`: Main Flask application entry point.
- `debug_api.py`: Utility script for testing API connectivity and troubleshooting.
- `static/`: Contains CSS and JavaScript files for the frontend.
- `templates/`: Contains HTML templates.
- `local_data.db`: Local SQLite database for storing history and quick access items (created on first run).

## Security

This application is designed to be run locally. Do not deploy this to a public server without adding authentication mechanisms (e.g., login functionality), as it allows arbitrary SQL execution on the configured database connection.

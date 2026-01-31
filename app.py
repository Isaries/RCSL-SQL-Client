from flask import Flask, render_template, request, jsonify, g
import requests
import sqlite3
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Configuration
API_URL = os.getenv("API_URL")
DEFAULT_USER = os.getenv("DEFAULT_USER")
DEFAULT_PASS = os.getenv("DEFAULT_PASS")


DATABASE = 'local_data.db'

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    with app.app_context():
        db = get_db()
        # Create tables
        db.execute('''
            CREATE TABLE IF NOT EXISTS local_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sql_query TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        db.execute('''
            CREATE TABLE IF NOT EXISTS local_quick_access (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                sql_query TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                sort_order INTEGER DEFAULT 0
            )
        ''')
        
        # Migration: Add sort_order if not exists
        try:
            db.execute('ALTER TABLE local_quick_access ADD COLUMN sort_order INTEGER DEFAULT 0')
        except sqlite3.OperationalError:
            # Column likely already exists
            pass

        db.commit()

# Initialize DB on start
init_db()

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/execute', methods=['POST'])
def execute_sql():
    data = request.json
    sql = data.get('sql')
    
    if not sql:
        return jsonify({'error': 'No SQL provided'}), 400

    try:
        # TODO: Move credentials to environment variables
        # Use POST to ensure data modification commands (INSERT, UPDATE, DELETE) are committed.
        response = requests.post(
            API_URL, 
            json={'sql': sql},
            auth=(DEFAULT_USER, DEFAULT_PASS)
        )
        
        # Try to parse JSON response from the API
        try:
            result = response.json()
            # FIX: External API wraps data in "result" key. Unwrap it for the frontend.
            if isinstance(result, dict) and 'result' in result:
                result = result['result']
            
            return jsonify({'data': result})
        except ValueError:
            # If response is not JSON (e.g. error string), return as text
            return jsonify({'data': response.text})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Local Data APIs ---

# History API
@app.route('/api/history', methods=['GET'])
def get_history():
    db = get_db()
    # Get last 50 items, newest first
    cur = db.execute('SELECT id, sql_query as sql, timestamp FROM local_history ORDER BY id DESC LIMIT 50')
    return jsonify( [dict(row) for row in cur.fetchall()] )

@app.route('/api/history', methods=['POST'])
def add_history():
    data = request.json
    sql = data.get('sql')
    if not sql: return jsonify({'error': 'Missing sql'}), 400
    
    db = get_db()
    # Prevent duplicate sequential entries (optional, but good UX)
    last = db.execute('SELECT sql_query FROM local_history ORDER BY id DESC LIMIT 1').fetchone()
    if last and last['sql_query'] == sql:
        return jsonify({'status': 'ignored_duplicate'})

    db.execute('INSERT INTO local_history (sql_query) VALUES (?)', (sql,))
    db.commit()
    
    # Optional: Prune old history > 50? 
    # For now, let's keep it simple or implement pruning trigger
    return jsonify({'status': 'success'})

@app.route('/api/history/<int:id>', methods=['DELETE'])
def delete_history(id):
    db = get_db()
    db.execute('DELETE FROM local_history WHERE id = ?', (id,))
    db.commit()
    return jsonify({'status': 'deleted'})

# Quick Access API
@app.route('/api/quick_access', methods=['GET'])
def get_quick_access():
    db = get_db()
    # Sort by sort_order ASC, then created_at ASC
    cur = db.execute('SELECT id, name, sql_query as sql, sort_order FROM local_quick_access ORDER BY sort_order ASC, created_at ASC')
    return jsonify( [dict(row) for row in cur.fetchall()] )

@app.route('/api/quick_access', methods=['POST'])
def add_quick_access():
    data = request.json
    name = data.get('name')
    sql = data.get('sql')
    
    if not name or not sql: return jsonify({'error': 'Missing fields'}), 400
    
    db = get_db()
    try:
        # Get max sort_order to append to end
        cur = db.execute('SELECT MAX(sort_order) FROM local_quick_access')
        max_order = cur.fetchone()[0]
        next_order = (max_order + 1) if max_order is not None else 0

        db.execute('INSERT INTO local_quick_access (name, sql_query, sort_order) VALUES (?, ?, ?)', (name, sql, next_order))
        db.commit()
        return jsonify({'status': 'success'})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Name already exists'}), 409

@app.route('/api/quick_access/reorder', methods=['PUT'])
def reorder_quick_access():
    data = request.json
    ids = data.get('ids') # List of IDs in new order
    
    if not ids or not isinstance(ids, list):
        return jsonify({'error': 'Invalid data'}), 400
        
    db = get_db()
    # Transactional update
    for index, item_id in enumerate(ids):
        db.execute('UPDATE local_quick_access SET sort_order = ? WHERE id = ?', (index, item_id))
    
    db.commit()
    return jsonify({'status': 'reordered'})

@app.route('/api/quick_access/<int:id>', methods=['PUT'])
def update_quick_access(id):
    data = request.json
    name = data.get('name')
    sql = data.get('sql')
    
    if not name or not sql: return jsonify({'error': 'Missing fields'}), 400
    
    db = get_db()
    try:
        db.execute('UPDATE local_quick_access SET name = ?, sql_query = ? WHERE id = ?', (name, sql, id))
        db.commit()
        return jsonify({'status': 'updated'})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Name already exists'}), 409

@app.route('/api/quick_access/<int:id>', methods=['DELETE'])
def delete_quick_access(id):
    db = get_db()
    db.execute('DELETE FROM local_quick_access WHERE id = ?', (id,))
    db.commit()
    return jsonify({'status': 'deleted'})

if __name__ == '__main__':
    app.run(debug=True, port=5000)

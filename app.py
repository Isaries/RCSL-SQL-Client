from flask import Flask, render_template, request, jsonify, g
import requests
import sqlite3
import os
import ctypes
import sys
import re
import webbrowser
import threading
from dotenv import load_dotenv

load_dotenv()

# Resource Path Helper for PyInstaller (bundled files)
def resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    if getattr(sys, 'frozen', False):
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    else:
        base_path = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_path, relative_path)

if getattr(sys, 'frozen', False):
    app = Flask(__name__, 
                template_folder=resource_path('templates'),
                static_folder=resource_path('static'))
else:
    app = Flask(__name__)

# Configuration
import sys

# PyInstaller Path Helper
def get_base_path():
    """ Get absolute path to resource, works for dev and for PyInstaller """
    # If frozen (exe), use the executable's directory for data files (.env, .db)
    # NOT _MEIPASS, because we want persistence.
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

def check_write_permission():
    """Check if the directory is writable. If not, show error and exit."""
    base_path = get_base_path()
    test_file = os.path.join(base_path, '.perm_test')
    try:
        with open(test_file, 'w') as f:
            f.write('test')
        os.remove(test_file)
    except (PermissionError, OSError):
        # Only show GUI error if on Windows
        if os.name == 'nt':
            ctypes.windll.user32.MessageBoxW(
                0, 
                u"無法寫入檔案！\n\n請不要將此程式放在 'C:\\Program Files' 或其他受保護的資料夾。\n"
                u"建議：請將 .exe 移至【桌面】或【我的文件】重新執行。", 
                u"權限錯誤 (Permission Error)", 
                0x10 | 0x1
            )
        print("CRITICAL: No write permission in directory. Exiting.")
        sys.exit(1)

# Config Helper
def get_config():
    """Reloads config from .env each time"""
    env_path = os.path.join(get_base_path(), '.env')
    load_dotenv(env_path, override=True)
    return {
        'API_URL': os.getenv("API_URL"),
        'DEFAULT_USER': os.getenv("DEFAULT_USER"),
        'DEFAULT_PASS': os.getenv("DEFAULT_PASS")
    }

DATABASE = os.path.join(get_base_path(), 'local_data.db')

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
        db.execute('''
            CREATE TABLE IF NOT EXISTS saved_connections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                api_url TEXT NOT NULL,
                username TEXT NOT NULL,
                password TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
            # Migration: Add sort_order if not exists
        try:
            db.execute('ALTER TABLE local_quick_access ADD COLUMN sort_order INTEGER DEFAULT 0')
        except sqlite3.OperationalError:
            pass

        db.commit()

# Initialize DB on start
init_db()

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/status', methods=['GET'])
def get_status():
    conf = get_config()
    is_configured = all([conf['API_URL'], conf['DEFAULT_USER'], conf['DEFAULT_PASS']])
    return jsonify({'configured': is_configured})

@app.route('/api/setup', methods=['POST'])
def setup_config():
    data = request.json
    api_url = data.get('api_url')
    user = data.get('username')
    password = data.get('password')
    
    if not all([api_url, user, password]):
        return jsonify({'error': 'Missing fields'}), 400
        
    env_path = os.path.join(get_base_path(), '.env')
    
    # Check if .env exists, if not create it
    if not os.path.exists(env_path):
        with open(env_path, 'w', encoding='utf-8') as f:
            f.write('') # Create empty file

    # Write variables (Simple approach: Rewrite file or Replace lines)
    # Since this is a simple app, we can just overwrite/rewrite for simplicity
    # but to preserve comments, we might want to be careful. 
    # For now, let's just write the 3 lines we need, ensuring they exist.
    
    lines = []
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

    new_lines = []
    keys_written = set()
    
    for line in lines:
        if re.match(r'^\s*API_URL\s*=', line):
            new_lines.append(f'API_URL="{api_url}"\n')
            keys_written.add('API_URL')
        elif re.match(r'^\s*DEFAULT_USER\s*=', line):
            new_lines.append(f'DEFAULT_USER="{user}"\n')
            keys_written.add('DEFAULT_USER')
        elif re.match(r'^\s*DEFAULT_PASS\s*=', line):
            new_lines.append(f'DEFAULT_PASS="{password}"\n')
            keys_written.add('DEFAULT_PASS')
        else:
            new_lines.append(line)
            
    # Append if missing
    if 'API_URL' not in keys_written:
        new_lines.append(f'\nAPI_URL="{api_url}"\n')
    if 'DEFAULT_USER' not in keys_written:
        new_lines.append(f'DEFAULT_USER="{user}"\n')
    if 'DEFAULT_PASS' not in keys_written:
        new_lines.append(f'DEFAULT_PASS="{password}"\n')
        
    with open(env_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
        
    # Reload immediately
    load_dotenv(env_path, override=True)
    
    return jsonify({'status': 'saved'})

@app.route('/api/execute', methods=['POST'])
def execute_sql():
    data = request.json
    sql = data.get('sql')
    
    if not sql:
        return jsonify({'error': 'No SQL provided'}), 400

    try:
        conf = get_config()
        if not conf['API_URL'] or not conf['DEFAULT_USER'] or not conf['DEFAULT_PASS']:
             return jsonify({'error': 'System not configured. Please reload and run setup.'}), 401
             
        # Use POST to ensure data modification commands (INSERT, UPDATE, DELETE) are committed.
        response = requests.post(
            conf['API_URL'], 
            json={'sql': sql},
            auth=(conf['DEFAULT_USER'], conf['DEFAULT_PASS'])
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
    try:
        check_write_permission()
        
        # Open browser automatically
        # Check if frozen (exe) or if this is the main process (not reloader) to avoid double open
        if getattr(sys, 'frozen', False) or not os.environ.get("WERKZEUG_RUN_MAIN"):
            threading.Timer(1.5, lambda: webbrowser.open('http://127.0.0.1:5000')).start()

        # Disable debug in EXE to prevent reloader and other issues
        isDebug = not getattr(sys, 'frozen', False)
        app.run(debug=isDebug, port=5000)
    except Exception as e:
        import traceback
        error_msg = traceback.format_exc()
        if os.name == 'nt':
            ctypes.windll.user32.MessageBoxW(0, u"程式發生錯誤無法啟動：\n\n" + error_msg, u"啟動錯誤", 0x10)
        raise e

# Connection Profiles API
@app.route('/api/connections', methods=['GET'])
def get_connections():
    db = get_db()
    cur = db.execute('SELECT id, name, api_url, username, password FROM saved_connections ORDER BY created_at ASC')
    return jsonify([dict(row) for row in cur.fetchall()])

@app.route('/api/connections', methods=['POST'])
def save_connection():
    data = request.json
    name = data.get('name')
    api_url = data.get('api_url')
    username = data.get('username')
    password = data.get('password')
    
    if not all([name, api_url, username, password]):
        return jsonify({'error': 'Missing fields'}), 400
        
    db = get_db()
    try:
        existing = db.execute('SELECT id FROM saved_connections WHERE name = ?', (name,)).fetchone()
        if existing:
            db.execute('''
                UPDATE saved_connections 
                SET api_url=?, username=?, password=?
                WHERE name=?
            ''', (api_url, username, password, name))
        else:
            db.execute('''
                INSERT INTO saved_connections (name, api_url, username, password)
                VALUES (?, ?, ?, ?)
            ''', (name, api_url, username, password))
            
        db.commit()
        return jsonify({'status': 'saved'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/connections/<int:id>', methods=['DELETE'])
def delete_connection(id):
    db = get_db()
    db.execute('DELETE FROM saved_connections WHERE id = ?', (id,))
    db.commit()
    return jsonify({'status': 'deleted'})

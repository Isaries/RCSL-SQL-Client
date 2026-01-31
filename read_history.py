import sqlite3
import pandas as pd

try:
    conn = sqlite3.connect('local_data.db')
    cursor = conn.cursor()
    
    print("--- Local History (Last 10) ---")
    cursor.execute("SELECT sql_query FROM local_history ORDER BY id DESC LIMIT 10")
    rows = cursor.fetchall()
    for row in rows:
        print(row[0])
        
    print("\n--- Quick Access Items ---")
    cursor.execute("SELECT name, sql_query FROM local_quick_access")
    rows = cursor.fetchall()
    for row in rows:
        print(f"[{row[0]}]: {row[1]}")
        
    conn.close()
except Exception as e:
    print(f"Error: {e}")

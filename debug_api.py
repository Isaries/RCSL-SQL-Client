import requests
import json

import os
from dotenv import load_dotenv

load_dotenv()

API_URL = os.getenv("API_URL")
DEFAULT_USER = os.getenv("DEFAULT_USER")
DEFAULT_PASS = os.getenv("DEFAULT_PASS")

def run_sql(sql):
    print(f"Executing: {sql}")
    try:
        response = requests.get(
            API_URL, 
            params={'sql': sql},
            auth=(DEFAULT_USER, DEFAULT_PASS)
        )
        print(f"Status Code: {response.status_code}")
        print(f"Response Text: {response.text}")
        try:
            return response.json()
        except:
            return None
    except Exception as e:
        print(f"Error: {e}")
        return None

# Test 1: Connectivity
print("--- Test 1: SELECT 1 ---")
run_sql("SELECT 1 as val")

# Test 2: Create valid table (if permissible) or just check a known table?
# I'll try to create a temp table.
# Test 5: Context Check
print("\n--- Test 5: Context Check ---")

def run_sql_post(sql):
    try:
        response = requests.post(
            API_URL, 
            json={'sql': sql},
            auth=(DEFAULT_USER, DEFAULT_PASS)
        )
        print(f"Status Code: {response.status_code}")
        print(f"Response Text: {response.text}")
        return response
    except Exception as e:
        print(f"Error: {e}")
        return None

print("1. GET Context")
run_sql("SELECT DATABASE() as db, USER() as user, @@hostname as host, @@port as port")

print("2. POST Context")
run_sql_post("SELECT DATABASE() as db, USER() as user, @@hostname as host, @@port as port")

print("3. SELECT via POST")
run_sql_post("SELECT 1 as val")

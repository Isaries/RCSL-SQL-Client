import pytest
from app import app
import json

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_persistence(client):
    table_name = "FJHS_EGC.verify_fix_test_123"
    
    print(f"\n1. Create Table {table_name}")
    created = client.post('/api/execute', json={'sql': f"CREATE TABLE IF NOT EXISTS {table_name} (id INT, val VARCHAR(20))"})
    print(f"   Create Response: {created.json}")
    
    print(f"2. Insert Data")
    inserted = client.post('/api/execute', json={'sql': f"INSERT INTO {table_name} (id, val) VALUES (1, 'A')"})
    print(f"   Insert Response: {inserted.json}")
    
    print(f"3. Verify Data (Should be 'A')")
    select1 = client.post('/api/execute', json={'sql': f"SELECT val FROM {table_name} WHERE id=1"})
    print(f"   Select 1 Response: {select1.json}")
    
    # Check if we got data
    data1 = select1.json.get('data', [])
    if data1 and len(data1) > 0 and data1[0].get('val') == 'A':
        print("   SUCCESS: INSERT Persisted.")
    else:
        print("   FAILURE: INSERT did not persist.")

    print(f"4. Testing UPDATE (A -> B)")
    updated = client.post('/api/execute', json={'sql': f"UPDATE {table_name} SET val='B' WHERE id=1"})
    print(f"   Update Response: {updated.json}")

    print(f"5. Verify UPDATE")
    select2 = client.post('/api/execute', json={'sql': f"SELECT val FROM {table_name} WHERE id=1"})
    print(f"   Select 2 Response: {select2.json}")

    data2 = select2.json.get('data', [])
    if data2 and len(data2) > 0 and data2[0].get('val') == 'B':
        print("   SUCCESS: UPDATE Persisted.")
    else:
        print("   FAILURE: UPDATE did not persist (Got {0}).".format(data2[0].get('val') if data2 else 'None'))

    print(f"6. Cleanup")
    client.post('/api/execute', json={'sql': f"DROP TABLE {table_name}"})

if __name__ == "__main__":
    # Manual run wrapper
    try:
        c = app.test_client()
        test_persistence(c)
    except Exception as e:
        print(f"Error: {e}")

import sqlite3
import json
from datetime import datetime

def export_sqlite_data(sqlite_file, output_file):
    conn = sqlite3.connect(sqlite_file)
    cursor = conn.cursor()
    
    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [table[0] for table in cursor.fetchall()]
    
    exported_data = {}
    
    for table_name in tables:
        print(f"Exporting table: {table_name}")
        
        # Get table schema
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns_info = cursor.fetchall()
        
        # Get all data
        cursor.execute(f"SELECT * FROM {table_name}")
        rows = cursor.fetchall()
        
        exported_data[table_name] = {
            'schema': columns_info,
            'data': rows
        }
        
        print(f"  - {len(rows)} rows exported")
    
    # Save to JSON
    with open(output_file, 'w') as f:
        json.dump(exported_data, f, default=str, indent=2)
    
    conn.close()
    print(f"\nData exported to {output_file}")

# Run the export
export_sqlite_data('studentmanagement.db', 'sqlite_export.json')
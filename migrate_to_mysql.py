import mysql.connector
import sqlite3
from datetime import datetime, date
import sys

def sqlite_to_mysql_direct(sqlite_file, mysql_password):
    try:
        # Connect to SQLite
        print("🔌 Connecting to SQLite database...")
        sqlite_conn = sqlite3.connect(sqlite_file)
        sqlite_cursor = sqlite_conn.cursor()
        
        # Connect to MySQL on PythonAnywhere
        print("🔌 Connecting to PythonAnywhere MySQL...")
        mysql_conn = mysql.connector.connect(
            host='bcranston.mysql.pythonanywhere-services.com',
            user='bcranston',
            password=mysql_password,
            database='bcranston$studentmanagement',
            port=3306,
            connection_timeout=30,
            autocommit=False
        )
        mysql_cursor = mysql_conn.cursor()
        
        # Disable foreign key checks for easier import
        mysql_cursor.execute("SET FOREIGN_KEY_CHECKS=0")
        mysql_cursor.execute("SET SESSION sql_mode = 'NO_AUTO_VALUE_ON_ZERO'")
        
        # Get SQLite tables
        sqlite_cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [table[0] for table in sqlite_cursor.fetchall()]
        
        print(f"📋 Found {len(tables)} tables to migrate: {tables}")
        
        for table_name in tables:
            print(f"\n📊 Processing table: {table_name}")
            
            # Drop existing MySQL table if it exists
            mysql_cursor.execute(f"DROP TABLE IF EXISTS `{table_name}`")
            print(f"   ✅ Dropped existing table (if any)")
            
            # Get SQLite table structure
            sqlite_cursor.execute(f"PRAGMA table_info({table_name})")
            columns = sqlite_cursor.fetchall()
            
            # Build MySQL CREATE TABLE statement
            mysql_columns = []
            for col in columns:
                col_name = col[1]
                col_type = col[2].upper()
                not_null = col[3]
                default_val = col[4]
                primary_key = col[5]
                
                # Convert SQLite types to MySQL types
                if primary_key and col_type == 'INTEGER':
                    mysql_type = "INT AUTO_INCREMENT PRIMARY KEY"
                elif col_type == 'INTEGER':
                    mysql_type = "INT"
                elif col_type == 'TEXT':
                    mysql_type = "TEXT"
                elif col_type == 'REAL':
                    mysql_type = "DECIMAL(10,2)"
                elif col_type == 'BLOB':
                    mysql_type = "LONGBLOB"
                elif 'VARCHAR' in col_type:
                    mysql_type = col_type  # Keep VARCHAR as is
                else:
                    mysql_type = "TEXT"  # Default fallback
                
                column_def = f"`{col_name}` {mysql_type}"
                
                # Add NOT NULL constraint (but not for primary keys as they're already handled)
                if not_null and not primary_key:
                    column_def += " NOT NULL"
                
                # Add default value if specified
                if default_val is not None and not primary_key:
                    if isinstance(default_val, str):
                        column_def += f" DEFAULT '{default_val}'"
                    else:
                        column_def += f" DEFAULT {default_val}"
                
                mysql_columns.append(column_def)
            
            # Create table
            create_sql = f"CREATE TABLE `{table_name}` ({', '.join(mysql_columns)})"
            print(f"   🔨 Creating table with SQL: {create_sql}")
            mysql_cursor.execute(create_sql)
            
            # Get data from SQLite
            sqlite_cursor.execute(f"SELECT * FROM {table_name}")
            rows = sqlite_cursor.fetchall()
            
            if rows:
                # Get column count for placeholders
                placeholders = ', '.join(['%s' for _ in range(len(columns))])
                insert_sql = f"INSERT INTO `{table_name}` VALUES ({placeholders})"
                
                # Convert data for MySQL compatibility
                converted_rows = []
                for row in rows:
                    converted_row = []
                    for value in row:
                        if isinstance(value, (datetime, date)):
                            converted_row.append(str(value))
                        elif value is None:
                            converted_row.append(None)
                        else:
                            converted_row.append(value)
                    converted_rows.append(tuple(converted_row))
                
                # Insert data in batches for better performance
                batch_size = 1000
                for i in range(0, len(converted_rows), batch_size):
                    batch = converted_rows[i:i + batch_size]
                    mysql_cursor.executemany(insert_sql, batch)
                
                print(f"   ✅ Inserted {len(rows)} rows")
            else:
                print(f"   ℹ️  No data to insert")
        
        # Re-enable foreign key checks
        mysql_cursor.execute("SET FOREIGN_KEY_CHECKS=1")
        
        # Commit all changes
        mysql_conn.commit()
        
        print("\n🎉 Migration completed successfully!")
        
        # Verify the migration
        print("\n📋 Verification - Tables in MySQL:")
        mysql_cursor.execute("SHOW TABLES")
        mysql_tables = mysql_cursor.fetchall()
        
        for table in mysql_tables:
            table_name = table[0]
            mysql_cursor.execute(f"SELECT COUNT(*) FROM `{table_name}`")
            count = mysql_cursor.fetchone()[0]
            print(f"   📊 {table_name}: {count} rows")
        
    except sqlite3.Error as e:
        print(f"❌ SQLite Error: {e}")
        return False
    except mysql.connector.Error as e:
        print(f"❌ MySQL Error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected Error: {e}")
        return False
    finally:
        # Close connections
        if 'sqlite_conn' in locals():
            sqlite_conn.close()
        if 'mysql_conn' in locals():
            mysql_conn.close()
    
    return True

def main():
    # Configuration
    sqlite_file = 'db.sqlite3'  # Your local SQLite database file
    
    # Get MySQL password
    mysql_password = input("Enter your PythonAnywhere MySQL password: ")
    
    if not mysql_password:
        print("❌ Password is required!")
        return
    
    # Check if SQLite file exists
    try:
        with open(sqlite_file, 'r'):
            pass
    except FileNotFoundError:
        print(f"❌ SQLite file '{sqlite_file}' not found!")
        print("Make sure the file exists in the current directory or update the sqlite_file variable.")
        return
    
    # Run migration
    success = sqlite_to_mysql_direct(sqlite_file, mysql_password)
    
    if success:
        print("\n✅ Your SQLite database has been successfully migrated to PythonAnywhere MySQL!")
        print("You can now use your MySQL database in your applications.")
    else:
        print("\n❌ Migration failed. Please check the error messages above.")

if __name__ == "__main__":
    main()
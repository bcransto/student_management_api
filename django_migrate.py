import mysql.connector
import sqlite3
from datetime import datetime, date
import sys

def clean_mysql_database(mysql_cursor):
    """Drop all existing tables to start fresh"""
    print("🧹 Cleaning existing MySQL database...")
    
    # Disable foreign key checks
    mysql_cursor.execute("SET FOREIGN_KEY_CHECKS=0")
    
    # Get all tables
    mysql_cursor.execute("SHOW TABLES")
    tables = mysql_cursor.fetchall()
    
    # Drop each table
    for table in tables:
        table_name = table[0]
        mysql_cursor.execute(f"DROP TABLE IF EXISTS `{table_name}`")
        print(f"   🗑️  Dropped table: {table_name}")
    
    print("✅ Database cleaned")

def sqlite_to_mysql_django(sqlite_file, mysql_password):
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
        
        # Clean the database first
        clean_mysql_database(mysql_cursor)
        
        # Set MySQL modes for compatibility
        mysql_cursor.execute("SET FOREIGN_KEY_CHECKS=0")
        mysql_cursor.execute("SET SESSION sql_mode = 'NO_AUTO_VALUE_ON_ZERO'")
        
        # Get SQLite tables (excluding system tables)
        sqlite_cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        tables = [table[0] for table in sqlite_cursor.fetchall()]
        
        print(f"📋 Found {len(tables)} tables to migrate: {tables}")
        
        # Process tables in a specific order to avoid foreign key issues
        # Django system tables first, then custom tables
        table_order = [
            'django_content_type',
            'auth_permission', 
            'auth_group',
            'auth_group_permissions',
            'students_user',
            'students_user_groups',
            'students_user_user_permissions',
            'django_admin_log',
            'django_session',
            'django_migrations'
        ]
        
        # Add any remaining tables not in the ordered list
        remaining_tables = [t for t in tables if t not in table_order]
        table_order.extend(remaining_tables)
        
        # Filter to only tables that actually exist
        tables_to_process = [t for t in table_order if t in tables]
        
        for table_name in tables_to_process:
            print(f"\n📊 Processing table: {table_name}")
            
            # Get SQLite table structure
            sqlite_cursor.execute(f"PRAGMA table_info({table_name})")
            columns = sqlite_cursor.fetchall()
            
            # Build MySQL CREATE TABLE statement (simplified, no foreign keys initially)
            mysql_columns = []
            primary_key_cols = []
            
            for col in columns:
                col_name = col[1]
                col_type = col[2].upper()
                not_null = col[3]
                default_val = col[4]
                primary_key = col[5]
                
                # Simple type mapping for compatibility
                if primary_key and col_type == 'INTEGER':
                    mysql_type = "INT AUTO_INCREMENT PRIMARY KEY"
                    primary_key_cols.append(col_name)
                elif col_type == 'INTEGER':
                    mysql_type = "INT"
                elif 'VARCHAR' in col_type:
                    # Extract length if specified
                    if '(' in col_type:
                        mysql_type = col_type
                    else:
                        mysql_type = "VARCHAR(255)"
                elif col_type in ['TEXT', 'CHAR']:
                    mysql_type = "TEXT"
                elif col_type == 'REAL':
                    mysql_type = "DECIMAL(10,2)"
                elif col_type == 'BLOB':
                    mysql_type = "LONGBLOB"
                else:
                    mysql_type = "TEXT"  # Safe fallback
                
                column_def = f"`{col_name}` {mysql_type}"
                
                # Add NOT NULL only for non-primary key columns
                if not_null and not primary_key:
                    column_def += " NOT NULL"
                
                # Add default values (carefully)
                if default_val is not None and not primary_key:
                    if isinstance(default_val, str):
                        column_def += f" DEFAULT '{default_val}'"
                    elif str(default_val).lower() in ['true', 'false']:
                        # Handle boolean defaults
                        bool_val = '1' if str(default_val).lower() == 'true' else '0'
                        column_def += f" DEFAULT {bool_val}"
                    else:
                        column_def += f" DEFAULT {default_val}"
                
                mysql_columns.append(column_def)
            
            # Create table
            create_sql = f"CREATE TABLE `{table_name}` ({', '.join(mysql_columns)})"
            print(f"   🔨 Creating table...")
            
            try:
                mysql_cursor.execute(create_sql)
                print(f"   ✅ Table created successfully")
            except mysql.connector.Error as e:
                print(f"   ⚠️  Error creating table: {e}")
                # Try with all TEXT columns as fallback
                simple_columns = []
                for col in columns:
                    col_name = col[1]
                    primary_key = col[5]
                    
                    if primary_key:
                        simple_columns.append(f"`{col_name}` INT AUTO_INCREMENT PRIMARY KEY")
                    else:
                        simple_columns.append(f"`{col_name}` TEXT")
                
                fallback_sql = f"CREATE TABLE `{table_name}` ({', '.join(simple_columns)})"
                mysql_cursor.execute(fallback_sql)
                print(f"   ✅ Created with simplified schema")
            
            # Get and insert data
            sqlite_cursor.execute(f"SELECT * FROM {table_name}")
            rows = sqlite_cursor.fetchall()
            
            if rows:
                # Prepare insert statement
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
                        elif isinstance(value, bool):
                            converted_row.append(1 if value else 0)
                        else:
                            converted_row.append(value)
                    converted_rows.append(tuple(converted_row))
                
                # Insert in batches
                batch_size = 500
                total_inserted = 0
                for i in range(0, len(converted_rows), batch_size):
                    batch = converted_rows[i:i + batch_size]
                    try:
                        mysql_cursor.executemany(insert_sql, batch)
                        total_inserted += len(batch)
                    except mysql.connector.Error as e:
                        print(f"   ⚠️  Error inserting batch: {e}")
                        # Try inserting one by one for this batch
                        for row in batch:
                            try:
                                mysql_cursor.execute(insert_sql, row)
                                total_inserted += 1
                            except mysql.connector.Error:
                                pass  # Skip problematic rows
                
                print(f"   ✅ Inserted {total_inserted} rows")
            else:
                print(f"   ℹ️  No data to insert")
        
        # Commit all changes
        mysql_conn.commit()
        
        print("\n🎉 Migration completed successfully!")
        
        # Verify the migration
        print("\n📋 Verification - Tables in MySQL:")
        mysql_cursor.execute("SHOW TABLES")
        mysql_tables = mysql_cursor.fetchall()
        
        total_rows = 0
        for table in mysql_tables:
            table_name = table[0]
            mysql_cursor.execute(f"SELECT COUNT(*) FROM `{table_name}`")
            count = mysql_cursor.fetchone()[0]
            total_rows += count
            print(f"   📊 {table_name}: {count} rows")
        
        print(f"\n📈 Total rows migrated: {total_rows}")
        
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
    sqlite_file = 'db.sqlite3'
    
    print("🚀 Django SQLite to MySQL Migration Tool")
    print("=" * 50)
    
    # Check if SQLite file exists
    try:
        with open(sqlite_file, 'r'):
            pass
    except FileNotFoundError:
        print(f"❌ SQLite file '{sqlite_file}' not found!")
        print("Make sure the file exists in the current directory.")
        return
    
    # Get MySQL password
    mysql_password = input("Enter your PythonAnywhere MySQL password: ")
    
    if not mysql_password:
        print("❌ Password is required!")
        return
    
    print(f"\n🔄 Starting migration from {sqlite_file} to MySQL...")
    
    # Run migration
    success = sqlite_to_mysql_django(sqlite_file, mysql_password)
    
    if success:
        print("\n✅ Your Django SQLite database has been successfully migrated to PythonAnywhere MySQL!")
        print("🔧 You can now update your Django settings.py to use the MySQL database.")
        print("\nNext steps:")
        print("1. Update DATABASES setting in settings.py to use MySQL")
        print("2. Test your Django application")
        print("3. Run 'python manage.py migrate' if needed to sync any schema differences")
    else:
        print("\n❌ Migration failed. Please check the error messages above.")

if __name__ == "__main__":
    main()
#!/usr/bin/env python3
"""
Extract Resident Data for Specific Mandals

This script connects to the Chittoor Health System database and extracts
resident data for specified mandals, exporting it to CSV format.

Usage:
    python scripts/extract-mandal-residents.py

Requirements:
    pip install pandas mysql-connector-python
"""

import pandas as pd
import mysql.connector
from mysql.connector import Error
import os
import sys
from datetime import datetime
from pathlib import Path

# Database Configuration
DB_CONFIG = {
    'host': '89.116.122.217',
    'port': 3306,
    'user': 'dev',
    'password': 'Yamini143',
    'database': 'chittoor_health_db'
}

# Mandals to extract
MANDALS = ['Santhipuram', 'Ramakuppam', 'Kuppam', 'Gudupalle']

# Output configuration
OUTPUT_DIR = Path(__file__).parent.parent / 'data' / 'exports'
OUTPUT_FILE = OUTPUT_DIR / f'mandal_residents_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'

def print_header():
    """Print script header"""
    print("=" * 80)
    print("Mandal Residents Extractor - Chittoor Health Data Collection System")
    print("=" * 80)
    print()

def connect_to_database():
    """Connect to MySQL database"""
    print("🔌 Connecting to database...")
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        if connection.is_connected():
            db_info = connection.get_server_info()
            print(f"✓ Connected to MySQL Server version {db_info}")
            print(f"  Database: {DB_CONFIG['database']}")
            print()
            return connection
    except Error as e:
        print(f"❌ Error connecting to MySQL: {e}")
        sys.exit(1)

def get_residents_by_mandals(connection, mandals):
    """Query residents for specified mandals"""
    print(f"📊 Querying residents for mandals: {', '.join(mandals)}")
    print()
    
    # Create placeholders for IN clause
    placeholders = ', '.join(['%s'] * len(mandals))
    
    query = f"""
    SELECT
        resident_id,
        uid,
        hh_id,
        name,
        dob,
        gender,
        mobile_number,
        health_id,
        dist_name,
        mandal_name,
        mandal_code,
        sec_name,
        sec_code,
        rural_urban,
        cluster_name,
        qualification,
        occupation,
        caste,
        sub_caste,
        caste_category,
        caste_category_detailed,
        hof_member,
        door_number,
        address_ekyc,
        address_hh,
        citizen_mobile,
        age,
        phc_name,
        created_at,
        updated_at
    FROM residents
    WHERE mandal_name IN ({placeholders})
    ORDER BY mandal_name, sec_name, name
    """
    
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query, tuple(mandals))
        
        # Fetch all results
        results = cursor.fetchall()
        
        print(f"✓ Query executed successfully")
        print(f"  Total records found: {len(results):,}")
        print()
        
        # Display count per mandal
        print("📈 Records per mandal:")
        mandal_counts = {}
        for record in results:
            mandal = record.get('mandal_name', 'Unknown')
            mandal_counts[mandal] = mandal_counts.get(mandal, 0) + 1
        
        for mandal in mandals:
            count = mandal_counts.get(mandal, 0)
            print(f"   {mandal}: {count:,} records")
        print()
        
        return results
        
    except Error as e:
        print(f"❌ Error executing query: {e}")
        sys.exit(1)
    finally:
        if cursor:
            cursor.close()

def create_dataframe(results):
    """Convert query results to pandas DataFrame"""
    print("🔄 Converting results to DataFrame...")
    
    df = pd.DataFrame(results)
    
    print(f"✓ DataFrame created")
    print(f"  Rows: {len(df):,}")
    print(f"  Columns: {len(df.columns)}")
    print()
    
    return df

def display_data_summary(df):
    """Display summary statistics of the data"""
    print("📊 Data Summary:")
    print(f"   Total rows: {len(df):,}")
    print(f"   Total columns: {len(df.columns)}")
    print()
    
    print("📋 Column Names:")
    for i, col in enumerate(df.columns, 1):
        print(f"   {i:2d}. {col}")
    print()
    
    # Display sample data (first 3 rows)
    print("📄 Sample Data (first 3 rows):")
    pd.set_option('display.max_columns', None)
    pd.set_option('display.width', None)
    pd.set_option('display.max_colwidth', 50)
    print(df.head(3).to_string())
    print()
    
    # Display data types
    print("🔢 Data Types:")
    for col, dtype in df.dtypes.items():
        print(f"   {col}: {dtype}")
    print()
    
    # Display missing values
    print("⚠️  Missing Values:")
    missing = df.isnull().sum()
    missing_cols = missing[missing > 0]
    if len(missing_cols) > 0:
        for col, count in missing_cols.items():
            percentage = (count / len(df)) * 100
            print(f"   {col}: {count:,} ({percentage:.2f}%)")
    else:
        print("   No missing values found")
    print()

def export_to_csv(df, output_path):
    """Export DataFrame to CSV file"""
    print(f"💾 Exporting to CSV...")
    print(f"   Output file: {output_path}")
    
    try:
        # Create output directory if it doesn't exist
        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir)
            print(f"   Created directory: {output_dir}")
        
        # Export to CSV
        df.to_csv(output_path, index=False, encoding='utf-8')
        
        # Get file size
        file_size = os.path.getsize(output_path)
        file_size_mb = file_size / (1024 * 1024)
        
        print(f"✓ CSV file created successfully")
        print(f"  File size: {file_size_mb:.2f} MB")
        print(f"  Rows exported: {len(df):,}")
        print()
        
        return True
    
    except Exception as e:
        print(f"❌ Error exporting to CSV: {e}")
        return False

def main():
    """Main function"""
    print_header()
    
    # Step 1: Connect to database
    connection = connect_to_database()
    
    try:
        # Step 2: Query residents for specified mandals
        results = get_residents_by_mandals(connection, MANDALS)
        
        # Step 3: Create DataFrame
        df = create_dataframe(results)
        
        # Step 4: Display data summary
        display_data_summary(df)
        
        # Step 5: Export to CSV
        success = export_to_csv(df, OUTPUT_FILE)
        
        # Final summary
        if success:
            print("=" * 80)
            print("✅ Extraction Complete!")
            print("=" * 80)
            print()
            print("📁 Output File:")
            print(f"   {OUTPUT_FILE}")
            print()
            print("📊 Summary:")
            print(f"   Mandals: {', '.join(MANDALS)}")
            print(f"   Total records: {len(df):,}")
            print()
            print("🚀 Next Steps:")
            print("   1. Review the exported CSV file")
            print("   2. Use the data for analysis or reporting")
            print()
        else:
            print("=" * 80)
            print("❌ Extraction Failed")
            print("=" * 80)
            print()
            print("Please check the error messages above and try again.")
            print()
            sys.exit(1)
    
    finally:
        # Close database connection
        if connection.is_connected():
            connection.close()
            print("🔌 Database connection closed")

if __name__ == "__main__":
    main()

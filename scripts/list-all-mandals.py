#!/usr/bin/env python3
"""
List All Mandal Names from CSV

This script reads the Chittoor_merged_complete.csv file and displays
all unique mandal names with their record counts.

Usage:
    python scripts/list-all-mandals.py
"""

import pandas as pd
import os
import sys
from pathlib import Path

# File Configuration
INPUT_CSV_PATH = Path(__file__).parent.parent.parent / 'data' / 'Chittoor_merged_complete.csv'

def print_header():
    """Print script header"""
    print("=" * 80)
    print("List All Mandals - Chittoor Health Data Collection System")
    print("=" * 80)
    print()

def validate_file_exists(file_path):
    """Validate that the input file exists"""
    if not os.path.exists(file_path):
        print(f"❌ Error: File not found: {file_path}")
        sys.exit(1)
    
    file_size = os.path.getsize(file_path)
    file_size_mb = file_size / (1024 * 1024)
    print(f"✓ Input file found: {file_path}")
    print(f"  File size: {file_size_mb:.2f} MB")
    print()

def read_csv_file(file_path):
    """Read CSV file into DataFrame"""
    print("📂 Reading CSV file...")
    
    try:
        df = pd.read_csv(file_path)
        
        print(f"✓ CSV file loaded successfully")
        print(f"  Total rows: {len(df):,}")
        print(f"  Total columns: {len(df.columns)}")
        print()
        
        return df
    
    except Exception as e:
        print(f"❌ Error reading CSV file: {e}")
        sys.exit(1)

def find_mandal_column(df):
    """Find the column containing mandal names"""
    print("🔍 Searching for mandal column...")
    
    possible_columns = [
        'mandal_name',
        'mandalName',
        'Mandal Name',
        'Mandal',
        'mandal',
        'MANDAL_NAME',
        'MANDAL'
    ]
    
    mandal_column = None
    
    for col in possible_columns:
        if col in df.columns:
            mandal_column = col
            print(f"✓ Found mandal column: '{col}'")
            break
    
    if mandal_column is None:
        print(f"❌ Could not find mandal column")
        sys.exit(1)
    
    print()
    return mandal_column

def list_all_mandals(df, mandal_column):
    """List all unique mandals with counts"""
    print("📊 All Mandals:")
    print("-" * 80)
    print(f"{'#':<4} {'Mandal Name':<40} {'Resident Count':>15}")
    print("-" * 80)
    
    mandal_counts = df[mandal_column].value_counts().sort_index()
    
    for i, (mandal, count) in enumerate(mandal_counts.items(), 1):
        print(f"{i:<4} {str(mandal):<40} {count:>15,}")
    
    print("-" * 80)
    print(f"{'Total':<44} {len(df):>15,}")
    print()

def main():
    """Main function"""
    print_header()
    
    # Validate input file
    validate_file_exists(INPUT_CSV_PATH)
    
    # Read CSV file
    df = read_csv_file(INPUT_CSV_PATH)
    
    # Find mandal column
    mandal_column = find_mandal_column(df)
    
    # List all mandals
    list_all_mandals(df, mandal_column)
    
    print("=" * 80)
    print("✅ Complete!")
    print("=" * 80)
    print()

if __name__ == "__main__":
    main()

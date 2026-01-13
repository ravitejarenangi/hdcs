#!/usr/bin/env python3
"""
Extract Resident Data from CSV for Specific Mandals

This script reads the Chittoor_merged_complete.csv file and extracts
resident data for specified mandals, exporting it to CSV format.

Usage:
    python scripts/extract-mandal-residents-from-csv.py

Requirements:
    pip install pandas
"""

import pandas as pd
import os
import sys
from pathlib import Path
from datetime import datetime

# File Configuration
INPUT_CSV_PATH = Path(__file__).parent.parent.parent / 'data' / 'Chittoor_merged_complete.csv'
OUTPUT_DIR = Path(__file__).parent.parent.parent / 'data' / 'exports'
OUTPUT_FILE = OUTPUT_DIR / f'mandal_residents_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'

# Mandals to extract (using exact names from CSV)
MANDALS = ['SANTHI PURAM', 'RAMA KUPPAM', 'KUPPAM', 'GUDI PALLE']

def print_header():
    """Print script header"""
    print("=" * 80)
    print("Mandal Residents Extractor from CSV - Chittoor Health Data Collection System")
    print("=" * 80)
    print()

def validate_file_exists(file_path):
    """Validate that the input file exists"""
    if not os.path.exists(file_path):
        print(f"❌ Error: File not found: {file_path}")
        print(f"   Please ensure the file exists at the specified location.")
        sys.exit(1)
    
    file_size = os.path.getsize(file_path)
    file_size_mb = file_size / (1024 * 1024)
    print(f"✓ Input file found: {file_path}")
    print(f"  File size: {file_size_mb:.2f} MB")
    print()

def read_csv_file(file_path):
    """Read CSV file into DataFrame"""
    print("📂 Reading CSV file...")
    print(f"   Loading: {file_path}")
    print()
    
    try:
        # Read CSV file
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
    
    # Possible column names for mandal
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
        print(f"⚠️  Warning: Could not find mandal column")
        print(f"   Tried: {', '.join(possible_columns)}")
        print(f"   Available columns: {', '.join(df.columns[:10])}{'...' if len(df.columns) > 10 else ''}")
        print()
        print("📋 All available columns:")
        for i, col in enumerate(df.columns, 1):
            print(f"   {i:2d}. {col}")
        print()
        sys.exit(1)
    
    print()
    return mandal_column

def get_unique_mandals(df, mandal_column):
    """Get all unique mandal names from the dataset"""
    print("📊 Getting unique mandal names...")
    
    unique_mandals = df[mandal_column].dropna().unique()
    unique_mandals = sorted([str(m).strip() for m in unique_mandals if str(m).strip()])
    
    print(f"✓ Found {len(unique_mandals)} unique mandal(s)")
    print()
    
    return unique_mandals

def search_exact_mandals(unique_mandals, search_terms):
    """Search for exact mandal matches"""
    print("🔍 Searching for exact mandal matches: " + ", ".join(search_terms))
    print()
    
    search_terms_upper = [term.upper() for term in search_terms]
    exact_matches = []
    
    for mandal in unique_mandals:
        if mandal.upper() in search_terms_upper:
            exact_matches.append(mandal)
    
    if exact_matches:
        print("✓ Found exact mandal(s):")
        for i, mandal in enumerate(exact_matches, 1):
            print(f"   {i}. {mandal}")
        print()
        return exact_matches
    else:
        print("⚠️  No exact mandal matches found")
        print()
        return []

def filter_by_mandals(df, mandal_column, mandals):
    """Filter DataFrame by specified mandals"""
    print(f"🔍 Filtering data for mandals: {', '.join(mandals)}")
    print()
    
    # Filter by mandal names (case-insensitive)
    mask = df[mandal_column].str.upper().isin([m.upper() for m in mandals])
    filtered_df = df[mask].copy()
    
    print(f"✓ Filter completed")
    print(f"  Rows before filtering: {len(df):,}")
    print(f"  Rows after filtering: {len(filtered_df):,}")
    print()
    
    # Display count per mandal
    print("📈 Records per mandal:")
    mandal_counts = filtered_df[mandal_column].value_counts().sort_index()
    for mandal in mandals:
        count = 0
        for m, c in mandal_counts.items():
            if m.upper() == mandal.upper():
                count = c
                break
        print(f"   {mandal}: {count:,} records")
    print()
    
    return filtered_df

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
    
    # Step 1: Validate input file
    validate_file_exists(INPUT_CSV_PATH)
    
    # Step 2: Read CSV file
    df = read_csv_file(INPUT_CSV_PATH)
    
    # Step 3: Find mandal column
    mandal_column = find_mandal_column(df)
    
    # Step 4: Get unique mandals
    unique_mandals = get_unique_mandals(df, mandal_column)
    
    # Step 5: Search for exact mandal matches
    exact_mandals = search_exact_mandals(unique_mandals, MANDALS)
    
    if not exact_mandals:
        print("❌ No matching mandals found. Please check the mandal names.")
        print()
        print("💡 Available mandals:")
        for i, mandal in enumerate(unique_mandals[:20], 1):
            print(f"   {i:2d}. {mandal}")
        if len(unique_mandals) > 20:
            print(f"   ... and {len(unique_mandals) - 20} more")
        print()
        sys.exit(1)
    
    # Step 6: Filter by mandals
    filtered_df = filter_by_mandals(df, mandal_column, exact_mandals)
    
    if len(filtered_df) == 0:
        print("❌ No records found for the specified mandals")
        sys.exit(1)
    
    # Step 7: Display data summary
    display_data_summary(filtered_df)
    
    # Step 8: Export to CSV
    success = export_to_csv(filtered_df, OUTPUT_FILE)
    
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
        print(f"   Mandals: {', '.join(exact_mandals)}")
        print(f"   Total records: {len(filtered_df):,}")
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

if __name__ == "__main__":
    main()

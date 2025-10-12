#!/usr/bin/env python3
"""
Excel to CSV Converter for Chittoor Health Data Collection System

This script reads an Excel file with multiple worksheets, merges them into a single dataset,
removes duplicates, and exports to CSV format for importing into the database.

Usage:
    python scripts/convert_excel_to_csv.py

Requirements:
    pip install pandas openpyxl
"""

import pandas as pd
import os
import sys
from pathlib import Path

# Configuration
EXCEL_FILE_PATH = "/Users/raviteja/dev-space/drda/data/Chittoor_patient_details.xlsx"
OUTPUT_CSV_PATH = "/Users/raviteja/dev-space/drda/data/Chittoor_patient_details_merged.csv"
# Try multiple possible column names for resident ID
RESIDENT_ID_COLUMNS = ["resident ID", "resident_id", "residentId", "resident_ID"]

def print_header():
    """Print script header"""
    print("=" * 80)
    print("Excel to CSV Converter - Chittoor Health Data Collection System")
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

def read_excel_worksheets(file_path):
    """Read all worksheets from the Excel file"""
    print("📂 Reading Excel file...")
    print(f"   Loading: {file_path}")
    print()
    
    try:
        # Read Excel file and get all sheet names
        excel_file = pd.ExcelFile(file_path)
        sheet_names = excel_file.sheet_names
        
        print(f"✓ Found {len(sheet_names)} worksheet(s):")
        for i, sheet_name in enumerate(sheet_names, 1):
            print(f"   {i}. {sheet_name}")
        print()
        
        # Read all worksheets into a dictionary
        worksheets = {}
        for sheet_name in sheet_names:
            print(f"📊 Reading worksheet: '{sheet_name}'...")
            df = pd.read_excel(file_path, sheet_name=sheet_name)
            worksheets[sheet_name] = df
            print(f"   Rows: {len(df):,}")
            print(f"   Columns: {len(df.columns)}")
            print(f"   Column names: {', '.join(df.columns[:5])}{'...' if len(df.columns) > 5 else ''}")
            print()
        
        return worksheets
    
    except Exception as e:
        print(f"❌ Error reading Excel file: {e}")
        sys.exit(1)

def validate_worksheet_structure(worksheets):
    """Validate that all worksheets have the same column structure"""
    print("🔍 Validating worksheet structure...")
    
    if len(worksheets) == 0:
        print("❌ Error: No worksheets found in the Excel file")
        sys.exit(1)
    
    # Get column names from the first worksheet
    first_sheet_name = list(worksheets.keys())[0]
    first_columns = list(worksheets[first_sheet_name].columns)
    
    # Check if all worksheets have the same columns
    all_same = True
    for sheet_name, df in worksheets.items():
        if list(df.columns) != first_columns:
            print(f"⚠️  Warning: Worksheet '{sheet_name}' has different columns")
            print(f"   Expected: {first_columns}")
            print(f"   Found: {list(df.columns)}")
            all_same = False
    
    if all_same:
        print(f"✓ All worksheets have the same column structure ({len(first_columns)} columns)")
        print(f"  Columns: {', '.join(first_columns[:10])}{'...' if len(first_columns) > 10 else ''}")
    else:
        print("⚠️  Warning: Worksheets have different column structures")
        print("   The script will proceed, but please verify the output.")
    
    print()
    return all_same

def merge_worksheets(worksheets):
    """Merge all worksheets into a single DataFrame"""
    print("🔄 Merging worksheets...")
    
    # Concatenate all DataFrames
    merged_df = pd.concat(worksheets.values(), ignore_index=True)
    
    print(f"✓ Merged {len(worksheets)} worksheet(s)")
    print(f"  Total rows: {len(merged_df):,}")
    print(f"  Total columns: {len(merged_df.columns)}")
    print()
    
    return merged_df

def remove_duplicates(df, id_columns):
    """Remove duplicate rows based on the specified ID column(s)"""
    print(f"🔍 Checking for duplicates...")

    # Find which ID column exists
    id_column = None
    if isinstance(id_columns, str):
        id_columns = [id_columns]

    for col in id_columns:
        if col in df.columns:
            id_column = col
            print(f"   Using column: '{id_column}'")
            break

    # Check if any ID column exists
    if id_column is None:
        print(f"⚠️  Warning: None of the expected ID columns found in the data")
        print(f"   Tried: {', '.join(id_columns)}")
        print(f"   Available columns: {', '.join(df.columns[:10])}{'...' if len(df.columns) > 10 else ''}")
        print(f"   Skipping duplicate removal.")
        print()
        return df
    
    # Count rows before removing duplicates
    rows_before = len(df)
    
    # Remove duplicates, keeping the first occurrence
    df_deduplicated = df.drop_duplicates(subset=[id_column], keep='first')
    
    # Count rows after removing duplicates
    rows_after = len(df_deduplicated)
    duplicates_removed = rows_before - rows_after
    
    if duplicates_removed > 0:
        print(f"✓ Removed {duplicates_removed:,} duplicate row(s)")
        print(f"  Rows before: {rows_before:,}")
        print(f"  Rows after: {rows_after:,}")
    else:
        print(f"✓ No duplicates found")
        print(f"  Total rows: {rows_after:,}")
    
    print()
    return df_deduplicated

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
    validate_file_exists(EXCEL_FILE_PATH)
    
    # Step 2: Read all worksheets
    worksheets = read_excel_worksheets(EXCEL_FILE_PATH)
    
    # Step 3: Validate worksheet structure
    validate_worksheet_structure(worksheets)
    
    # Step 4: Merge worksheets
    merged_df = merge_worksheets(worksheets)
    
    # Step 5: Remove duplicates
    deduplicated_df = remove_duplicates(merged_df, RESIDENT_ID_COLUMNS)
    
    # Step 6: Display data summary
    display_data_summary(deduplicated_df)
    
    # Step 7: Export to CSV
    success = export_to_csv(deduplicated_df, OUTPUT_CSV_PATH)
    
    # Final summary
    if success:
        print("=" * 80)
        print("✅ Conversion Complete!")
        print("=" * 80)
        print()
        print("📁 Output File:")
        print(f"   {OUTPUT_CSV_PATH}")
        print()
        print("🚀 Next Steps:")
        print("   1. Verify the CSV file contents")
        print("   2. Use the CLI import tool to import the data:")
        print()
        print("      cd chittoor-health-system")
        print("      npm run import:residents -- \\")
        print(f"        --merged {OUTPUT_CSV_PATH} \\")
        print("        --dry-run")
        print()
        print("   3. If validation passes, run actual import:")
        print()
        print("      npm run import:residents -- \\")
        print(f"        --merged {OUTPUT_CSV_PATH} \\")
        print("        --mode add_update")
        print()
    else:
        print("=" * 80)
        print("❌ Conversion Failed")
        print("=" * 80)
        print()
        print("Please check the error messages above and try again.")
        print()
        sys.exit(1)

if __name__ == "__main__":
    main()


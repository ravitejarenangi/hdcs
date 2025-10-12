#!/usr/bin/env python3
"""
Excel to CSV Converter Script
Converts PHCMaster.xlsx to PHCMaster.csv

Usage:
    python scripts/convert-phc-master-to-csv.py
    
Requirements:
    pip install pandas openpyxl
"""

import os
import sys
import pandas as pd
from pathlib import Path

# File paths
INPUT_FILE = "/Users/raviteja/dev-space/drda/data/PHCMaster.xlsx"
OUTPUT_FILE = "/Users/raviteja/dev-space/drda/data/PHCMaster.csv"

def print_separator():
    """Print a separator line"""
    print("=" * 80)

def print_header():
    """Print script header"""
    print_separator()
    print("📊 Excel to CSV Converter")
    print("Converting PHCMaster.xlsx to PHCMaster.csv")
    print_separator()

def check_file_exists(file_path):
    """Check if file exists"""
    if not os.path.exists(file_path):
        print(f"❌ ERROR: File not found: {file_path}")
        return False
    return True

def get_file_size(file_path):
    """Get file size in human-readable format"""
    size_bytes = os.path.getsize(file_path)
    
    if size_bytes < 1024:
        return f"{size_bytes} bytes"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.2f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.2f} MB"

def list_excel_sheets(file_path):
    """List all sheets in the Excel file"""
    try:
        excel_file = pd.ExcelFile(file_path)
        sheets = excel_file.sheet_names
        print(f"\n📋 Found {len(sheets)} sheet(s) in Excel file:")
        for i, sheet in enumerate(sheets, 1):
            print(f"   {i}. {sheet}")
        return sheets
    except Exception as e:
        print(f"❌ ERROR: Failed to read Excel file: {e}")
        return None

def convert_excel_to_csv(input_path, output_path, sheet_name=None):
    """
    Convert Excel file to CSV
    
    Args:
        input_path: Path to input Excel file
        output_path: Path to output CSV file
        sheet_name: Name or index of sheet to convert (default: first sheet)
    
    Returns:
        True if successful, False otherwise
    """
    try:
        print(f"\n📖 Reading Excel file: {input_path}")
        print(f"   File size: {get_file_size(input_path)}")
        
        # Read Excel file
        if sheet_name is None:
            # Read first sheet by default
            df = pd.read_excel(input_path, sheet_name=0)
            excel_file = pd.ExcelFile(input_path)
            sheet_name = excel_file.sheet_names[0]
            print(f"   Using first sheet: '{sheet_name}'")
        else:
            df = pd.read_excel(input_path, sheet_name=sheet_name)
            print(f"   Using sheet: '{sheet_name}'")
        
        # Display data info
        print(f"\n📊 Data Information:")
        print(f"   Rows: {len(df):,}")
        print(f"   Columns: {len(df.columns)}")
        print(f"\n📝 Column Names:")
        for i, col in enumerate(df.columns, 1):
            print(f"   {i}. {col}")
        
        # Display first few rows
        print(f"\n👀 Preview (first 3 rows):")
        print(df.head(3).to_string(index=False))
        
        # Convert to CSV
        print(f"\n💾 Writing CSV file: {output_path}")
        df.to_csv(output_path, index=False, encoding='utf-8')
        
        # Verify output file
        if os.path.exists(output_path):
            output_size = get_file_size(output_path)
            print(f"   Output file size: {output_size}")
            print(f"\n✅ SUCCESS: CSV file created successfully!")
            print(f"   Output: {output_path}")
            return True
        else:
            print(f"❌ ERROR: Output file was not created")
            return False
            
    except FileNotFoundError:
        print(f"❌ ERROR: Input file not found: {input_path}")
        return False
    except PermissionError:
        print(f"❌ ERROR: Permission denied. Check file permissions.")
        return False
    except Exception as e:
        print(f"❌ ERROR: Conversion failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main function"""
    print_header()
    
    # Check if input file exists
    print(f"\n🔍 Checking input file...")
    if not check_file_exists(INPUT_FILE):
        print(f"\n💡 TIP: Make sure the Excel file exists at:")
        print(f"   {INPUT_FILE}")
        sys.exit(1)
    
    print(f"✅ Input file found: {INPUT_FILE}")
    
    # List sheets in Excel file
    sheets = list_excel_sheets(INPUT_FILE)
    if sheets is None:
        sys.exit(1)
    
    # Determine which sheet to convert
    sheet_to_convert = None
    if len(sheets) > 1:
        print(f"\n❓ Multiple sheets found. Converting first sheet by default.")
        print(f"   To convert a different sheet, modify the script.")
        sheet_to_convert = 0  # First sheet
    else:
        sheet_to_convert = 0  # First sheet
    
    # Convert Excel to CSV
    success = convert_excel_to_csv(INPUT_FILE, OUTPUT_FILE, sheet_name=sheet_to_convert)
    
    # Print summary
    print_separator()
    if success:
        print("✅ CONVERSION COMPLETE!")
        print(f"\n📁 Files:")
        print(f"   Input:  {INPUT_FILE}")
        print(f"   Output: {OUTPUT_FILE}")
        print(f"\n🚀 Next Steps:")
        print(f"   1. Verify the CSV file: cat {OUTPUT_FILE} | head -n 5")
        print(f"   2. Import the CSV into your application")
    else:
        print("❌ CONVERSION FAILED!")
        print(f"\n💡 Troubleshooting:")
        print(f"   1. Check if the Excel file is not open in another program")
        print(f"   2. Verify you have read/write permissions")
        print(f"   3. Ensure pandas and openpyxl are installed:")
        print(f"      pip install pandas openpyxl")
    print_separator()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    # Check if required libraries are installed
    try:
        import pandas as pd
    except ImportError:
        print("❌ ERROR: pandas library not found")
        print("💡 Install it with: pip install pandas openpyxl")
        sys.exit(1)
    
    main()


#!/usr/bin/env python3
"""
Check Existing Mandals in Database

This script queries the database to find all unique mandal names
to help identify the correct mandal names for extraction.
"""

import mysql.connector
from mysql.connector import Error

# Database Configuration
DB_CONFIG = {
    'host': '89.116.122.217',
    'port': 3306,
    'user': 'dev',
    'password': 'Yamini143',
    'database': 'chittoor_health_db'
}

def print_header():
    """Print script header"""
    print("=" * 80)
    print("Check Existing Mandals - Chittoor Health Data Collection System")
    print("=" * 80)
    print()

def connect_to_database():
    """Connect to MySQL database"""
    print("🔌 Connecting to database...")
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        if connection.is_connected():
            print(f"✓ Connected to database: {DB_CONFIG['database']}")
            print()
            return connection
    except Error as e:
        print(f"❌ Error connecting to MySQL: {e}")
        return None

def get_unique_mandals(connection):
    """Query all unique mandal names"""
    print("📊 Querying unique mandal names...")
    print()
    
    query = """
    SELECT DISTINCT mandal_name, COUNT(*) as resident_count
    FROM residents
    WHERE mandal_name IS NOT NULL AND mandal_name != ''
    GROUP BY mandal_name
    ORDER BY mandal_name
    """
    
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query)
        
        results = cursor.fetchall()
        
        print(f"✓ Found {len(results)} unique mandal(s)")
        print()
        
        return results
        
    except Error as e:
        print(f"❌ Error executing query: {e}")
        return []
    finally:
        if cursor:
            cursor.close()

def display_mandals(mandals):
    """Display mandal information"""
    print("📋 Available Mandals:")
    print("-" * 80)
    print(f"{'Mandal Name':<40} {'Resident Count':>15}")
    print("-" * 80)
    
    for i, mandal in enumerate(mandals, 1):
        mandal_name = mandal.get('mandal_name', 'Unknown')
        count = mandal.get('resident_count', 0)
        print(f"{i:3d}. {mandal_name:<37} {count:>15,}")
    
    print("-" * 80)
    print(f"{'Total':<40} {sum(m.get('resident_count', 0) for m in mandals):>15,}")
    print()

def search_similar_mandals(mandals, search_terms):
    """Search for mandals similar to the search terms"""
    print("🔍 Searching for mandals similar to: " + ", ".join(search_terms))
    print()
    
    search_terms_lower = [term.lower() for term in search_terms]
    similar_mandals = []
    
    for mandal in mandals:
        mandal_name = mandal.get('mandal_name', '').lower()
        for search_term in search_terms_lower:
            if search_term in mandal_name or mandal_name in search_term:
                similar_mandals.append(mandal)
                break
    
    if similar_mandals:
        print("✓ Found similar mandal(s):")
        print("-" * 80)
        print(f"{'Mandal Name':<40} {'Resident Count':>15}")
        print("-" * 80)
        
        for i, mandal in enumerate(similar_mandals, 1):
            mandal_name = mandal.get('mandal_name', 'Unknown')
            count = mandal.get('resident_count', 0)
            print(f"{i:3d}. {mandal_name:<37} {count:>15,}")
        
        print("-" * 80)
    else:
        print("⚠️  No similar mandals found")
    
    print()

def main():
    """Main function"""
    print_header()
    
    # Connect to database
    connection = connect_to_database()
    if not connection:
        return
    
    try:
        # Get unique mandals
        mandals = get_unique_mandals(connection)
        
        if not mandals:
            print("❌ No mandals found in the database")
            return
        
        # Display all mandals
        display_mandals(mandals)
        
        # Search for similar mandals
        search_terms = ['Santhipuram', 'Ramakuppam', 'Kuppam', 'Gudupalle']
        search_similar_mandals(mandals, search_terms)
        
        print("=" * 80)
        print("✅ Check Complete!")
        print("=" * 80)
        print()
        print("💡 Tip: Use the exact mandal names from the list above when extracting data.")
        print()
    
    finally:
        # Close database connection
        if connection.is_connected():
            connection.close()
            print("🔌 Database connection closed")

if __name__ == "__main__":
    main()

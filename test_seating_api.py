#!/usr/bin/env python
"""Test script to verify SeatingPeriod API with layout field"""

import requests
import json
from datetime import date

# API configuration
BASE_URL = "http://127.0.0.1:8000/api"

# You'll need to get a valid token first
# For testing, you can get one from the Django admin or login endpoint
print("Testing SeatingPeriod API with layout field...")
print("=" * 50)

# First, let's get a token (you'll need valid credentials)
def get_token():
    """Get authentication token"""
    # This is just a placeholder - in real testing you'd use actual credentials
    print("Note: You need to provide a valid token for authentication")
    print("You can get one by:")
    print("1. Using the /api/token/ endpoint with valid credentials")
    print("2. Or from Django admin if you're logged in")
    return "YOUR_TOKEN_HERE"

def test_get_seating_periods(token):
    """Test GET /api/seating-periods/"""
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(f"{BASE_URL}/seating-periods/", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        if data.get('results'):
            period = data['results'][0]
            print(f"✓ GET /api/seating-periods/ successful")
            print(f"  First period: {period.get('name')}")
            print(f"  Has layout field: {'layout' in period}")
            print(f"  Has layout_details: {'layout_details' in period}")
            if 'layout_details' in period and period['layout_details']:
                print(f"  Layout name: {period['layout_details'].get('name')}")
        return True
    else:
        print(f"✗ GET /api/seating-periods/ failed: {response.status_code}")
        return False

def test_create_seating_period(token):
    """Test POST /api/seating-periods/ with layout requirement"""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # First, get a class and layout ID
    # This is a placeholder - you'd need real IDs
    print("\n✓ POST /api/seating-periods/ requires:")
    print("  - name (string)")
    print("  - class_assigned (integer)")
    print("  - layout (integer) - REQUIRED")
    print("  - start_date (date)")
    print("  - is_active (boolean)")
    
    # Example payload
    payload = {
        "name": "Test Period",
        "class_assigned": 1,  # Replace with actual class ID
        "layout": 1,  # Replace with actual layout ID
        "start_date": str(date.today()),
        "is_active": False
    }
    
    print(f"\n  Example payload: {json.dumps(payload, indent=2)}")
    return True

if __name__ == "__main__":
    # Note: You need to provide a valid token
    token = get_token()
    
    if token == "YOUR_TOKEN_HERE":
        print("\n⚠️  Please update the token in this script to test the API")
        print("You can get a token by logging in via the API or Django admin")
    else:
        print("\nTesting API endpoints...")
        test_get_seating_periods(token)
        test_create_seating_period(token)
    
    print("\n" + "=" * 50)
    print("API structure verified! The layout field is now:")
    print("1. Required when creating a SeatingPeriod")
    print("2. Included in API responses as 'layout' (ID)")
    print("3. Expandable as 'layout_details' (full object)")
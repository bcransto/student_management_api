#!/usr/bin/env python
"""Test the previous period API endpoint."""

import requests
import json

# Configuration
BASE_URL = "http://127.0.0.1:8000/api"
EMAIL = "test@example.com"
PASSWORD = "testpass123"

def get_token():
    """Get JWT token."""
    response = requests.post(f"{BASE_URL}/token/", json={"email": EMAIL, "password": PASSWORD})
    if response.status_code == 200:
        return response.json()["access"]
    else:
        print(f"Failed to get token: {response.status_code} - {response.text}")
        return None

def test_previous_period():
    """Test the previous period endpoint."""
    token = get_token()
    if not token:
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # First get classes to find one with seating periods
    response = requests.get(f"{BASE_URL}/classes/", headers=headers)
    if response.status_code != 200:
        print(f"Failed to get classes: {response.status_code}")
        return
    
    classes = response.json()
    if not classes:
        print("No classes found")
        return
    
    # Test with the first class
    class_id = classes[0]["id"]
    print(f"\nTesting with class ID: {class_id} ({classes[0]['name']})")
    
    # Get previous period
    response = requests.get(
        f"{BASE_URL}/seating-periods/previous_period/",
        params={"class_assigned": class_id},
        headers=headers
    )
    
    print(f"\nResponse status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        if data:
            print(f"\nPrevious period found:")
            print(f"  ID: {data['id']}")
            print(f"  Start date: {data['start_date']}")
            print(f"  End date: {data['end_date']}")
            
            if "assignments" in data:
                print(f"\n  Assignments ({len(data['assignments'])} total):")
                for assignment in data['assignments'][:5]:  # Show first 5
                    print(f"    - {assignment['student_name']} at Table {assignment['table_number']}, Seat {assignment['seat_number']}")
                if len(data['assignments']) > 5:
                    print(f"    ... and {len(data['assignments']) - 5} more")
        else:
            print("\nNo previous period exists for this class")
    else:
        print(f"Error: {response.text}")

if __name__ == "__main__":
    test_previous_period()
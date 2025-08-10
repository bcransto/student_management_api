#!/usr/bin/env python
import requests
import json

# Configure your API credentials
BASE_URL = "http://127.0.0.1:8000/api"
USERNAME = "b"  # Replace with your username
PASSWORD = "abc"  # Replace with your password

# Get auth token
def get_token():
    response = requests.post(f"{BASE_URL}/token/", json={
        "username": USERNAME,
        "password": PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data['access']
    else:
        print(f"Failed to get token: {response.status_code}")
        print(response.text)
        return None

# Test the API filtering
token = get_token()
if token:
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test getting periods for Blue class (ID=1)
    print("\nTesting /api/seating-periods/?class_assigned=1")
    response = requests.get(f"{BASE_URL}/seating-periods/?class_assigned=1", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        periods = data.get('results', [])
        print(f"Found {len(periods)} periods for Blue class:")
        for p in periods:
            print(f"  Period {p['id']}: '{p['name']}' - Active: {p['is_active']} - Layout: {p.get('layout')}")
    else:
        print(f"Failed: {response.status_code}")
        print(response.text)
    
    # Test getting all periods
    print("\nTesting /api/seating-periods/ (all)")
    response = requests.get(f"{BASE_URL}/seating-periods/", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        periods = data.get('results', [])
        print(f"Total periods: {len(periods)}")
else:
    print("Failed to authenticate")
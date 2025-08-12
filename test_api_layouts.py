#!/usr/bin/env python
"""Test the layouts API endpoint directly"""

import requests
import json

# Login first to get token
login_data = {
    "email": "bcranston@carlisle.k12.ma.us",
    "password": "abc"  # You'll need to use the correct password
}

print("Logging in...")
login_response = requests.post("http://127.0.0.1:8000/api/auth/login/", json=login_data)

if login_response.status_code == 200:
    token = login_response.json()["access"]
    print(f"Login successful! Token obtained.")
    
    # Now fetch layouts
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    print("\nFetching layouts...")
    layouts_response = requests.get("http://127.0.0.1:8000/api/layouts/", headers=headers)
    
    if layouts_response.status_code == 200:
        layouts = layouts_response.json()
        
        # Handle paginated response
        if isinstance(layouts, dict) and 'results' in layouts:
            layouts_list = layouts['results']
        else:
            layouts_list = layouts
            
        print(f"Received {len(layouts_list)} layouts:")
        print("-" * 60)
        for layout in layouts_list:
            print(f"- {layout['name']} (ID: {layout['id']})")
    else:
        print(f"Failed to fetch layouts: {layouts_response.status_code}")
        print(layouts_response.text)
else:
    print(f"Login failed: {login_response.status_code}")
    print(login_response.text)
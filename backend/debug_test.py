import requests
import json

def test_backend():
    """Test the backend endpoints"""
    base_url = "http://localhost:8000"
    
    print("=== Testing Backend ===")
    
    # Test 1: Check if backend is running
    try:
        response = requests.get(f"{base_url}/")
        print(f"✅ Backend is running: {response.json()}")
    except Exception as e:
        print(f"❌ Backend not running: {e}")
        return
    
    # Test 2: Check stored files
    try:
        response = requests.get(f"{base_url}/test")
        data = response.json()
        print(f"✅ Test endpoint: {data}")
        print(f"📁 Stored files: {data['stored_files']}")
    except Exception as e:
        print(f"❌ Test endpoint failed: {e}")
    
    # Test 3: Check debug files
    try:
        response = requests.get(f"{base_url}/debug/files")
        data = response.json()
        print(f"✅ Debug files: {data}")
    except Exception as e:
        print(f"❌ Debug endpoint failed: {e}")
    
    # Test 4: Try to get a specific file
    test_filename = "project_summary_2023.txt"
    try:
        response = requests.get(f"{base_url}/file/{test_filename}")
        if response.status_code == 200:
            print(f"✅ File {test_filename} found")
        else:
            print(f"❌ File {test_filename} not found: {response.status_code}")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"❌ File retrieval failed: {e}")

if __name__ == "__main__":
    test_backend() 
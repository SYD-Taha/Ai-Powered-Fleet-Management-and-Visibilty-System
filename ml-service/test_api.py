#!/usr/bin/env python3
"""Test the API endpoints"""

import requests
import json
import time

BASE_URL = "http://localhost:8000"

def test_health():
    """Test health endpoint"""
    print("Testing /api/health...")
    try:
        response = requests.get(f"{BASE_URL}/api/health", timeout=5)
        print(f"  Status: {response.status_code}")
        print(f"  Response: {json.dumps(response.json(), indent=2)}")
        return response.status_code == 200
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False

def test_model_info():
    """Test model info endpoint"""
    print("\nTesting /api/model/info...")
    try:
        response = requests.get(f"{BASE_URL}/api/model/info", timeout=5)
        print(f"  Status: {response.status_code}")
        print(f"  Response: {json.dumps(response.json(), indent=2)}")
        return response.status_code == 200
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False

def test_predict():
    """Test prediction endpoint"""
    print("\nTesting /api/predict...")
    try:
        payload = {
            "candidates": [
                {
                    "distance_m": 1250.5,
                    "distance_cat": 1,
                    "past_perf": 8.2,
                    "fault_history": 2,
                    "fatigue_h": 4.0,
                    "fault_severity": 3
                },
                {
                    "distance_m": 3500.0,
                    "distance_cat": 1,
                    "past_perf": 6.5,
                    "fault_history": 0,
                    "fatigue_h": 8.0,
                    "fault_severity": 3
                }
            ]
        }
        response = requests.post(
            f"{BASE_URL}/api/predict",
            json=payload,
            timeout=5
        )
        print(f"  Status: {response.status_code}")
        result = response.json()
        print(f"  Best Index: {result['best_index']}")
        print(f"  Scores: {result['scores']}")
        print(f"  Best Score: {result['scores'][result['best_index']]:.2f}")
        return response.status_code == 200
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Testing ML Dispatch Service API\n")
    print("=" * 50)
    
    # Wait a bit for service to be ready
    print("Waiting for service to start...")
    time.sleep(2)
    
    results = []
    results.append(("Health Check", test_health()))
    results.append(("Model Info", test_model_info()))
    results.append(("Prediction", test_predict()))
    
    print("\n" + "=" * 50)
    print("📊 Test Results:")
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {name}: {status}")
    
    all_passed = all(r[1] for r in results)
    if all_passed:
        print("\n🎉 All tests passed!")
    else:
        print("\n⚠️  Some tests failed")


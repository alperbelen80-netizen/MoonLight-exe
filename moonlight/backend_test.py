#!/usr/bin/env python3
"""
MoonLight Trading OS Backend API Test Suite
Tests all specified endpoints for Scenario B (Live Signals) + Multi-Source Data Feed + AI Coach
"""

import requests
import json
import time
import sys
from datetime import datetime
from typing import Dict, Any, List, Optional

class MoonLightAPITester:
    def __init__(self, base_url="http://localhost:8001"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})

    def log(self, message: str, level: str = "INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int = 200, 
                 data: Optional[Dict] = None, timeout: int = 30, 
                 validation_func: Optional[callable] = None) -> Dict[str, Any]:
        """Run a single API test with validation"""
        url = f"{self.base_url}/api/{endpoint}"
        self.tests_run += 1
        
        self.log(f"🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = self.session.get(url, timeout=timeout)
            elif method == 'POST':
                response = self.session.post(url, json=data, timeout=timeout)
            else:
                raise ValueError(f"Unsupported method: {method}")

            # Check status code
            status_ok = response.status_code == expected_status
            
            # Parse response
            try:
                response_data = response.json()
            except:
                response_data = {"raw_text": response.text}

            # Run custom validation if provided
            validation_ok = True
            validation_msg = ""
            if validation_func and status_ok:
                try:
                    validation_ok, validation_msg = validation_func(response_data)
                except Exception as e:
                    validation_ok = False
                    validation_msg = f"Validation error: {str(e)}"

            # Overall success
            success = status_ok and validation_ok
            
            if success:
                self.tests_passed += 1
                self.log(f"✅ PASSED - {name} (Status: {response.status_code})")
                if validation_msg:
                    self.log(f"   ✓ {validation_msg}")
            else:
                error_details = []
                if not status_ok:
                    error_details.append(f"Expected status {expected_status}, got {response.status_code}")
                if not validation_ok:
                    error_details.append(f"Validation failed: {validation_msg}")
                
                error_msg = "; ".join(error_details)
                self.log(f"❌ FAILED - {name}: {error_msg}")
                self.failed_tests.append({
                    "name": name,
                    "endpoint": endpoint,
                    "error": error_msg,
                    "response": response_data
                })

            return {
                "success": success,
                "status_code": response.status_code,
                "data": response_data,
                "validation_msg": validation_msg
            }

        except Exception as e:
            self.log(f"❌ FAILED - {name}: Exception - {str(e)}")
            self.failed_tests.append({
                "name": name,
                "endpoint": endpoint,
                "error": f"Exception: {str(e)}",
                "response": None
            })
            return {
                "success": False,
                "status_code": None,
                "data": None,
                "error": str(e)
            }

    def test_live_signals(self):
        """Test GET /api/live/signals - should return 1500+ signals with pagination"""
        def validate_signals(data):
            if not isinstance(data, dict):
                return False, "Response is not a dict"
            
            required_fields = ['items', 'total', 'page', 'pageSize']
            for field in required_fields:
                if field not in data:
                    return False, f"Missing required field: {field}"
            
            if not isinstance(data['items'], list):
                return False, "items is not a list"
            
            if data['total'] < 1500:
                return False, f"Expected 1500+ signals, got {data['total']}"
            
            # Check signal structure
            if len(data['items']) > 0:
                signal = data['items'][0]
                signal_fields = ['id', 'timestamp_utc', 'symbol', 'timeframe', 'direction', 
                                'confidence_score', 'environment', 'status']
                for field in signal_fields:
                    if field not in signal:
                        return False, f"Signal missing field: {field}"
            
            return True, f"Found {data['total']} signals with {len(data['items'])} items on page {data['page']}"

        return self.run_test(
            "Live Signals Pagination",
            "GET",
            "live/signals",
            validation_func=validate_signals
        )

    def test_ai_coach_status(self):
        """Test GET /api/ai-coach/status - should return available:true, model:'gemini-2.5-flash'"""
        def validate_status(data):
            if not isinstance(data, dict):
                return False, "Response is not a dict"
            
            if data.get('available') != True:
                return False, f"Expected available=true, got {data.get('available')}"
            
            expected_model = 'gemini-2.5-flash'
            if data.get('model') != expected_model:
                return False, f"Expected model='{expected_model}', got '{data.get('model')}'"
            
            return True, f"AI Coach available with model {data.get('model')}"

        return self.run_test(
            "AI Coach Status",
            "GET",
            "ai-coach/status",
            validation_func=validate_status
        )

    def test_ai_coach_chat(self):
        """Test POST /api/ai-coach/chat with Turkish greeting"""
        def validate_chat(data):
            if not isinstance(data, dict):
                return False, "Response is not a dict"
            
            required_fields = ['reply', 'model']
            for field in required_fields:
                if field not in data:
                    return False, f"Missing required field: {field}"
            
            if not isinstance(data['reply'], str) or len(data['reply']) < 5:
                return False, "Reply is too short or not a string"
            
            return True, f"Got reply: '{data['reply'][:100]}...'"

        return self.run_test(
            "AI Coach Chat",
            "POST",
            "ai-coach/chat",
            expected_status=201,  # POST endpoints return 201 Created
            data={"message": "Selam"},
            timeout=35,  # AI calls can take up to 30s
            validation_func=validate_chat
        )

    def test_ai_coach_validate_feed(self):
        """Test POST /api/ai-coach/validate-feed - should return deterministic MOCK_LIVE + ai.approved=true"""
        def validate_feed(data):
            if not isinstance(data, dict):
                return False, "Response is not a dict"
            
            required_fields = ['deterministic', 'ai', 'health']
            for field in required_fields:
                if field not in data:
                    return False, f"Missing required field: {field}"
            
            if data.get('deterministic') != 'MOCK_LIVE':
                return False, f"Expected deterministic='MOCK_LIVE', got '{data.get('deterministic')}'"
            
            ai_result = data.get('ai')
            if not isinstance(ai_result, dict):
                return False, "ai field is not a dict"
            
            if ai_result.get('approved') != True:
                return False, f"Expected ai.approved=true, got {ai_result.get('approved')}"
            
            confidence = ai_result.get('confidence', 0)
            if confidence < 0.6:
                return False, f"Expected confidence >= 0.6, got {confidence}"
            
            return True, f"AI approved MOCK_LIVE with confidence {confidence:.2f}"

        return self.run_test(
            "AI Coach Feed Validation",
            "POST",
            "ai-coach/validate-feed",
            expected_status=201,  # POST endpoints return 201 Created
            validation_func=validate_feed
        )

    def test_data_providers_health(self):
        """Test GET /api/data/providers/health - should list 5 providers with MOCK_LIVE connected"""
        def validate_health(data):
            if not isinstance(data, dict):
                return False, "Response is not a dict"
            
            if 'providers' not in data:
                return False, "Missing providers field"
            
            providers = data['providers']
            if not isinstance(providers, list):
                return False, "providers is not a list"
            
            expected_providers = ['MOCK_LIVE', 'BINANCE_CCXT', 'BYBIT_CCXT', 'TRADINGVIEW', 'IQ_OPTION']
            provider_names = [p.get('name') for p in providers]
            
            for expected in expected_providers:
                if expected not in provider_names:
                    return False, f"Missing provider: {expected}"
            
            # Check MOCK_LIVE is connected
            mock_provider = next((p for p in providers if p.get('name') == 'MOCK_LIVE'), None)
            if not mock_provider:
                return False, "MOCK_LIVE provider not found"
            
            if mock_provider.get('connected') != True:
                return False, f"Expected MOCK_LIVE connected=true, got {mock_provider.get('connected')}"
            
            # Validate provider structure
            for provider in providers:
                required_fields = ['name', 'connected', 'score', 'kind']
                for field in required_fields:
                    if field not in provider:
                        return False, f"Provider {provider.get('name')} missing field: {field}"
            
            connected_count = sum(1 for p in providers if p.get('connected'))
            return True, f"Found {len(providers)} providers, {connected_count} connected"

        return self.run_test(
            "Data Providers Health",
            "GET",
            "data/providers/health",
            validation_func=validate_health
        )

    def test_auto_select_with_ai(self):
        """Test POST /api/data/providers/auto-select with AI validation"""
        def validate_auto_select(data):
            if not isinstance(data, dict):
                return False, "Response is not a dict"
            
            required_fields = ['aiValidation', 'ai_available', 'deterministicChoice']
            for field in required_fields:
                if field not in data:
                    return False, f"Missing required field: {field}"
            
            if data.get('ai_available') != True:
                return False, f"Expected ai_available=true, got {data.get('ai_available')}"
            
            ai_validation = data.get('aiValidation')
            if ai_validation is None:
                return False, "aiValidation is null"
            
            if not isinstance(ai_validation, dict):
                return False, "aiValidation is not a dict"
            
            ai_fields = ['approved', 'confidence', 'reason']
            for field in ai_fields:
                if field not in ai_validation:
                    return False, f"aiValidation missing field: {field}"
            
            return True, f"AI validation: approved={ai_validation.get('approved')}, conf={ai_validation.get('confidence'):.2f}"

        return self.run_test(
            "Auto-Select with AI Validation",
            "POST",
            "data/providers/auto-select",
            expected_status=201,  # POST endpoints return 201 Created
            data={"requireAIValidation": True, "apply": False},
            validation_func=validate_auto_select
        )

    def test_auto_select_deterministic(self):
        """Test POST /api/data/providers/auto-select without AI validation"""
        def validate_deterministic(data):
            if not isinstance(data, dict):
                return False, "Response is not a dict"
            
            required_fields = ['deterministicChoice', 'reason']
            for field in required_fields:
                if field not in data:
                    return False, f"Missing required field: {field}"
            
            return True, f"Deterministic choice: {data.get('deterministicChoice')}"

        return self.run_test(
            "Auto-Select Deterministic Only",
            "POST",
            "data/providers/auto-select",
            expected_status=201,  # POST endpoints return 201 Created
            data={"requireAIValidation": False, "apply": False},
            validation_func=validate_deterministic
        )

    def test_provider_switch(self):
        """Test provider switching functionality"""
        # First switch to BYBIT_CCXT
        def validate_switch(data):
            if not isinstance(data, dict):
                return False, "Response is not a dict"
            
            if 'active' not in data:
                return False, "Missing active field"
            
            return True, f"Active provider: {data.get('active')}"

        # Switch to BYBIT_CCXT
        result1 = self.run_test(
            "Switch to BYBIT_CCXT",
            "POST",
            "data/providers/switch",
            expected_status=201,  # POST endpoints return 201 Created
            data={"provider": "BYBIT_CCXT"},
            validation_func=validate_switch
        )

        # Switch back to MOCK_LIVE
        result2 = self.run_test(
            "Switch back to MOCK_LIVE",
            "POST",
            "data/providers/switch",
            expected_status=201,  # POST endpoints return 201 Created
            data={"provider": "MOCK_LIVE"},
            validation_func=validate_switch
        )

        return result1 and result2

    def test_owner_dashboard_summary(self):
        """Test GET /api/owner/dashboard/summary - regression check"""
        def validate_summary(data):
            if not isinstance(data, dict):
                return False, "Response is not a dict"
            
            # Check for expected fields (regression check)
            expected_fields = ['global_health_score', 'execution_mode']
            for field in expected_fields:
                if field not in data:
                    return False, f"Missing expected field: {field}"
            
            return True, f"Dashboard summary OK with health score: {data.get('global_health_score')}"

        return self.run_test(
            "Owner Dashboard Summary",
            "GET",
            "owner/dashboard/summary",
            validation_func=validate_summary
        )

    def test_broker_adapters_health(self):
        """Test GET /api/broker/adapters/health - regression check for 5 broker adapters"""
        def validate_broker_health(data):
            if not isinstance(data, dict):
                return False, "Response is not a dict"
            
            if 'adapters' not in data:
                return False, "Missing adapters field"
            
            adapters = data['adapters']
            if not isinstance(adapters, list):
                return False, "adapters is not a list"
            
            if len(adapters) != 5:
                return False, f"Expected 5 broker adapters, got {len(adapters)}"
            
            return True, f"Found {len(adapters)} broker adapters"

        return self.run_test(
            "Broker Adapters Health",
            "GET",
            "broker/adapters/health",
            validation_func=validate_broker_health
        )

    def run_jest_tests(self):
        """Run Jest tests to ensure 129/129 pass"""
        self.log("🧪 Running Jest tests...")
        
        import subprocess
        import os
        
        try:
            # Change to backend directory
            backend_dir = "/app/moonlight/backend"
            
            # Run yarn test
            result = subprocess.run(
                ["yarn", "test"],
                cwd=backend_dir,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            output = result.stdout + result.stderr
            
            # Parse test results
            if result.returncode == 0:
                # Look for test summary
                lines = output.split('\n')
                for line in lines:
                    if 'Tests:' in line and 'passed' in line:
                        self.log(f"✅ Jest Tests: {line.strip()}")
                        self.tests_run += 1
                        self.tests_passed += 1
                        return True
                
                self.log("✅ Jest tests completed successfully")
                self.tests_run += 1
                self.tests_passed += 1
                return True
            else:
                self.log(f"❌ Jest tests failed with exit code {result.returncode}")
                self.log(f"Output: {output}")
                self.failed_tests.append({
                    "name": "Jest Tests",
                    "endpoint": "yarn test",
                    "error": f"Exit code {result.returncode}",
                    "response": output
                })
                self.tests_run += 1
                return False
                
        except subprocess.TimeoutExpired:
            self.log("❌ Jest tests timed out after 5 minutes")
            self.failed_tests.append({
                "name": "Jest Tests",
                "endpoint": "yarn test",
                "error": "Timeout after 5 minutes",
                "response": None
            })
            self.tests_run += 1
            return False
        except Exception as e:
            self.log(f"❌ Jest tests failed with exception: {str(e)}")
            self.failed_tests.append({
                "name": "Jest Tests",
                "endpoint": "yarn test",
                "error": f"Exception: {str(e)}",
                "response": None
            })
            self.tests_run += 1
            return False

    def run_all_tests(self):
        """Run all test suites"""
        self.log("🚀 Starting MoonLight Trading OS Backend API Tests")
        self.log(f"Base URL: {self.base_url}")
        
        # Test all endpoints
        self.test_live_signals()
        self.test_ai_coach_status()
        self.test_ai_coach_chat()
        self.test_ai_coach_validate_feed()
        self.test_data_providers_health()
        self.test_auto_select_with_ai()
        self.test_auto_select_deterministic()
        self.test_provider_switch()
        self.test_owner_dashboard_summary()
        self.test_broker_adapters_health()
        
        # Run Jest tests
        self.run_jest_tests()
        
        # Print summary
        self.print_summary()

    def print_summary(self):
        """Print test results summary"""
        self.log("=" * 60)
        self.log("📊 TEST SUMMARY")
        self.log("=" * 60)
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        self.log(f"Tests Run: {self.tests_run}")
        self.log(f"Tests Passed: {self.tests_passed}")
        self.log(f"Tests Failed: {len(self.failed_tests)}")
        self.log(f"Success Rate: {success_rate:.1f}%")
        
        if self.failed_tests:
            self.log("\n❌ FAILED TESTS:")
            for i, test in enumerate(self.failed_tests, 1):
                self.log(f"{i}. {test['name']}: {test['error']}")
        
        if success_rate >= 90:
            self.log("\n🎉 OVERALL RESULT: EXCELLENT")
        elif success_rate >= 75:
            self.log("\n✅ OVERALL RESULT: GOOD")
        elif success_rate >= 50:
            self.log("\n⚠️  OVERALL RESULT: NEEDS ATTENTION")
        else:
            self.log("\n❌ OVERALL RESULT: CRITICAL ISSUES")
        
        return success_rate >= 75

def main():
    """Main test runner"""
    tester = MoonLightAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
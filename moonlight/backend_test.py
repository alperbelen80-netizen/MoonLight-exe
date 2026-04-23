#!/usr/bin/env python3
"""
MoonLight v1.9 Backend API Test Suite
Tests all endpoints specified in the testing requirements.
"""

import requests
import sys
import time
import json
from datetime import datetime
from typing import Dict, Any, List

class MoonLightAPITester:
    def __init__(self, base_url="http://localhost:8001/api"):
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
                 data: Dict = None, headers: Dict = None, check_response: callable = None) -> tuple:
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        test_headers = self.session.headers.copy()
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        self.log(f"Testing {name}...")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=test_headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=test_headers)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            response_data = {}
            
            try:
                response_data = response.json() if response.content else {}
            except:
                response_data = {"raw_content": response.text[:500]}

            if success:
                # Additional response validation if provided
                if check_response and not check_response(response_data):
                    success = False
                    self.log(f"❌ {name} - Response validation failed", "ERROR")
                else:
                    self.tests_passed += 1
                    self.log(f"✅ {name} - Status: {response.status_code}")
            else:
                self.failed_tests.append({
                    "test": name,
                    "expected_status": expected_status,
                    "actual_status": response.status_code,
                    "response": response_data
                })
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}", "ERROR")

            return success, response_data, response

        except Exception as e:
            self.failed_tests.append({
                "test": name,
                "error": str(e),
                "expected_status": expected_status
            })
            self.log(f"❌ {name} - Error: {str(e)}", "ERROR")
            return False, {}, None

    def test_healthz(self):
        """Test health check endpoint"""
        self.log("=== Testing Health Check Endpoint ===")
        
        def check_healthz_response(data):
            required_fields = ['status', 'uptime_s', 'checks']
            if not all(field in data for field in required_fields):
                return False
            
            # Check status is 'ok' or 'degraded'
            if data['status'] not in ['ok', 'degraded']:
                return False
                
            # Check required checks
            checks = data.get('checks', {})
            required_checks = ['database', 'ai_coach', 'ai_reasoning', 'active_feed']
            if not all(check in checks for check in required_checks):
                return False
                
            # Check database latency
            db_check = checks.get('database', {})
            if db_check.get('ok') and db_check.get('latencyMs', 0) > 500:
                self.log(f"⚠️  Database latency {db_check.get('latencyMs')}ms > 500ms", "WARN")
                
            return True

        return self.run_test(
            "GET /api/healthz",
            "GET",
            "healthz",
            200,
            check_response=check_healthz_response
        )

    def test_journal_endpoints(self):
        """Test journal endpoints"""
        self.log("=== Testing Journal Endpoints ===")
        
        # Test basic journal list
        def check_journal_response(data):
            required_fields = ['count', 'from_utc', 'to_utc', 'items']
            return all(field in data for field in required_fields)

        success1, data1, _ = self.run_test(
            "GET /api/journal",
            "GET",
            "journal",
            200,
            check_response=check_journal_response
        )

        # Test journal with verdict filter
        success2, data2, _ = self.run_test(
            "GET /api/journal?verdict=APPROVED",
            "GET",
            "journal?verdict=APPROVED",
            200,
            check_response=check_journal_response
        )

        # Test journal with symbol and limit
        success3, data3, _ = self.run_test(
            "GET /api/journal?symbol=BTCUSDT&limit=5",
            "GET",
            "journal?symbol=BTCUSDT&limit=5",
            200,
            check_response=check_journal_response
        )

        # Test journal stats
        def check_stats_response(data):
            required_fields = ['total', 'by_status', 'by_verdict', 'by_direction']
            return all(field in data for field in required_fields)

        success4, data4, _ = self.run_test(
            "GET /api/journal/stats?hours=24",
            "GET",
            "journal/stats?hours=24",
            200,
            check_response=check_stats_response
        )

        return all([success1, success2, success3, success4])

    def test_risk_profile_endpoints(self):
        """Test risk profile endpoints"""
        self.log("=== Testing Risk Profile Endpoints ===")
        
        # Test get presets
        def check_presets_response(data):
            if 'presets' not in data:
                return False
            presets = data['presets']
            if len(presets) != 3:
                return False
            preset_ids = [p.get('id') for p in presets]
            return all(pid in preset_ids for pid in ['conservative', 'moderate', 'aggressive'])

        success1, data1, _ = self.run_test(
            "GET /api/risk/profile/presets",
            "GET",
            "risk/profile/presets",
            200,
            check_response=check_presets_response
        )

        # Test get current profile
        def check_current_profile(data):
            return 'current' in data and 'id' in data['current']

        success2, data2, _ = self.run_test(
            "GET /api/risk/profile",
            "GET",
            "risk/profile",
            200,
            check_response=check_current_profile
        )

        # Test switch to conservative profile
        success3, data3, _ = self.run_test(
            "POST /api/risk/profile {id:'conservative'}",
            "POST",
            "risk/profile",
            201,
            data={"id": "conservative"},
            check_response=check_current_profile
        )

        # Verify the switch worked
        success4, data4, _ = self.run_test(
            "GET /api/risk/profile (verify conservative)",
            "GET",
            "risk/profile",
            200
        )
        
        if success4 and data4.get('current', {}).get('id') != 'conservative':
            self.log("❌ Profile switch verification failed", "ERROR")
            success4 = False

        # Test custom profile with clamping
        success5, data5, _ = self.run_test(
            "POST /api/risk/profile custom with clamping",
            "POST",
            "risk/profile",
            201,
            data={
                "id": "custom",
                "r_per_trade_pct": 15,  # Should be clamped to 10
                "max_concurrent": 100,  # Should be clamped to 20
                "confidence_floor": 2   # Should be clamped to 1
            }
        )

        # Test invalid profile ID
        success6, data6, _ = self.run_test(
            "POST /api/risk/profile {id:'nope'}",
            "POST",
            "risk/profile",
            500,  # Expecting error
            data={"id": "nope"}
        )

        return all([success1, success2, success3, success4, success5, success6])

    def test_alerts_endpoints(self):
        """Test alerts endpoints"""
        self.log("=== Testing Alerts Endpoints ===")
        
        # Test get webhooks (should show unconfigured)
        def check_webhooks_response(data):
            return 'configured' in data and 'channels' in data

        success1, data1, _ = self.run_test(
            "GET /api/alerts/webhooks",
            "GET",
            "alerts/webhooks",
            200,
            check_response=check_webhooks_response
        )

        # Test webhook dispatch with override
        def check_dispatch_response(data):
            required_fields = ['total', 'ok', 'failed']
            return all(field in data for field in required_fields)

        success2, data2, _ = self.run_test(
            "POST /api/alerts/test-webhook with override",
            "POST",
            "alerts/test-webhook",
            201,
            data={
                "url": "https://httpbin.org/post",
                "channel": "generic",
                "title": "Test",
                "message": "hi",
                "severity": "info"
            },
            check_response=check_dispatch_response
        )

        # Test webhook dispatch without override (should return 0 total)
        success3, data3, _ = self.run_test(
            "POST /api/alerts/test-webhook without override",
            "POST",
            "alerts/test-webhook",
            201,
            data={
                "title": "Test",
                "message": "hi",
                "severity": "info"
            }
        )
        
        if success3 and data3.get('total', -1) != 0:
            self.log("❌ Expected total=0 when no ALERT_WEBHOOKS env", "ERROR")
            success3 = False

        return all([success1, success2, success3])

    def test_ai_coach_endpoints(self):
        """Test AI coach endpoints"""
        self.log("=== Testing AI Coach Endpoints ===")
        
        # Test backtest analysis with valid data
        def check_backtest_response(data):
            required_fields = ['runId', 'strengths', 'weaknesses', 'recommendations', 'riskLevel']
            return all(field in data for field in required_fields)

        success1, data1, _ = self.run_test(
            "POST /api/ai-coach/analyze-backtest",
            "POST",
            "ai-coach/analyze-backtest",
            201,
            data={
                "runId": "T1",
                "win_rate": 0.58,
                "max_drawdown": 0.12,
                "profit_factor": 1.45,
                "total_trades": 120,
                "symbols": ["BTCUSDT"]
            },
            check_response=check_backtest_response
        )

        # Test backtest analysis with high drawdown
        success2, data2, _ = self.run_test(
            "POST /api/ai-coach/analyze-backtest with high drawdown",
            "POST",
            "ai-coach/analyze-backtest",
            201,
            data={
                "runId": "T2",
                "win_rate": 0.45,
                "max_drawdown": 0.35,
                "profit_factor": 0.8,
                "total_trades": 50
            }
        )
        
        if success2 and data2.get('riskLevel') != 'high':
            self.log("❌ Expected riskLevel='high' for high drawdown", "ERROR")
            success2 = False

        # Test backtest analysis without runId
        success3, data3, _ = self.run_test(
            "POST /api/ai-coach/analyze-backtest without runId",
            "POST",
            "ai-coach/analyze-backtest",
            201,
            data={
                "win_rate": 0.5,
                "max_drawdown": 0.1
            }
        )
        
        if success3 and 'error' not in data3:
            self.log("❌ Expected error for missing runId", "ERROR")
            success3 = False

        return all([success1, success2, success3])

    def test_compression(self):
        """Test gzip compression"""
        self.log("=== Testing Response Compression ===")
        
        headers = {'Accept-Encoding': 'gzip'}
        success, data, response = self.run_test(
            "GET /api/ai-coach/daily-insights with gzip",
            "GET",
            "ai-coach/daily-insights",
            200,
            headers=headers
        )
        
        if success and response:
            content_encoding = response.headers.get('Content-Encoding', '')
            content_length = len(response.content)
            
            if content_length > 1024 and 'gzip' not in content_encoding:
                self.log(f"⚠️  Large response ({content_length} bytes) not gzipped", "WARN")
            elif content_length > 1024 and 'gzip' in content_encoding:
                self.log(f"✅ Large response ({content_length} bytes) properly gzipped")
            else:
                self.log(f"ℹ️  Small response ({content_length} bytes) - gzip not expected")
        
        return success

    def test_throttling(self):
        """Test rate limiting"""
        self.log("=== Testing Rate Limiting ===")
        
        # Make 105 rapid requests to test throttling
        throttled_count = 0
        success_count = 0
        
        for i in range(105):
            try:
                response = self.session.get(f"{self.base_url}/ai-coach/status")
                if response.status_code == 429:
                    throttled_count += 1
                elif response.status_code == 200:
                    success_count += 1
            except:
                pass
            
            # Small delay to avoid overwhelming
            if i % 20 == 0:
                time.sleep(0.1)
        
        self.log(f"Throttling test: {success_count} success, {throttled_count} throttled")
        
        # Expect at least some requests to be throttled after 100
        if throttled_count >= 5:
            self.log("✅ Throttling working correctly")
            return True
        else:
            self.log("⚠️  Expected more throttled requests", "WARN")
            return False

    def test_regression_endpoints(self):
        """Test regression endpoints"""
        self.log("=== Testing Regression Endpoints ===")
        
        # Test reason-signal batch endpoint
        success1, data1, _ = self.run_test(
            "POST /api/ai-coach/reason-signal/batch",
            "POST",
            "ai-coach/reason-signal/batch",
            201,
            data={"limit": 3}
        )

        # Test daily insights
        def check_insights_response(data):
            expected_fields = ['totals', 'top_symbols', 'ai_summary']
            return any(field in data for field in expected_fields)  # At least one field

        success2, data2, _ = self.run_test(
            "GET /api/ai-coach/daily-insights",
            "GET",
            "ai-coach/daily-insights",
            200,
            check_response=check_insights_response
        )

        # Test live signals
        success3, data3, _ = self.run_test(
            "GET /api/live/signals",
            "GET",
            "live/signals",
            200
        )

        # Test data providers health
        success4, data4, _ = self.run_test(
            "GET /api/data/providers/health",
            "GET",
            "data/providers/health",
            200
        )

        return all([success1, success2, success3, success4])

    def run_all_tests(self):
        """Run all test suites"""
        self.log("🚀 Starting MoonLight v1.9 Backend API Tests")
        self.log(f"Base URL: {self.base_url}")
        
        start_time = time.time()
        
        # Run test suites
        test_results = {
            "healthz": self.test_healthz()[0],
            "journal": self.test_journal_endpoints(),
            "risk_profile": self.test_risk_profile_endpoints(),
            "alerts": self.test_alerts_endpoints(),
            "ai_coach": self.test_ai_coach_endpoints(),
            "compression": self.test_compression(),
            "throttling": self.test_throttling(),
            "regression": self.test_regression_endpoints()
        }
        
        end_time = time.time()
        
        # Print summary
        self.log("=" * 60)
        self.log("🏁 TEST SUMMARY")
        self.log("=" * 60)
        self.log(f"Total tests run: {self.tests_run}")
        self.log(f"Tests passed: {self.tests_passed}")
        self.log(f"Tests failed: {len(self.failed_tests)}")
        self.log(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        self.log(f"Execution time: {(end_time-start_time):.2f}s")
        
        # Test suite results
        self.log("\n📊 Test Suite Results:")
        for suite, passed in test_results.items():
            status = "✅ PASS" if passed else "❌ FAIL"
            self.log(f"  {suite}: {status}")
        
        # Failed tests details
        if self.failed_tests:
            self.log("\n❌ Failed Tests:")
            for failure in self.failed_tests:
                self.log(f"  - {failure['test']}")
                if 'error' in failure:
                    self.log(f"    Error: {failure['error']}")
                else:
                    self.log(f"    Expected: {failure['expected_status']}, Got: {failure['actual_status']}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = MoonLightAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
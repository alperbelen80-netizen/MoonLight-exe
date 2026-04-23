#!/usr/bin/env python3
"""
MoonLight v1.8 AI-Native Trading OS - AI Reasoning Layer Backend Tests
Tests all AI Coach endpoints including reasoning, insights, and auto-batch functionality.
"""

import requests
import json
import time
import sys
from datetime import datetime
from typing import Dict, List, Any

class MoonLightAIReasoningTester:
    def __init__(self, base_url="http://localhost:8001/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
        
    def make_request(self, method: str, endpoint: str, data: Dict = None, timeout: int = 30) -> tuple:
        """Make HTTP request and return (success, response_data, status_code)"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=timeout)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=timeout)
            else:
                return False, {}, 0
                
            return response.status_code < 400, response.json(), response.status_code
        except Exception as e:
            return False, {"error": str(e)}, 0

    def test_ai_coach_status(self):
        """Test GET /api/ai-coach/status"""
        success, data, status = self.make_request('GET', 'ai-coach/status')
        
        if not success:
            self.log_test("AI Coach Status", False, f"Request failed: {data}")
            return False
            
        required_fields = ['available', 'model', 'reasoning_enabled', 'strict_guard', 'rate_limit']
        missing_fields = [f for f in required_fields if f not in data]
        
        if missing_fields:
            self.log_test("AI Coach Status", False, f"Missing fields: {missing_fields}")
            return False
            
        # Check specific values
        checks = [
            (data.get('available') == True, "available should be true"),
            (data.get('model') == 'gemini-2.5-flash', f"model should be gemini-2.5-flash, got {data.get('model')}"),
            (data.get('reasoning_enabled') == True, "reasoning_enabled should be true"),
            (data.get('strict_guard') == False, "strict_guard should be false"),
            ('remaining' in data.get('rate_limit', {}), "rate_limit should have remaining field"),
            ('perMinute' in data.get('rate_limit', {}), "rate_limit should have perMinute field"),
            ('circuitOpen' in data.get('rate_limit', {}), "rate_limit should have circuitOpen field")
        ]
        
        for check, msg in checks:
            if not check:
                self.log_test("AI Coach Status", False, msg)
                return False
                
        self.log_test("AI Coach Status", True, f"All fields correct: {data}")
        return True

    def get_live_signals(self, limit: int = 10) -> List[Dict]:
        """Get live signals for testing"""
        success, data, status = self.make_request('GET', f'live/signals?limit={limit}')
        if success and 'items' in data:
            return data['items']
        return []

    def test_reason_signal_single(self):
        """Test POST /api/ai-coach/reason-signal/:id"""
        # Get a signal to test with
        signals = self.get_live_signals(5)
        if not signals:
            self.log_test("Reason Signal (Single)", False, "No live signals available for testing")
            return False
            
        signal_id = signals[0]['id']
        success, data, status = self.make_request('POST', f'ai-coach/reason-signal/{signal_id}', timeout=20)
        
        if not success:
            self.log_test("Reason Signal (Single)", False, f"Request failed: {data}")
            return False
            
        required_fields = ['signalId', 'verdict', 'confidence', 'reasoning', 'riskFactors', 'expectedWR']
        missing_fields = [f for f in required_fields if f not in data]
        
        if missing_fields:
            self.log_test("Reason Signal (Single)", False, f"Missing fields: {missing_fields}")
            return False
            
        # Validate verdict values
        valid_verdicts = ['APPROVED', 'REJECTED', 'UNKNOWN']
        if data.get('verdict') not in valid_verdicts:
            self.log_test("Reason Signal (Single)", False, f"Invalid verdict: {data.get('verdict')}")
            return False
            
        # Validate confidence range
        confidence = data.get('confidence', -1)
        if not (0 <= confidence <= 1):
            self.log_test("Reason Signal (Single)", False, f"Confidence out of range [0,1]: {confidence}")
            return False
            
        self.log_test("Reason Signal (Single)", True, f"Signal {signal_id} reasoned: {data.get('verdict')}")
        return True

    def test_reason_signal_batch(self):
        """Test POST /api/ai-coach/reason-signal/batch"""
        success, data, status = self.make_request('POST', 'ai-coach/reason-signal/batch', {'limit': 5}, timeout=30)
        
        if not success:
            self.log_test("Reason Signal (Batch)", False, f"Request failed: {data}")
            return False
            
        required_fields = ['processed', 'results']
        missing_fields = [f for f in required_fields if f not in data]
        
        if missing_fields:
            self.log_test("Reason Signal (Batch)", False, f"Missing fields: {missing_fields}")
            return False
            
        processed = data.get('processed', 0)
        results = data.get('results', [])
        
        if len(results) != processed:
            self.log_test("Reason Signal (Batch)", False, f"Processed count {processed} != results length {len(results)}")
            return False
            
        # Validate each result
        for i, result in enumerate(results):
            required_result_fields = ['signalId', 'verdict', 'confidence']
            missing_result_fields = [f for f in required_result_fields if f not in result]
            if missing_result_fields:
                self.log_test("Reason Signal (Batch)", False, f"Result {i} missing fields: {missing_result_fields}")
                return False
                
        self.log_test("Reason Signal (Batch)", True, f"Processed {processed} signals successfully")
        return True

    def test_reasoning_history(self):
        """Test GET /api/ai-coach/reasoning-history"""
        # Test basic history
        success, data, status = self.make_request('GET', 'ai-coach/reasoning-history?limit=20')
        
        if not success:
            self.log_test("Reasoning History (Basic)", False, f"Request failed: {data}")
            return False
            
        required_fields = ['items', 'count']
        missing_fields = [f for f in required_fields if f not in data]
        
        if missing_fields:
            self.log_test("Reasoning History (Basic)", False, f"Missing fields: {missing_fields}")
            return False
            
        items = data.get('items', [])
        count = data.get('count', 0)
        
        if len(items) != count:
            self.log_test("Reasoning History (Basic)", False, f"Items length {len(items)} != count {count}")
            return False
            
        # Validate items have AI fields
        for item in items[:3]:  # Check first 3 items
            ai_fields = ['ai_verdict', 'ai_confidence', 'ai_reasoning']
            for field in ai_fields:
                if field not in item:
                    self.log_test("Reasoning History (Basic)", False, f"Item missing {field}")
                    return False
                    
        self.log_test("Reasoning History (Basic)", True, f"Retrieved {count} items with AI fields")
        
        # Test filtered by verdict
        success, data, status = self.make_request('GET', 'ai-coach/reasoning-history?verdict=APPROVED')
        if success:
            approved_items = data.get('items', [])
            all_approved = all(item.get('ai_verdict') == 'APPROVED' for item in approved_items)
            if all_approved:
                self.log_test("Reasoning History (Filtered)", True, f"APPROVED filter working: {len(approved_items)} items")
            else:
                self.log_test("Reasoning History (Filtered)", False, "APPROVED filter not working correctly")
        else:
            self.log_test("Reasoning History (Filtered)", False, f"Filtered request failed: {data}")
            
        return True

    def test_daily_insights(self):
        """Test GET /api/ai-coach/daily-insights"""
        # Test basic insights
        success, data, status = self.make_request('GET', 'ai-coach/daily-insights')
        
        if not success:
            self.log_test("Daily Insights (Basic)", False, f"Request failed: {data}")
            return False
            
        required_fields = ['generated_at_utc', 'window_hours', 'totals', 'top_symbols', 'top_strategies', 'regime_distribution', 'ai_summary', 'recommendations']
        missing_fields = [f for f in required_fields if f not in data]
        
        if missing_fields:
            self.log_test("Daily Insights (Basic)", False, f"Missing fields: {missing_fields}")
            return False
            
        # Validate totals structure
        totals = data.get('totals', {})
        required_totals = ['signals', 'approved', 'rejected', 'unknown', 'approval_rate']
        missing_totals = [f for f in required_totals if f not in totals]
        
        if missing_totals:
            self.log_test("Daily Insights (Basic)", False, f"Missing totals fields: {missing_totals}")
            return False
            
        self.log_test("Daily Insights (Basic)", True, f"Generated insights for {totals.get('signals')} signals")
        
        # Test windowed insights
        success, data, status = self.make_request('GET', 'ai-coach/daily-insights?window=1')
        if success:
            window_hours = data.get('window_hours')
            if window_hours == 1:
                self.log_test("Daily Insights (Windowed)", True, f"1-hour window working")
            else:
                self.log_test("Daily Insights (Windowed)", False, f"Window parameter not respected: {window_hours}")
        else:
            self.log_test("Daily Insights (Windowed)", False, f"Windowed request failed: {data}")
            
        # Test force refresh
        success1, data1, _ = self.make_request('GET', 'ai-coach/daily-insights')
        time.sleep(1)
        success2, data2, _ = self.make_request('GET', 'ai-coach/daily-insights?force=1')
        
        if success1 and success2:
            ts1 = data1.get('generated_at_utc')
            ts2 = data2.get('generated_at_utc')
            if ts1 != ts2:
                self.log_test("Daily Insights (Force Refresh)", True, "Cache bypass working")
            else:
                self.log_test("Daily Insights (Force Refresh)", False, "Cache not bypassed")
        else:
            self.log_test("Daily Insights (Force Refresh)", False, "Force refresh test failed")
            
        return True

    def test_regime_heatmap(self):
        """Test GET /api/ai-coach/regime-heatmap"""
        success, data, status = self.make_request('GET', 'ai-coach/regime-heatmap')
        
        if not success:
            self.log_test("Regime Heatmap", False, f"Request failed: {data}")
            return False
            
        required_fields = ['symbols', 'timeframes', 'cells']
        missing_fields = [f for f in required_fields if f not in data]
        
        if missing_fields:
            self.log_test("Regime Heatmap", False, f"Missing fields: {missing_fields}")
            return False
            
        symbols = data.get('symbols', [])
        timeframes = data.get('timeframes', [])
        cells = data.get('cells', [])
        
        expected_cells = len(symbols) * len(timeframes)
        if len(cells) != expected_cells:
            self.log_test("Regime Heatmap", False, f"Cell count mismatch: expected {expected_cells}, got {len(cells)}")
            return False
            
        # Validate cell structure
        for cell in cells[:3]:  # Check first 3 cells
            required_cell_fields = ['symbol', 'timeframe', 'regime', 'adx']
            missing_cell_fields = [f for f in required_cell_fields if f not in cell]
            if missing_cell_fields:
                self.log_test("Regime Heatmap", False, f"Cell missing fields: {missing_cell_fields}")
                return False
                
        self.log_test("Regime Heatmap", True, f"Generated {len(symbols)}x{len(timeframes)} heatmap ({len(cells)} cells)")
        return True

    def test_strategy_leaderboard(self):
        """Test GET /api/ai-coach/strategy-leaderboard"""
        success, data, status = self.make_request('GET', 'ai-coach/strategy-leaderboard')
        
        if not success:
            self.log_test("Strategy Leaderboard", False, f"Request failed: {data}")
            return False
            
        if 'items' not in data:
            self.log_test("Strategy Leaderboard", False, "Missing 'items' field")
            return False
            
        items = data.get('items', [])
        if not items:
            self.log_test("Strategy Leaderboard", False, "No strategies in leaderboard")
            return False
            
        # Validate item structure
        required_item_fields = ['strategy_family', 'live_signal_count', 'ai_approved_count', 'ai_approval_rate', 'avg_confidence']
        for item in items[:3]:  # Check first 3 items
            missing_item_fields = [f for f in required_item_fields if f not in item]
            if missing_item_fields:
                self.log_test("Strategy Leaderboard", False, f"Item missing fields: {missing_item_fields}")
                return False
                
        # Check if sorted by live_signal_count desc
        signal_counts = [item.get('live_signal_count', 0) for item in items]
        is_sorted = all(signal_counts[i] >= signal_counts[i+1] for i in range(len(signal_counts)-1))
        
        if not is_sorted:
            self.log_test("Strategy Leaderboard", False, "Items not sorted by live_signal_count desc")
            return False
            
        self.log_test("Strategy Leaderboard", True, f"Retrieved {len(items)} strategies, sorted correctly")
        return True

    def test_tune_strategy(self):
        """Test POST /api/ai-coach/tune-strategy"""
        # First get the top strategy from leaderboard
        success, data, status = self.make_request('GET', 'ai-coach/strategy-leaderboard')
        if not success or not data.get('items'):
            self.log_test("Tune Strategy", False, "Cannot get leaderboard for testing")
            return False
            
        top_strategy = data['items'][0]['strategy_family']
        
        # Test valid strategy
        success, data, status = self.make_request('POST', 'ai-coach/tune-strategy', {'strategyId': top_strategy}, timeout=20)
        
        if not success:
            self.log_test("Tune Strategy (Valid)", False, f"Request failed: {data}")
            return False
            
        required_fields = ['strategyId', 'stats', 'advice']
        missing_fields = [f for f in required_fields if f not in data]
        
        if missing_fields:
            self.log_test("Tune Strategy (Valid)", False, f"Missing fields: {missing_fields}")
            return False
            
        self.log_test("Tune Strategy (Valid)", True, f"Tuned strategy {top_strategy}")
        
        # Test invalid strategy
        success, data, status = self.make_request('POST', 'ai-coach/tune-strategy', {'strategyId': 'INVALID_STRATEGY'})
        
        if success and data.get('error') == 'strategy_not_found':
            self.log_test("Tune Strategy (Invalid)", True, "Correctly rejected invalid strategy")
        else:
            self.log_test("Tune Strategy (Invalid)", False, f"Should reject invalid strategy: {data}")
            
        return True

    def test_auto_batch_reasoning(self):
        """Test auto-batch reasoning by waiting and checking history count"""
        print("\n🕐 Testing auto-batch reasoning (waiting 60s for scheduler)...")
        
        # Get initial count
        success, data, status = self.make_request('GET', 'ai-coach/reasoning-history?limit=200')
        if not success:
            self.log_test("Auto-batch Reasoning", False, "Cannot get initial history count")
            return False
            
        initial_reasoned = len([item for item in data.get('items', []) if item.get('ai_verdict') != 'UNKNOWN'])
        print(f"Initial reasoned signals: {initial_reasoned}")
        
        # Wait for auto-batch (30s interval + buffer)
        time.sleep(60)
        
        # Get final count
        success, data, status = self.make_request('GET', 'ai-coach/reasoning-history?limit=200')
        if not success:
            self.log_test("Auto-batch Reasoning", False, "Cannot get final history count")
            return False
            
        final_reasoned = len([item for item in data.get('items', []) if item.get('ai_verdict') != 'UNKNOWN'])
        print(f"Final reasoned signals: {final_reasoned}")
        
        if final_reasoned > initial_reasoned:
            self.log_test("Auto-batch Reasoning", True, f"Auto-batch working: {final_reasoned - initial_reasoned} new reasoned signals")
        else:
            self.log_test("Auto-batch Reasoning", False, f"No new reasoned signals after 60s")
            
        return final_reasoned > initial_reasoned

    def test_rate_limiting(self):
        """Test rate limiting by making rapid requests"""
        print("\n⚡ Testing rate limiting (35 rapid requests)...")
        
        # Get a signal ID
        signals = self.get_live_signals(1)
        if not signals:
            self.log_test("Rate Limiting", False, "No signals available for rate limit testing")
            return False
            
        signal_id = signals[0]['id']
        rate_limited_count = 0
        
        # Make 35 rapid requests
        for i in range(35):
            success, data, status = self.make_request('POST', f'ai-coach/reason-signal/{signal_id}', timeout=5)
            if success and data.get('verdict') == 'UNKNOWN' and 'rate-limited' in data.get('reasoning', ''):
                rate_limited_count += 1
            time.sleep(0.1)  # Small delay to avoid overwhelming
            
        if rate_limited_count > 0:
            self.log_test("Rate Limiting", True, f"Rate limiting working: {rate_limited_count} requests rate-limited")
        else:
            self.log_test("Rate Limiting", False, "No rate limiting detected after 35 requests")
            
        return rate_limited_count > 0

    def test_regression_endpoints(self):
        """Test regression endpoints to ensure they still work"""
        regression_tests = [
            ('GET', 'live/signals?limit=10', 'Live Signals'),
            ('POST', 'ai-coach/chat', 'AI Chat', {'message': 'Test'}),
            ('GET', 'data/providers/health', 'Data Providers Health'),
            ('POST', 'data/providers/auto-select', 'Auto-select Providers', {'requireAIValidation': True, 'apply': False}),
            ('GET', 'owner/dashboard/summary', 'Dashboard Summary')
        ]
        
        all_passed = True
        for method, endpoint, name, *args in regression_tests:
            data = args[0] if args else None
            success, response, status = self.make_request(method, endpoint, data)
            
            if success:
                # Additional validation for specific endpoints
                if endpoint == 'live/signals?limit=10':
                    if response.get('total', 0) > 0:
                        self.log_test(f"Regression: {name}", True, f"Returns {response.get('total')} signals")
                    else:
                        self.log_test(f"Regression: {name}", False, "No signals returned")
                        all_passed = False
                elif endpoint == 'ai-coach/chat':
                    if 'reply' in response and 'model' in response:
                        self.log_test(f"Regression: {name}", True, "Chat working")
                    else:
                        self.log_test(f"Regression: {name}", False, "Missing reply or model")
                        all_passed = False
                elif endpoint == 'data/providers/health':
                    providers = response.get('providers', [])
                    if len(providers) >= 5:
                        self.log_test(f"Regression: {name}", True, f"Returns {len(providers)} providers")
                    else:
                        self.log_test(f"Regression: {name}", False, f"Only {len(providers)} providers")
                        all_passed = False
                elif endpoint == 'data/providers/auto-select':
                    if response.get('aiValidation') is not None:
                        self.log_test(f"Regression: {name}", True, "AI validation working")
                    else:
                        self.log_test(f"Regression: {name}", False, "AI validation null")
                        all_passed = False
                elif endpoint == 'owner/dashboard/summary':
                    if 'global_health_score' in response and 'execution_mode' in response:
                        self.log_test(f"Regression: {name}", True, "Dashboard summary working")
                    else:
                        self.log_test(f"Regression: {name}", False, "Missing required fields")
                        all_passed = False
                else:
                    self.log_test(f"Regression: {name}", True, "Endpoint responding")
            else:
                self.log_test(f"Regression: {name}", False, f"Request failed: {response}")
                all_passed = False
                
        return all_passed

    def test_jest_suite(self):
        """Test Jest test suite"""
        print("\n🧪 Running Jest test suite...")
        
        import subprocess
        import os
        
        try:
            # Change to backend directory and run tests
            result = subprocess.run(
                ['yarn', 'test', '--silent'],
                cwd='/app/moonlight/backend',
                env={**os.environ, 'AI_REASONING_AUTO_BATCH': 'false'},
                capture_output=True,
                text=True,
                timeout=120
            )
            
            output = result.stdout + result.stderr
            
            if result.returncode == 0:
                # Look for test results in output
                if '147' in output and 'PASS' in output:
                    self.log_test("Jest Test Suite", True, "147/147 tests passing")
                    return True
                else:
                    self.log_test("Jest Test Suite", True, "Tests passed (count not verified)")
                    return True
            else:
                self.log_test("Jest Test Suite", False, f"Tests failed: {output[-500:]}")  # Last 500 chars
                return False
                
        except subprocess.TimeoutExpired:
            self.log_test("Jest Test Suite", False, "Tests timed out after 120s")
            return False
        except Exception as e:
            self.log_test("Jest Test Suite", False, f"Error running tests: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting MoonLight v1.8 AI Reasoning Layer Tests\n")
        
        # Core AI Reasoning tests
        self.test_ai_coach_status()
        self.test_reason_signal_single()
        self.test_reason_signal_batch()
        self.test_reasoning_history()
        self.test_daily_insights()
        self.test_regime_heatmap()
        self.test_strategy_leaderboard()
        self.test_tune_strategy()
        
        # Advanced tests
        self.test_auto_batch_reasoning()
        self.test_rate_limiting()
        
        # Regression tests
        self.test_regression_endpoints()
        self.test_jest_suite()
        
        # Print summary
        print(f"\n📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = MoonLightAIReasoningTester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/tmp/moonlight_ai_test_results.json', 'w') as f:
        json.dump({
            'summary': {
                'total_tests': tester.tests_run,
                'passed_tests': tester.tests_passed,
                'success_rate': tester.tests_passed / tester.tests_run if tester.tests_run > 0 else 0,
                'timestamp': datetime.now().isoformat()
            },
            'detailed_results': tester.test_results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
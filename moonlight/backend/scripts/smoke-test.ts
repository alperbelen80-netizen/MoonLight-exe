import * as http from 'http';

const API_BASE = 'http://localhost:8001';

interface TestResult {
  endpoint: string;
  status: number;
  success: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function testEndpoint(
  endpoint: string,
  expectedFields?: string[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${endpoint}`;

    http
      .get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          const success = res.statusCode === 200;

          if (success && expectedFields) {
            try {
              const json = JSON.parse(data);
              for (const field of expectedFields) {
                if (json[field] === undefined) {
                  results.push({
                    endpoint,
                    status: res.statusCode!,
                    success: false,
                    error: `Missing field: ${field}`,
                  });
                  return resolve();
                }
              }
            } catch (err: any) {
              results.push({
                endpoint,
                status: res.statusCode!,
                success: false,
                error: `JSON parse error: ${err.message}`,
              });
              return resolve();
            }
          }

          results.push({
            endpoint,
            status: res.statusCode!,
            success,
            error: success ? undefined : `HTTP ${res.statusCode}`,
          });

          resolve();
        });
      })
      .on('error', (err) => {
        results.push({
          endpoint,
          status: 0,
          success: false,
          error: err.message,
        });
        resolve();
      });
  });
}

async function runSmokeTests() {
  console.log('\n=== MoonLight Smoke Test ===\n');

  await testEndpoint('/owner/dashboard/summary', [
    'global_health_score',
    'execution_mode',
  ]);
  await testEndpoint('/owner/accounts');
  await testEndpoint('/owner/execution-matrix');
  await testEndpoint('/alerts');
  await testEndpoint('/owner/execution-mode', ['mode']);

  console.log('\nResults:\n');

  let allSuccess = true;

  results.forEach((r) => {
    const icon = r.success ? '✅' : '❌';
    console.log(`${icon} ${r.endpoint} - HTTP ${r.status} ${r.error || ''}`);

    if (!r.success) {
      allSuccess = false;
    }
  });

  if (allSuccess) {
    console.log('\n✅ MOONLIGHT_SMOKE_TEST: OK\n');
    process.exit(0);
  } else {
    console.log('\n❌ MOONLIGHT_SMOKE_TEST: FAILED\n');
    process.exit(1);
  }
}

runSmokeTests();

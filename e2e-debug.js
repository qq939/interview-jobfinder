/**
 * 详细诊断脚本 - 检查反代理配置
 */
const http = require('http');
const https = require('https');

const PROXY_URL = 'https://hermit.dimond.top';

function httpRequest(url, method = 'GET', options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: options.headers || {},
      timeout: 30000
    };

    const req = lib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    if (options.body) req.write(options.body);
    req.end();
  });
}

async function diagnose() {
  console.log('🔍 反代理配置诊断\n');
  console.log('='.repeat(60));

  // 测试1: 根路径
  console.log('\n1. GET / (根路径)');
  const root = await httpRequest(PROXY_URL, 'GET');
  console.log(`   状态: ${root.status}`);
  console.log(`   Content-Type: ${root.headers['content-type']}`);

  // 测试2: /man 路径（无斜杠）
  console.log('\n2. GET /man (无斜杠)');
  const manNoSlash = await httpRequest(PROXY_URL + '/man', 'GET');
  console.log(`   状态: ${manNoSlash.status}`);
  console.log(`   Location: ${manNoSlash.headers['location'] || '无'}`);

  // 测试3: /man/ 路径（有斜杠）
  console.log('\n3. GET /man/ (有斜杠)');
  const manSlash = await httpRequest(PROXY_URL + '/man/', 'GET');
  console.log(`   状态: ${manSlash.status}`);
  console.log(`   Content-Type: ${manSlash.headers['content-type']}`);
  console.log(`   内容长度: ${manSlash.body.length}`);

  // 检查 /man/ 返回的内容是否包含我们的页面
  if (manSlash.body.includes('字节跳动')) {
    console.log('   ✅ 包含"字节跳动" - 是我们的页面');
  } else {
    console.log('   ❌ 不包含"字节跳动" - 不是我们的页面');
  }

  // 测试4: /man/api/claude
  console.log('\n4. POST /man/api/claude');
  const manApi = await httpRequest(PROXY_URL + '/man/api/claude', 'POST', {
    headers: {
      'Content-Type': 'multipart/form-data; boundary=----test',
      'User-Agent': 'Test'
    },
    body: '------test\r\nContent-Disposition: form-data; name="text"\r\n\r\ntest\r\n------test--\r\n'
  });
  console.log(`   状态: ${manApi.status}`);
  console.log(`   Content-Type: ${manApi.headers['content-type']}`);
  console.log(`   响应: ${manApi.body.substring(0, 200)}`);

  // 测试5: /api/claude（直接路径）
  console.log('\n5. POST /api/claude (直接路径)');
  const directApi = await httpRequest(PROXY_URL + '/api/claude', 'POST', {
    headers: {
      'Content-Type': 'multipart/form-data; boundary=----test',
      'User-Agent': 'Test'
    },
    body: '------test\r\nContent-Disposition: form-data; name="text"\r\n\r\ntest\r\n------test--\r\n'
  });
  console.log(`   状态: ${directApi.status}`);
  console.log(`   Content-Type: ${directApi.headers['content-type']}`);
  console.log(`   响应: ${directApi.body.substring(0, 200)}`);

  // 测试6: /jobfinder/ (用户原本的路径)
  console.log('\n6. GET /jobfinder/');
  const jobfinder = await httpRequest(PROXY_URL + '/jobfinder/', 'GET');
  console.log(`   状态: ${jobfinder.status}`);
  console.log(`   Content-Type: ${jobfinder.headers['content-type']}`);
  if (jobfinder.body.includes('字节跳动')) {
    console.log('   ✅ 包含"字节跳动"');
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n💡 诊断结论:');

  if (manSlash.status === 200 && manSlash.body.includes('字节跳动')) {
    console.log('   /man/ 正确返回了我们的页面');
  }

  if (manApi.status === 404) {
    console.log('   ❌ /man/api/claude 返回 404');
    console.log('   原因: 反代理没有配置 /man/api/claude 路由');
    console.log('\n   需要修改反代理配置，添加:');
    console.log('   location /man/api/claude {');
    console.log('     proxy_pass http://localhost:8082/api/claude;');
    console.log('   }');
  }

  if (directApi.status !== 404) {
    console.log('   ✅ /api/claude 可能有配置');
  }
}

diagnose().catch(console.error);

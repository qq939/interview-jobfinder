/**
 * HTTP 端到端测试 - 测试反代理接口
 * 测试地址：https://hermit.dimond.top/man
 */
const http = require('http');
const https = require('https');

const PROXY_URL = 'https://hermit.dimond.top';
const LOCAL_URL = 'http://localhost:8082';

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
      timeout: 60000 // 60秒超时
    };

    console.log(`\n📤 ${method} ${url}`);
    console.log('   Headers:', JSON.stringify(reqOptions.headers));

    const req = lib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`   HTTP Status: ${res.statusCode}`);
        console.log('   Headers:', JSON.stringify(res.headers));
        console.log('   Response length:', data.length);

        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
          bodyPreview: data.substring(0, 500)
        });
      });
    });

    req.on('error', (e) => {
      console.error(`   ❌ 请求错误: ${e.message}`);
      reject(e);
    });

    req.on('timeout', () => {
      console.error('   ❌ 请求超时');
      req.destroy();
      reject(new Error('请求超时'));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function buildFormData(fields) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substr(2, 15);
  let parts = [];

  for (const [name, value] of Object.entries(fields)) {
    parts.push(`--${boundary}`);
    parts.push(`Content-Disposition: form-data; name="${name}"`);
    parts.push('');
    parts.push(value);
  }

  parts.push(`--${boundary}--`);

  return {
    boundary,
    body: parts.join('\r\n')
  };
}

async function testAPI(targetUrl, description) {
  console.log('\n' + '='.repeat(60));
  console.log(`📍 测试: ${description}`);
  console.log('='.repeat(60));

  const { boundary, body } = buildFormData({ text: '你好，测试一下' });

  try {
    const response = await httpRequest(targetUrl, 'POST', {
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': '*/*',
        'Origin': targetUrl.replace('/api/claude', ''),
        'Referer': targetUrl.replace('/api/claude', '/')
      },
      body: body
    });

    console.log('\n📥 响应预览:');
    console.log(response.bodyPreview);

    // 尝试解析 JSON
    try {
      const json = JSON.parse(response.body);
      console.log('\n✅ 响应是有效的 JSON');
      console.log('   字段:', Object.keys(json));

      if (json.error) {
        console.log('\n❌ API 返回错误:');
        console.log('   ', json.error);
      } else if (json.response) {
        console.log('\n✅ API 返回正常响应');
        console.log('   响应长度:', json.response.length);
        console.log('   响应预览:', json.response.substring(0, 100) + '...');
      }
    } catch (e) {
      console.log('\n❌ 响应不是有效的 JSON');
      console.log('   解析错误:', e.message);

      // 检查是否返回了 HTML（可能是反代理的错误页面）
      if (response.body.includes('<html') || response.body.includes('<!DOCTYPE')) {
        console.log('\n⚠️ 可能返回了 HTML 页面而非 JSON');
        console.log('   这通常是反代理配置问题');

        // 提取页面标题
        const titleMatch = response.body.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch) {
          console.log('   页面标题:', titleMatch[1]);
        }
      }
    }

    return response;
  } catch (error) {
    console.error('\n❌ 请求失败:', error.message);
    return null;
  }
}

async function testPage(targetUrl, description) {
  console.log('\n' + '='.repeat(60));
  console.log(`📍 测试页面: ${description}`);
  console.log('='.repeat(60));

  try {
    const response = await httpRequest(targetUrl, 'GET', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });

    // 检查页面内容
    if (response.body.includes('字节跳动')) {
      console.log('\n✅ 页面包含"字节跳动"');
    }

    if (response.body.includes('AI助手')) {
      console.log('\n✅ 页面包含"AI助手"');
    }

    if (response.body.includes('chat-messages')) {
      console.log('\n✅ 页面包含聊天区域');
    }

    if (response.body.includes('/api/claude')) {
      console.log('\n✅ 页面引用了 /api/claude 接口');
    } else {
      console.log('\n⚠️ 页面没有引用 /api/claude 接口');
    }

    return response;
  } catch (error) {
    console.error('\n❌ 页面加载失败:', error.message);
    return null;
  }
}

async function runTests() {
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(10) + '反代理接口端到端测试' + ' '.repeat(20) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');

  // 测试1: 本机服务页面
  await testPage(LOCAL_URL, '本机服务 (localhost:8082)');

  // 测试2: 反代理页面
  await testPage(PROXY_URL + '/man', '反代理服务 (hermit.dimond.top/man)');

  // 测试3: 本机 API
  await testAPI(LOCAL_URL + '/api/claude', '本机 API (localhost:8082/api/claude)');

  // 测试4: 反代理 API
  await testAPI(PROXY_URL + '/man/api/claude', '反代理 API (hermit.dimond.top/man/api/claude)');

  // 测试5: 检查反代理路由配置
  console.log('\n' + '='.repeat(60));
  console.log('📍 检查反代理配置');
  console.log('='.repeat(60));

  // 测试根路径
  await httpRequest(PROXY_URL, 'GET', {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': '*/*'
    }
  });

  // 测试 /man 路径
  await httpRequest(PROXY_URL + '/man', 'GET', {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'text/html'
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log('测试完成');
  console.log('='.repeat(60));

  console.log('\n💡 如果反代理 API 返回 HTML 而非 JSON，可能的原因:');
  console.log('   1. 反代理没有正确配置 /api/claude 路由');
  console.log('   2. 反代理超时或服务不可用');
  console.log('   3. 反代理返回了错误页面');
  console.log('\n   建议检查:');
  console.log('   - 反代理配置中是否包含 /api/claude 的路由');
  console.log('   - 反代理是否设置了正确的 Content-Type');
  console.log('   - 反代理的超时设置');
}

runTests().catch(console.error);

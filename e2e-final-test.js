/**
 * 最终诊断 - 测试正确的路径
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
      timeout: 60000
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
      reject(new Error('超时'));
    });

    if (options.body) req.write(options.body);
    req.end();
  });
}

function buildFormData(text) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substr(2, 15);
  const body = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="text"`,
    '',
    text,
    `--${boundary}--`
  ].join('\r\n');
  return { boundary, body };
}

async function test() {
  console.log('🔍 测试正确的路径组合\n');

  // 测试 /jobfinder/ 页面
  console.log('1. GET /jobfinder/');
  const page = await httpRequest(PROXY_URL + '/jobfinder/', 'GET');
  console.log(`   状态: ${page.status}`);
  if (page.body.includes('字节跳动')) {
    console.log('   ✅ 这是我们的页面');
  }
  if (page.body.includes('api/claude')) {
    console.log('   ✅ 页面包含 API 引用');
  }

  // 测试 /jobfinder/api/claude
  console.log('\n2. POST /jobfinder/api/claude');
  const { boundary, body } = buildFormData('测试消息');
  const api = await httpRequest(PROXY_URL + '/jobfinder/api/claude', 'POST', {
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'User-Agent': 'Test/1.0'
    },
    body: body
  });
  console.log(`   状态: ${api.status}`);
  console.log(`   Content-Type: ${api.headers['content-type']}`);

  if (api.body.startsWith('{')) {
    try {
      const json = JSON.parse(api.body);
      console.log('   ✅ 返回有效 JSON');
      if (json.response) {
        console.log('   ✅ 有 response 字段');
        console.log('   响应预览:', json.response.substring(0, 80) + '...');
      }
      if (json.error) {
        console.log('   ❌ 返回错误:', json.error);
      }
    } catch (e) {
      console.log('   ❌ JSON 解析失败');
    }
  } else {
    console.log('   ❌ 返回的不是 JSON');
    console.log('   响应:', api.body.substring(0, 200));
  }

  // 测试用户原本的路径 /jobfinder/
  console.log('\n3. 用户原本访问的路径:');
  console.log(`   ${PROXY_URL}/jobfinder/`);
  console.log('   应该能正常显示页面和发送消息');

  // 检查页面中的 fetch 调用
  if (page.body.includes('fetch("api/claude"') || page.body.includes("fetch('api/claude'") || page.body.includes('fetch("api/claude"') || page.body.includes('fetch(`api/claude`')) {
    console.log('   ✅ 页面使用相对路径 api/claude');
    console.log('   这意味着通过 /jobfinder/ 访问时，API 请求会发送到 /jobfinder/api/claude');
  } else if (page.body.includes('fetch("/api/claude"') || page.body.includes("fetch('/api/claude'")) {
    console.log('   ⚠️ 页面使用绝对路径 /api/claude');
    console.log('   这会导致请求发送到根路径的 /api/claude，可能返回 404');
    console.log('   需要修改前端代码使用相对路径');
  }
}

test().catch(console.error);

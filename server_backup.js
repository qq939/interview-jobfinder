const http = require('http');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const PORT = 8082;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const EXTRACT_DIR = path.join(__dirname, 'uploads', 'extracted');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(EXTRACT_DIR)) fs.mkdirSync(EXTRACT_DIR, { recursive: true });

const SLUGS = {
  "K个一组翻转链表": "reverse-nodes-in-k-group",
  "买卖股票": "best-time-to-buy-and-sell-stock",
  "三数之和": "3sum",
  "最小栈": "min-stack",
  "二叉树最大路径和": "binary-tree-maximum-path-sum",
  "二叉树右视图": "binary-tree-right-side-view",
  "无重复字符最长子串": "longest-substring-without-repeating-characters",
  "合并有序数组": "merge-sorted-array",
  "有序数组转二叉搜索树": "convert-sorted-array-to-binary-search-tree",
  "平衡二叉树": "balanced-binary-tree",
  "二叉树最近公共祖先": "lowest-common-ancestor-of-a-binary-tree",
  "搜索旋转排序数组": "search-in-rotated-sorted-array",
  "零钱兑换": "coin-change",
  "反转链表": "reverse-linked-list",
  "二叉树前序遍历": "binary-tree-preorder-traversal",
  "长度最小的子数组": "minimum-size-subarray-sum",
  "复原IP地址": "restore-ip-addresses",
  "数组第K个最大元素": "kth-largest-element-in-an-array",
  "翻转二叉树": "invert-binary-tree",
  "二叉树中序遍历": "binary-tree-inorder-traversal",
  "相交链表": "intersection-of-two-linked-lists",
  "岛屿数量": "number-of-islands",
  "函数独占时间": "exclusive-time-of-functions",
  "二叉树锯齿形层次遍历": "binary-tree-zigzag-level-order-traversal",
  "最大子序和": "maximum-subarray",
  "字符串解码": "decode-string",
  "最大数": "largest-number",
  "两数之和": "two-sum",
  "数组中出现次数超过一半的数字": "majority-element",
  "有效括号": "valid-parentheses",
};

const DATA = {
  "后端": [
    { name: "K个一组翻转链表", count: 4 },
    { name: "买卖股票", count: 4 },
    { name: "三数之和", count: 3 },
    { name: "最小栈", count: 3 },
    { name: "二叉树最大路径和", count: 3 },
    { name: "二叉树右视图", count: 3 },
    { name: "无重复字符最长子串", count: 3 },
    { name: "合并有序数组", count: 3 },
    { name: "有序数组转二叉搜索树", count: 3 },
    { name: "平衡二叉树", count: 3 },
    { name: "二叉树最近公共祖先", count: 3 },
    { name: "搜索旋转排序数组", count: 3 },
    { name: "零钱兑换", count: 3 },
  ],
  "客户端": [
    { name: "反转链表", count: 4 },
    { name: "二叉树前序遍历", count: 4 },
    { name: "二叉树最近公共祖先", count: 3 },
    { name: "K个一组翻转链表", count: 3 },
    { name: "买卖股票", count: 3 },
    { name: "最大子序和", count: 3 },
    { name: "字符串解码", count: 3 },
  ],
  "前端": [
    { name: "长度最小的子数组", count: 4 },
    { name: "复原IP地址", count: 2 },
    { name: "数组第K个最大元素", count: 2 },
    { name: "翻转二叉树", count: 2 },
    { name: "二叉树中序遍历", count: 2 },
  ],
  "算法岗": [
    { name: "相交链表", count: 1 },
    { name: "数组第K个最大元素", count: 1 },
    { name: "搜索旋转排序数组", count: 1 },
    { name: "岛屿数量", count: 1 },
    { name: "函数独占时间", count: 1 },
    { name: "二叉树锯齿形层次遍历", count: 1 },
  ],
  "测试岗": [
    { name: "最大数", count: 2 },
    { name: "两数之和", count: 2 },
    { name: "三数之和", count: 2 },
    { name: "无重复字符最长子串", count: 1 },
    { name: "相交链表", count: 1 },
    { name: "数组中出现次数超过一半的数字", count: 1 },
    { name: "有效括号", count: 1 },
  ],
};

const COLORS = {
  "后端":   { color: "#58a6ff" },
  "客户端": { color: "#3fb950" },
  "前端":   { color: "#d2a8ff" },
  "算法岗": { color: "#f0883e" },
  "测试岗": { color: "#ff7b72" },
};

// 列出文件
function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).map(name => {
    const fp = path.join(dir, name);
    const stat = fs.statSync(fp);
    const ext = path.extname(name).toLowerCase();
    const isDir = stat.isDirectory();
    const size = isDir ? null : stat.size;
    const prettySize = size
      ? (size < 1024 ? size + ' B' : size < 1024 * 1024 ? (size / 1024).toFixed(1) + ' KB' : (size / 1024 / 1024).toFixed(1) + ' MB')
      : null;
    return { name, isDir, size, prettySize, ext, modified: stat.mtime.toLocaleString('zh-CN') };
  });
}

// 处理 ZIP 上传
function handleUpload(req, res) {
  let body = [];
  req.on('data', c => body.push(c));
  req.on('end', () => {
    const buf = Buffer.concat(body);
    const m = req.headers['content-type'] && req.headers['content-type'].match(/boundary=(?:"([^"]+)"|([^;]+))/);
    if (!m) return json(res, 400, { error: '无法解析 multipart' });
    const b = m[1] || m[2];
    const parts = buf.toString('binary').split('--' + b);

    const uploaded = [], extracted = [];

    for (const part of parts) {
      if (!part.includes('filename="')) continue;
      const he = part.indexOf('\r\n\r\n');
      if (he === -1) continue;
      const hdr = part.substring(0, he);
      const fnMatch = hdr.match(/filename="([^"]+)"/);
      if (!fnMatch) continue;
      let fn = fnMatch[1].replace(/[\/\\:*?"<>|]/g, '_');
      const content = part.substring(he + 4).replace(/\r\n$/, '');
      if (!content.length) continue;

      const fp = path.join(UPLOAD_DIR, fn);
      fs.writeFileSync(fp, Buffer.from(content, 'binary'));
      uploaded.push(fn);

      if (/\.zip$/i.test(fn)) {
        try {
          const zip = new AdmZip(fp);
          const base = fn.replace(/\.zip$/i, '');
          const td = path.join(EXTRACT_DIR, base);
          if (!fs.existsSync(td)) fs.mkdirSync(td, { recursive: true });
          zip.extractAllTo(td, true);
          extracted.push({ zip: fn, files: zip.getEntries().map(e => e.entryName) });
        } catch (e) {
          extracted.push({ zip: fn, error: e.message });
        }
      }
    }

    json(res, 200, {
      success: true,
      uploaded,
      extracted,
      message: '上传成功' + (extracted.length ? '，ZIP 已自动解压' : ''),
    });
  });
}

function handlePreview(req, res) {
  const fn = decodeURIComponent(req.url.split('/preview/')[1] || '');
  const fp1 = path.join(UPLOAD_DIR, fn);
  const fp2 = path.join(EXTRACT_DIR, fn);
  const rp = fs.existsSync(fp1) ? fp1 : fs.existsSync(fp2) ? fp2 : null;
  if (!rp) return json(res, 404, { error: '文件不存在' });
  const PREVIEW_EXTS = ['.txt', '.md', '.json', '.js', '.ts', '.py', '.java', '.c', '.cpp', '.h', '.css', '.html', '.xml', '.yaml', '.yml', '.sh', '.sql', '.csv', '.log'];
  if (!PREVIEW_EXTS.includes(path.extname(fn).toLowerCase())) {
    return json(res, 400, { error: '该类型不支持预览，支持：' + PREVIEW_EXTS.join(' ') });
  }
  const content = fs.readFileSync(rp, 'utf8');
  json(res, 200, { filename: fn, content: content.substring(0, 80000) });
}

function handleDelete(req, res) {
  const fn = decodeURIComponent(req.url.split('/delete/')[1] || '');
  for (const d of [UPLOAD_DIR, EXTRACT_DIR]) {
    const fp = path.join(d, fn);
    if (fs.existsSync(fp)) fs.rmSync(fp, { recursive: true });
  }
  json(res, 200, { success: true });
}

function handleDownload(req, res) {
  const fn = decodeURIComponent(req.url.split('/download/')[1] || '');
  const fp1 = path.join(UPLOAD_DIR, fn);
  const fp2 = path.join(EXTRACT_DIR, fn);
  const rp = fs.existsSync(fp1) ? fp1 : fs.existsSync(fp2) ? fp2 : null;
  if (!rp) return json(res, 404, { error: '文件不存在' });
  res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename=' + Buffer.from(path.basename(fn)) });
  fs.createReadStream(rp).pipe(res);
}

function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  const url = req.url;
  if (url === '/' && req.method === 'GET') {
    const uploads = listFiles(UPLOAD_DIR);
    const extracted = fs.readdirSync(EXTRACT_DIR).map(name => {
      const fp = path.join(EXTRACT_DIR, name);
      return { name, files: listFiles(fp), count: fs.readdirSync(fp).length };
    });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(buildHTML({ uploads, extracted }));
  } else if (url === '/upload' && req.method === 'POST') {
    handleUpload(req, res);
  } else if (url === '/files' && req.method === 'GET') {
    const uploads = listFiles(UPLOAD_DIR);
    const extracted = fs.readdirSync(EXTRACT_DIR).map(name => {
      const fp = path.join(EXTRACT_DIR, name);
      return { name, files: listFiles(fp), count: fs.readdirSync(fp).length };
    });
    json(res, 200, { uploads, extracted });
  } else if (url.startsWith('/preview/') && req.method === 'GET') {
    handlePreview(req, res);
  } else if (url.startsWith('/delete/') && req.method === 'GET') {
    handleDelete(req, res);
  } else if (url.startsWith('/download/') && req.method === 'GET') {
    handleDownload(req, res);
  } else {
    res.writeHead(404); res.end();
  }
});


function buildHTML(ctx) {
  const { uploads, extracted } = ctx;
  const SLUGS_JS = JSON.stringify(SLUGS);
  const DATA_JS  = JSON.stringify(DATA);
  const COLORS_JS = JSON.stringify(COLORS);
  const uploadsJson = JSON.stringify(uploads);
  const extractedJson = JSON.stringify(extracted);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>字节跳动 · 面试题直通车</title>
<style>
:root{--bg:#0d1117;--sf:#161b22;--bd:#30363d;--ac:#58a6ff;--tx:#c9d1d9;--mt:#8b949e;--gr:#3fb950;--or:#f0883e;--rd:#ff7b72;--pu:#d2a8ff;}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--tx);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;min-height:100vh;padding:2rem}

/* 上传区 */
#uploadZone{max-width:900px;margin:0 auto 2.5rem;background:var(--sf);border:2px dashed var(--bd);border-radius:16px;padding:2.5rem;text-align:center;transition:all .3s;cursor:pointer;user-select:none}
#uploadZone:hover,#uploadZone.drag{	border-color:var(--ac);background:#58a6ff08}
#uploadZone input{display:none}
.uicon{font-size:3rem;margin-bottom:.8rem}
.uz-title{color:var(--ac);font-size:1.1rem;font-weight:700;margin-bottom:.4rem}
.uz-sub{color:var(--mt);font-size:.85rem}
.uz-hint{margin-top:.8rem;font-size:.75rem;color:var(--mt)}

/* 进度条 */
#pbar{height:3px;background:var(--bd);border-radius:2px;margin:.5rem auto 0;max-width:900px;display:none;overflow:hidden}
#pbar.on{display:block}
#pf{height:100%;background:var(--ac);width:0;transition:width .3s}

/* 上传结果 */
#ures{margin-top:1rem;max-width:900px;margin-left:auto;margin-right:auto;display:none}
#ures.on{display:block}
.rc{background:var(--sf);border:1px solid var(--bd);border-radius:12px;padding:1rem 1.2rem;margin-bottom:.6rem}
.rc.ok{border-color:#3fb95050}
.badge{font-weight:700}
.badge-g{color:var(--gr)}
.badge-o{color:var(--or)}
.badge-r{color:var(--rd)}
.rc ul{margin:.3rem 0 0 1.2rem;color:var(--mt);font-size:.8rem}
.rc li{margin-bottom:.2rem}

/* 分隔线 */
hr{max-width:900px;margin:0 auto 2.5rem;border:none;border-top:1px solid var(--bd)}

/* 面试题头部 */
.hh{text-align:center;margin-bottom:2.5rem}
.hh h1{font-size:2rem;color:var(--ac);margin-bottom:.5rem}
.hh p{color:var(--mt);font-size:.9rem}
.hh .sub{margin-top:.4rem;color:var(--gr)}

/* 标签切换 */
.tabs{display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center;margin-bottom:2rem}
.tab{background:var(--sf);border:1px solid var(--bd);color:var(--mt);padding:.5rem 1.2rem;border-radius:8px;cursor:pointer;font-size:.9rem;transition:all .2s;font-family:inherit}
.tab:hover{border-color:var(--ac);color:var(--ac)}
.tab.ac{color:#fff;font-weight:600}

/* 题目卡片 */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:1rem;max-width:1100px;margin:0 auto}
.card{background:var(--sf);border:1px solid var(--bd);border-radius:12px;padding:1.2rem;transition:all .2s;position:relative;overflow:hidden}
.card:hover{transform:translateY(-3px);box-shadow:0 8px 30px rgba(0,0,0,.4)}
.cb{position:absolute;top:12px;right:12px;font-size:.7rem;padding:.2rem .55rem;border-radius:20px;font-weight:700}
.cm{display:flex;align-items:baseline;gap:.4rem;margin-bottom:.3rem}
.cc{font-size:2.2rem;font-weight:800;line-height:1}
.ct{font-size:.75rem;color:var(--mt)}
.cn{font-size:1.05rem;font-weight:600;margin-bottom:.9rem;line-height:1.4}
.tags{margin-bottom:.8rem}
.tag{display:inline-block;font-size:.7rem;padding:.15rem .5rem;border-radius:12px;margin-right:.3rem;font-weight:600}
.tag-h{background:#ff7b7233;color:#ff7b72}
.tag-m{background:#f0883e33;color:#f0883e}
.tag-l{background:#3fb95033;color:#3fb950}
.cl{display:inline-flex;align-items:center;gap:.4rem;padding:.45rem 1rem;border-radius:8px;text-decoration:none;font-size:.85rem;font-weight:600;transition:all .2s;border:1px solid}
.cl:hover{filter:brightness(1.15);transform:translateX(2px)}

/* 文件区 */
.fs{max-width:900px;margin:0 auto}
.fs h2{color:var(--tx);font-size:1.05rem;margin-bottom:1rem;display:flex;align-items:center;gap:.5rem}
.fs h2 span{color:var(--mt);font-size:.8rem;font-weight:400}
.fgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:.8rem}
.fc{background:var(--sf);border:1px solid var(--bd);border-radius:10px;padding:.9rem;transition:border-color .2s}
.fc:hover{border-color:var(--ac)}
.fn{font-size:.85rem;font-weight:600;word-break:break-all;margin-bottom:.3rem}
.fm{font-size:.72rem;color:var(--mt);margin-bottom:.6rem}
.fa{display:flex;gap:.4rem;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;gap:.25rem;padding:.25rem .55rem;border-radius:6px;font-size:.72rem;font-weight:600;cursor:pointer;border:none;transition:all .2s;text-decoration:none;font-family:inherit}
.btn-dl{background:#58a6ff20;color:var(--ac);border:1px solid #58a6ff50}
.btn-dl:hover{background:#58a6ff35}
.btn-pv{background:#3fb95020;color:var(--gr);border:1px solid #3fb95050}
.btn-pv:hover{background:#3fb95035}
.btn-rm{background:#ff7b7220;color:var(--rd);border:1px solid #ff7b7250;cursor:pointer;font-family:inherit}
.btn-rm:hover{background:#ff7b7235}
.et{display:inline-block;font-size:.65rem;padding:.1rem .4rem;border-radius:4px;margin-right:.3rem;font-weight:700}
.ez{background:#f0883e30;color:#f0883e}
.etx{background:#3fb95030;color:#3fb950}
.edf{background:#8b949e30;color:#8b949e}

/* 预览弹窗 */
#pm{position:fixed;inset:0;background:rgba(0,0,0,.75);display:none;justify-content:center;align-items:center;z-index:999;padding:1rem}
#pm.open{display:flex}
#pb{background:var(--sf);border:1px solid var(--bd);border-radius:16px;width:100%;max-width:900px;max-height:82vh;display:flex;flex-direction:column}
#ph{padding:1rem 1.2rem;border-bottom:1px solid var(--bd);display:flex;justify-content:space-between;align-items:center;font-weight:600;font-size:.95rem}
#pcl{background:none;border:none;color:var(--mt);font-size:1.5rem;cursor:pointer;padding:.1rem .5rem;line-height:1}
#pcl:hover{color:var(--tx)}
#pc{overflow:auto;padding:1rem 1.2rem;flex:1;font-family:"Fira Code","Cascadia Code",monospace;font-size:.82rem;white-space:pre-wrap;word-break:break-all;color:#e6edf3;background:#0d0d0d;border-radius:0 0 16px 16px;line-height:1.65}
.empty{color:var(--mt);text-align:center;padding:1.5rem;font-size:.85rem}
.ft{text-align:center;color:var(--mt);font-size:.8rem;margin-top:2.5rem;padding-top:1rem;border-top:1px solid var(--bd)}
.ft a{color:var(--ac);text-decoration:none}
</style>
</head>
<body>

<!-- 上传区 -->
<div id="uploadZone" onclick="fi.click()">
  <input type="file" id="fi" multiple style="display:none"/>
  <div class="uicon">📎</div>
  <div class="uz-title">点击或拖拽文件到此处上传</div>
  <div class="uz-sub">支持简历、压缩包（ZIP 自动解压）等任意文件，可同时上传多个</div>
  <div class="uz-hint">ZIP 压缩包上传后自动解压，可在下方「已解压文件」中查看</div>
</div>
<div id="pbar"><div id="pf"></div></div>
<div id="ures"></div>

<hr/>

<!-- 面试题 -->
<div class="hh">
  <h1>&#128293; 字节跳动 · 面试题直通车</h1>
  <p>按岗位分类 · 数据来源：<strong>Nowcoder 面经</strong>（约120+篇，190+条算法题）</p>
  <p class="sub">&#10003; 每题均附 LeetCode 刷题链接，点按钮即可跳转</p>
</div>
<div class="tabs" id="tabs"></div>
<div class="grid" id="grid"></div>

<!-- 文件管理 -->
<div class="fs">
  <h2>&#128193; 已上传文件 <span id="fcnt"></span></h2>
  <div class="fgrid" id="fgrid"></div>
</div>

<div class="ft">
  数据来源：<a href="https://www.nowcoder.com/discuss/353156554083999744" target="_blank">Nowcoder</a> &nbsp;·&nbsp;
  GitHub：<a href="https://github.com/afatcoder/LeetcodeTop" target="_blank">afatcoder/LeetcodeTop</a>
</div>

<!-- 预览弹窗 -->
<div id="pm">
  <div id="pb">
    <div id="ph"><span id="ptit"></span><button id="pcl" onclick="cp()">&#215;</button></div>
    <div id="pc">加载中...</div>
  </div>
</div>

<script>
var SLUGS=${SLUGS_JS};
var DATA=${DATA_JS};
var COLORS=${COLORS_JS};
var uploads=${uploadsJson};
var extracted=${extractedJson};
var active=Object.keys(DATA)[0];

// 上传
var zone=document.getElementById('uploadZone');
var fi=document.getElementById('fi');
var pbar=document.getElementById('pbar');
var pf=document.getElementById('pf');
var ures=document.getElementById('ures');

zone.addEventListener('dragover',function(e){e.preventDefault();zone.classList.add('drag')});
zone.addEventListener('dragleave',function(){zone.classList.remove('drag')});
zone.addEventListener('drop',function(e){e.preventDefault();zone.classList.remove('drag');upl(e.dataTransfer.files)});
fi.addEventListener('change',function(){upl(this.files)});

function upl(files){
  if(!files||!files.length)return;
  var fd=new FormData();
  for(var i=0;i<files.length;i++) fd.append('f'+i,files[i]);
  var x=new XMLHttpRequest();
  x.open('POST','/upload');
  pbar.classList.add('on');pf.style.width='30%';
  x.upload.onprogress=function(e){if(e.lengthComputable)pf.style.width=(e.loaded/e.total*100)+'%'};
  x.onload=function(){
    pf.style.width='100%';
    setTimeout(function(){pbar.classList.remove('on');pf.style.width='0'},800);
    var r=JSON.parse(x.responseText);
    if(r.success){
      var h='<div class="rc ok"><span class="badge badge-g">&#10003; '+r.message+'</span></div>';
      for(var i=0;i<r.extracted.length;i++){
        var e=r.extracted[i];
        var err=e.error?'<li class="badge badge-r">解压失败: '+e.error+'</li>':'';
        var fs=e.files.slice(0,15).map(function(f){return'<li>'+f+'</li>'}).join('');
        h+='<div class="rc ok"><span class="badge badge-o">&#128230; ZIP已解压: '+e.zip+'</span><ul>'+fs+err+'</ul></div>';
      }
      ures.innerHTML=h;ures.classList.add('on');
      rf();
    } else {
      ures.innerHTML='<div class="rc"><span class="badge badge-r">&#10007; '+r.error+'</span></div>';ures.classList.add('on');
    }
  };
  x.send(fd);
}

function rf(){
  var x=new XMLHttpRequest();x.open('GET','/files');
  x.onload=function(){var r=JSON.parse(x.responseText);uploads=r.uploads;extracted=r.extracted;rf2()};
  x.send();
}

function rf2(){
  document.getElementById('fcnt').textContent='('+(uploads.length+extracted.length)+' 个)';
  var g=document.getElementById('fgrid');
  var h='';
  for(var i=0;i<uploads.length;i++){h+=fc(uploads[i])}
  for(var j=0;j<extracted.length;j++){h+=ec(extracted[j])}
  g.innerHTML=h||'<div class="empty">暂无上传文件</div>';
}

function extTag(name){
  var e=name.replace(/.*\./,'').toLowerCase();
  if(e==='zip')return'<span class="et ez">ZIP</span>';
  if(['txt','md'].indexOf(e)!==-1)return'<span class="et etx">TXT</span>';
  if(['jpg','jpeg','png','gif','webp'].indexOf(e)!==-1)return'<span class="et edf">IMG</span>';
  return'';
}

function fc(f){
  var actions='<a class="btn btn-dl" href="/download/'+encodeURIComponent(f.name)+'" download>&#11015; 下载</a>';
  var pexts=['txt','md','json','js','ts','py','java','c','cpp','h','css','html','xml','yaml','yml','sh','sql','csv'];
  if(pexts.indexOf(f.ext)!==-1)actions+='<button class="btn btn-pv" onclick="pv(\''+encodeURIComponent(f.name)+'\')">&#128065; 预览</button>';
  actions+='<button class="btn btn-rm" onclick="dl(\''+encodeURIComponent(f.name)+'\')">&#10005; 删除</button>';
  return'<div class="fc">'+extTag(f.name)+'<div class="fn">'+f.name+'</div><div class="fm">'+(f.prettySize||'')+(f.modified?' · '+f.modified:'')+'</div><div class="fa">'+actions+'</div></div>';
}

function ec(e){
  var h='<div class="fc"><span class="et ez">ZIP</span><div class="fn">'+e.name+'</div><div class="fm">'+e.count+' 个文件</div><div class="fa">';
  h+='<button class="btn btn-pv" onclick="shEx(\''+encodeURIComponent(e.name)+'\')">&#128065; 查看内容</button>';
  h+='<button class="btn btn-rm" onclick="dl(\''+encodeURIComponent(e.name)+'\')">&#10005; 删除</button>';
  h+='</div></div>';
  return h;
}

function shEx(name){
  var ef=[];
  for(var i=0;i<extracted.length;i++)if(extracted[i].name===decodeURIComponent(name)){ef=extracted[i].files;break}
  var h='<div style="padding:.5rem 0;">';
  for(var j=0;j<ef.length;j++){
    var f=ef[j],isDir=f.endsWith('/'),ext=f.replace(/.*\./,'').toLowerCase();
    var pexts=['txt','md','json','js','ts','py','java','c','cpp','h','css','html','xml','yaml','yml','sh','sql','csv'];
    var canPv=!isDir&&pexts.indexOf(ext)!==-1;
    h+='<div style="display:flex;align-items:center;gap:.5rem;padding:.4rem 0;border-bottom:1px solid #30363d;font-size:.85rem;">';
    h+='<span style="color:#8b949e">'+(isDir?'&#128193;':'&#128196;')+'</span>';
    h+='<span style="flex:1;word-break:break-all">'+f.replace(/\/$/,'')+'</span>';
    if(canPv)h+='<button class="btn btn-pv" style="font-size:.7rem" onclick="pv(\''+encodeURIComponent(name+'/'+f.replace(/\/$/,''))+'\')\">&#128065;</button>';
    h+='<a class="btn btn-dl" style="font-size:.7rem" href="/download/'+encodeURIComponent(name+'/'+f.replace(/\/$/,''))+'">&#11015;</a>';
    h+='</div>';
  }
  h+='</div>';
  document.getElementById('ptit').textContent='📦 '+decodeURIComponent(name)+' ('+ef.length+' 个文件)';
  document.getElementById('pc').innerHTML=h;
  document.getElementById('pm').classList.add('open');
}

function pv(name){
  var x=new XMLHttpRequest();
  document.getElementById('pc').innerHTML='<div class="empty">加载中...</div>';
  document.getElementById('ptit').textContent=decodeURIComponent(name);
  document.getElementById('pm').classList.add('open');
  x.open('GET','/preview/'+name);
  x.onload=function(){
    var r=JSON.parse(x.responseText);
    document.getElementById('pc').textContent=r.error?r.error:r.content||'(空文件)');
  };
  x.send();
}

function cp(){document.getElementById('pm').classList.remove('open')}
function dl(name){if(!confirm('确定删除 '+decodeURIComponent(name)+' 吗？'))return;var x=new XMLHttpRequest();x.open('GET','/delete/'+name);x.onload=function(){rf()};x.send()}

// 面试题渲染
function gt(c){return c>=4?'<span class="tag tag-h">&#128293; 高频</span>':c>=3?'<span class="tag tag-m">&#11088; 常见</span>':'<span class="tag tag-l">一般</span>'}
function bs(c){return c>=4?"background:#ff7b7233;color:#ff7b72":c>=3?"background:#f0883e33;color:#f0883e":"background:#3fb95033;color:#3fb950"}
function render(){
  var keys=Object.keys(DATA),h=[];
  for(var i=0;i<keys.length;i++){
    var k=keys[i],is=k===active,c=COLORS[k]||COLORS["后端"],ex=is?"background:"+c.color+";border-color:"+c.color+";":"";
    h.push('<button class="tab'+(is?" ac":"")+'" style="'+ex+'" onclick="active=\''+k+'\';render()">'+k+'</button>');
  }
  document.getElementById('tabs').innerHTML=h.join("");
  var col=COLORS[active]||COLORS["后端"],g=[];
  for(var j=0;j<DATA[active].length;j++){
    var item=DATA[active][j],slug=SLUGS[item.name]||"",url="https://leetcode.cn/problems/"+slug+"/";
    g.push('<div class="card"><div class="cb" style="'+bs(item.count)+'">出现'+item.count+'次</div><div class="cm"><span class="cc" style="color:'+col.color+'">'+item.count+'×</span><span class="ct">出现次数</span></div><div class="cn">'+item.name+'</div><div class="tags">'+gt(item.count)+'</div><a class="cl" href="'+url+'" target="_blank" style="color:'+col.color+';border-color:'+col.color+'40;background:'+col.color+'15">&#9889; LeetCode 刷题直通车 &rarr;</a></div>');
  }
  document.getElementById('grid').innerHTML=g.join("");
}
render();rf2();
document.addEventListener('keydown',function(e){if(e.key==='Escape')cp()});
document.getElementById('pm').addEventListener('click',function(e){if(e.target===this)cp()});
</script>
</body>
</html>`;
}

server.listen(PORT, '0.0.0.0', function() {
  console.log('\n\x1b[32m🚀 面试题直通车已启动\x1b[0m  http://localhost:' + PORT);
  console.log('   - LeetCode 面试题直通车 + 文件上传 + ZIP 自动解压\n');
});

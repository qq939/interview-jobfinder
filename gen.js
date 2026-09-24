var fs = require('fs');
var path = require('path');

var SLUGS = {
  'K个一组翻转链表':'reverse-nodes-in-k-group','买卖股票':'best-time-to-buy-and-sell-stock',
  '三数之和':'3sum','最小栈':'min-stack','二叉树最大路径和':'binary-tree-maximum-path-sum',
  '二叉树右视图':'binary-tree-right-side-view','无重复字符最长子串':'longest-substring-without-repeating-characters',
  '合并有序数组':'merge-sorted-array','有序数组转二叉搜索树':'convert-sorted-array-to-binary-search-tree',
  '平衡二叉树':'balanced-binary-tree','二叉树最近公共祖先':'lowest-common-ancestor-of-a-binary-tree',
  '搜索旋转排序数组':'search-in-rotated-sorted-array','零钱兑换':'coin-change',
  '反转链表':'reverse-linked-list','二叉树前序遍历':'binary-tree-preorder-traversal',
  '长度最小的子数组':'minimum-size-subarray-sum','复原IP地址':'restore-ip-addresses',
  '数组第K个最大元素':'kth-largest-element-in-an-array','翻转二叉树':'invert-binary-tree',
  '二叉树中序遍历':'binary-tree-inorder-traversal','相交链表':'intersection-of-two-linked-lists',
  '岛屿数量':'number-of-islands','函数独占时间':'exclusive-time-of-functions',
  '二叉树锯齿形层次遍历':'binary-tree-zigzag-level-order-traversal','最大子序和':'maximum-subarray',
  '字符串解码':'decode-string','最大数':'largest-number','两数之和':'two-sum',
  '数组中出现次数超过一半的数字':'majority-element','有效括号':'valid-parentheses',
};

var DATA = {
  '后端':[{name:'K个一组翻转链表',count:4},{name:'买卖股票',count:4},{name:'三数之和',count:3},{name:'最小栈',count:3},{name:'二叉树最大路径和',count:3},{name:'二叉树右视图',count:3},{name:'无重复字符最长子串',count:3},{name:'合并有序数组',count:3},{name:'有序数组转二叉搜索树',count:3},{name:'平衡二叉树',count:3},{name:'二叉树最近公共祖先',count:3},{name:'搜索旋转排序数组',count:3},{name:'零钱兑换',count:3}],
  '客户端':[{name:'反转链表',count:4},{name:'二叉树前序遍历',count:4},{name:'二叉树最近公共祖先',count:3},{name:'K个一组翻转链表',count:3},{name:'买卖股票',count:3},{name:'最大子序和',count:3},{name:'字符串解码',count:3}],
  '前端':[{name:'长度最小的子数组',count:4},{name:'复原IP地址',count:2},{name:'数组第K个最大元素',count:2},{name:'翻转二叉树',count:2},{name:'二叉树中序遍历',count:2}],
  '算法岗':[{name:'相交链表',count:1},{name:'数组第K个最大元素',count:1},{name:'搜索旋转排序数组',count:1},{name:'岛屿数量',count:1},{name:'函数独占时间',count:1},{name:'二叉树锯齿形层次遍历',count:1}],
  '测试岗':[{name:'最大数',count:2},{name:'两数之和',count:2},{name:'三数之和',count:2},{name:'无重复字符最长子串',count:1},{name:'相交链表',count:1},{name:'数组中出现次数超过一半的数字',count:1},{name:'有效括号',count:1}],
};

var COLORS = {
  '后端':{color:'#58a6ff'},'客户端':{color:'#3fb950'},
  '前端':{color:'#d2a8ff'},'算法岗':{color:'#f0883e'},'测试岗':{color:'#ff7b72'},
  'AI助手':{color:'#ff7b9c'},
};

var ALL_TABS = ['AI助手','后端','客户端','前端','算法岗','测试岗'];

function tabBtn(k, active) {
  var is = k === active;
  var c = COLORS[k];
  var extra = is ? 'background:'+c.color+';border-color:'+c.color+';color:#fff' : '';
  return '<button class=tab-btn'+(is?' active':'')+' style="'+extra+'" data-tab="'+k+'" onclick="switchTab(this)">'+k+'</button>';
}

function cardHtml(item, col) {
  var slug = SLUGS[item.name] || '';
  var url = 'https://leetcode.cn/problems/'+slug+'/';
  var bs = item.count>=4 ? 'background:#ff7b7233;color:#ff7b72' : item.count>=3 ? 'background:#f0883e33;color:#f0883e' : 'background:#3fb95033;color:#3fb950';
  var tag = item.count>=4 ? '<span class="tag tag-hot">&#128293; 高频</span>' : item.count>=3 ? '<span class="tag tag-med">&#11088; 常见</span>' : '<span class="tag tag-low">一般</span>';
  return '<div class=card><div class=count-badge style="'+bs+'">出现'+item.count+'次</div><div class=card-meta><span class=card-count style="color:'+col.color+'">'+item.count+'&times;</span><span class=card-times>出现次数</span></div><div class=card-name>'+item.name+'</div><div class=tags>'+tag+'</div><a class=card-link href="'+url+'" target=_blank style="color:'+col.color+';border-color:'+col.color+'40;background:'+col.color+'15;">&#9889; LeetCode 刷题直通车 &rarr;</a></div>';
}

function buildGrid(k) {
  var col = COLORS[k] || COLORS['后端'];
  return '<div class=grid>'+DATA[k].map(function(item){ return cardHtml(item, col); }).join('')+'</div>';
}

// AI助手Tab：主区域(聊天) + 侧边栏(tmpfile)
var aiTabContent = [
  '<div id=ai-tab-wrapper style="display:flex;gap:1rem;max-width:1200px;margin:0 auto;align-items:flex-start;">',
    // 主区域：聊天界面
    '<div id=chat-area style="flex:1;background:#161b22;border:1px solid #30363d;border-radius:12px;padding:1rem;height:calc(100vh - 200px);display:flex;flex-direction:column;">',
      // 历史记录区域
      '<div id=history-section class=history-section style="display:none;">',
        '<h3>历史对话（最近5轮）</h3>',
        '<div id=history-list></div>',
      '</div>',
      // 消息显示区域
      '<div id=chat-messages style="flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:1rem;"></div>',
      // 输入区域
      '<div id=chat-input-area style="display:flex;gap:0.8rem;padding:1rem;border-top:1px solid #30363d;">',
        '<div id=file-drop-zone style="width:80px;height:80px;border:2px dashed #30363d;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;flex-shrink:0;position:relative;" onclick="document.getElementById(\'file-input\').click();">',
          '<div style="font-size:1.5rem;">&#128206;</div>',
          '<div style="font-size:0.65rem;color:#8b949e;text-align:center;">上传文件</div>',
          '<div id=file-indicator style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;background:#3fb950;border-radius:50%;display:none;align-items:center;justify-content:center;font-size:10px;color:#fff;">&#10003;</div>',
          '<input type=file id=file-input name=file style="display:none;" />',
        '</div>',
        '<div style="flex:1;display:flex;flex-direction:column;gap:0.5rem;">',
          '<div id=file-preview style="font-size:0.75rem;color:#3fb950;padding:0.3rem 0.6rem;background:#3fb95022;border-radius:6px;display:none;"></div>',
          '<textarea id=chat-input placeholder="输入消息... (Shift+Enter换行，Enter发送)" style="flex:1;min-height:60px;max-height:150px;background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:0.7rem;color:#c9d1d9;font-size:0.9rem;resize:none;font-family:inherit;line-height:1.5;" onkeydown="handleKeyDown(event)"></textarea>',
        '</div>',
        '<button id=send-btn onclick="sendMessage()" style="padding:0.6rem 1.2rem;background:#58a6ff;border:none;border-radius:8px;color:#fff;font-weight:600;font-size:0.9rem;cursor:pointer;transition:all 0.2s;align-self:flex-end;">发送</button>',
      '</div>',
      '<div id=loading-indicator style="display:none;text-align:center;padding:0.5rem;color:#8b949e;font-size:0.85rem;">',
        '<span style="animation:pulse 1.5s infinite;">AI 思考中...</span>',
      '</div>',
    '</div>',
    // 侧边栏：tmpfile显示
    '<div id=tmpfile-sidebar style="width:320px;background:#161b22;border:1px solid #30363d;border-radius:12px;padding:1rem;height:calc(100vh - 200px);display:flex;flex-direction:column;flex-shrink:0;">',
      '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.8rem;padding-bottom:0.8rem;border-bottom:1px solid #30363d;">',
        '<span style="font-size:1.2rem;">&#128196;</span>',
        '<span style="font-size:1rem;font-weight:600;color:#c9d1d9;">tmpfile.txt</span>',
      '</div>',
      '<div id=tmpfile-section class=tmpfile-section style="flex:1;background:#1c2128;border:1px solid #30363d;border-radius:8px;padding:0.8rem;overflow:hidden;display:flex;flex-direction:column;">',
        '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">',
          '<span id=tmpfile-status style="font-size:0.7rem;color:#8b949e;"></span>',
        '</div>',
        '<pre id=tmpfile-content style="font-size:0.7rem;color:#c9d1d9;white-space:pre-wrap;word-break:break-all;overflow-y:auto;margin:0;font-family:monospace;flex:1;"></pre>',
      '</div>',
      '<div id=tmpfile-hint style="margin-top:0.8rem;font-size:0.7rem;color:#8b949e;text-align:center;">',
        'tmpfile 在下一轮对话前自动清理',
      '</div>',
    '</div>',
  '</div>',
].join('\n');

var css = [
  ':root{--bg:#0d1117;--surface:#161b22;--border:#30363d;--accent:#58a6ff;--text:#c9d1d9;--muted:#8b949e;}',
  '*{box-sizing:border-box;margin:0;padding:0;}',
  'body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;min-height:100vh;padding:2rem;}',
  '.header{text-align:center;margin-bottom:2rem;}',
  '.header h1{font-size:2rem;color:var(--accent);margin-bottom:0.5rem;}',
  '.header p{color:var(--muted);font-size:0.9rem;}',
  '.tabs{display:flex;gap:0.4rem;flex-wrap:wrap;justify-content:center;margin-bottom:1.5rem;}',
  '.tab-btn{background:var(--surface);border:1px solid var(--border);color:var(--muted);padding:0.55rem 1.3rem;border-radius:50px;cursor:pointer;font-size:0.9rem;transition:all 0.2s;font-family:inherit;font-weight:500;}',
  '.tab-btn:hover{border-color:var(--accent);color:var(--accent);}',
  '.tab-content{display:none;}.tab-content.active{display:block;}',
  '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:1rem;max-width:1100px;margin:0 auto;}',
  '.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1.2rem;transition:all 0.2s;position:relative;overflow:hidden;}',
  '.card:hover{transform:translateY(-3px);box-shadow:0 8px 30px rgba(0,0,0,0.4);}',
  '.card::before{content:"";position:absolute;top:0;left:0;width:4px;height:100%;}',
  '.count-badge{position:absolute;top:12px;right:12px;font-size:0.7rem;padding:0.2rem 0.55rem;border-radius:20px;font-weight:700;opacity:0.85;}',
  '.card-meta{display:flex;align-items:baseline;gap:0.4rem;margin-bottom:0.4rem;}',
  '.card-count{font-size:2.2rem;font-weight:800;line-height:1;}',
  '.card-times{font-size:0.75rem;color:var(--muted);}',
  '.card-name{font-size:1.05rem;font-weight:600;margin-bottom:1rem;line-height:1.4;}',
  '.tags{margin-bottom:0.8rem;}',
  '.tag{display:inline-block;font-size:0.7rem;padding:0.15rem 0.5rem;border-radius:12px;margin-right:0.3rem;font-weight:600;}',
  '.tag-hot{background:#ff7b7233;color:#ff7b72;}',
  '.tag-med{background:#f0883e33;color:#f0883e;}',
  '.tag-low{background:#3fb95033;color:#3fb950;}',
  '.card-link{display:inline-flex;align-items:center;gap:0.4rem;padding:0.45rem 1rem;border-radius:8px;text-decoration:none;font-size:0.85rem;font-weight:600;transition:all 0.2s;border:1px solid;}',
  '.card-link:hover{filter:brightness(1.15);transform:translateX(2px);}',
  '.footer{text-align:center;color:var(--muted);font-size:0.8rem;margin-top:3rem;padding-top:1rem;border-top:1px solid var(--border);}',
  '.footer a{color:var(--accent);text-decoration:none;}',
  // 聊天相关样式
  '#chat-input:focus,#file-input:focus{border-color:var(--accent);outline:none;}',
  '#send-btn:hover{filter:brightness(1.1);}',
  '#send-btn:disabled{opacity:0.5;cursor:not-allowed;}',
  '#file-drop-zone:hover{border-color:var(--accent);background:#58a6ff10;}',
  '.message{margin-bottom:0.5rem;}',
  '.message-user{display:flex;justify-content:flex-end;}',
  '.message-ai{display:flex;justify-content:flex-start;}',
  '.message-content{max-width:80%;padding:0.8rem 1rem;border-radius:12px;line-height:1.5;font-size:0.9rem;white-space:pre-wrap;word-break:break-word;}',
  '.message-user .message-content{background:#58a6ff;color:#fff;border-bottom-right-radius:4px;}',
  '.message-ai .message-content{background:#21262d;color:#c9d1d9;border-bottom-left-radius:4px;}',
  '.message-file{font-size:0.75rem;padding:0.3rem 0.6rem;background:#3fb95022;color:#3fb950;border-radius:6px;margin-bottom:0.5rem;}',
  '.history-section{background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:0.8rem;margin-bottom:1rem;}',
  '.history-section h3{font-size:0.8rem;color:#8b949e;margin-bottom:0.5rem;}',
  '.history-item{display:flex;gap:0.5rem;padding:0.4rem;border-bottom:1px solid #21262d;cursor:pointer;transition:all 0.2s;}',
  '.history-item:hover{background:#21262d;}',
  '.history-item:last-child{border-bottom:none;}',
  '.history-time{font-size:0.7rem;color:#8b949e;white-space:nowrap;}',
  '.history-preview{flex:1;font-size:0.8rem;color:#c9d1d9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
  '@keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.5;}}',
].join('\n');

var tabsHtml = ALL_TABS.map(function(k){ return tabBtn(k, 'AI助手'); }).join('');

// 聊天 JS
var chatJS = [
  'var currentFile=null;',
  'var chatMessages=document.getElementById("chat-messages");',
  'var chatInput=document.getElementById("chat-input");',
  'var sendBtn=document.getElementById("send-btn");',
  'var fileInput=document.getElementById("file-input");',
  'var filePreview=document.getElementById("file-preview");',
  'var fileIndicator=document.getElementById("file-indicator");',
  'var loadingIndicator=document.getElementById("loading-indicator");',
  'var fileDropZone=document.getElementById("file-drop-zone");',
  'var historySection=document.getElementById("history-section");',
  'var historyList=document.getElementById("history-list");',
  'var tmpfileSection=document.getElementById("tmpfile-section");',
  'var tmpfileContent=document.getElementById("tmpfile-content");',
  'var tmpfileStatus=document.getElementById("tmpfile-status");',
  'var tmpfilePollInterval=null;',
  'var isSending=false;',

  'function appPath(path){',
  '  var prefix=window.location.pathname.indexOf("/jobfinder")===0?"/jobfinder":"";',
  '  return prefix+path;',
  '}',

  'function handleKeyDown(e){',
  '  if(e.key==="Enter"&&!e.shiftKey){',
  '    e.preventDefault();',
  '    sendMessage();',
  '  }',
  '}',

  'fileInput.addEventListener("change",function(){',
  '  if(this.files.length){',
  '    currentFile=this.files[0];',
  '    filePreview.textContent="📎 "+currentFile.name;',
  '    filePreview.style.display="block";',
  '    fileIndicator.style.display="flex";',
  '  }',
  '});',

  'fileDropZone.addEventListener("dragover",function(e){e.preventDefault();fileDropZone.style.borderColor="#58a6ff";fileDropZone.style.background="#58a6ff10";});',
  'fileDropZone.addEventListener("dragleave",function(){fileDropZone.style.borderColor="#30363d";fileDropZone.style.background="transparent";});',
  'fileDropZone.addEventListener("drop",function(e){',
  '  e.preventDefault();',
  '  fileDropZone.style.borderColor="#30363d";',
  '  fileDropZone.style.background="transparent";',
  '  if(e.dataTransfer.files.length){',
  '    currentFile=e.dataTransfer.files[0];',
  '    filePreview.textContent="📎 "+currentFile.name;',
  '    filePreview.style.display="block";',
  '    fileIndicator.style.display="flex";',
  '  }',
  '});',

  'function addMessage(role,content,fileName){',
  '  var div=document.createElement("div");',
  '  div.className="message message-"+role;',
  '  var inner=document.createElement("div");',
  '  if(fileName&&role==="user"){',
  '    var fileDiv=document.createElement("div");',
  '    fileDiv.className="message-file";',
  '    fileDiv.textContent="📎 已上传: "+fileName;',
  '    div.appendChild(fileDiv);',
  '  }',
  '  var contentDiv=document.createElement("div");',
  '  contentDiv.className="message-content";',
  '  contentDiv.textContent=content;',
  '  inner.appendChild(contentDiv);',
  '  div.appendChild(inner);',
  '  chatMessages.appendChild(div);',
  '  chatMessages.scrollTop=chatMessages.scrollHeight;',
  '  return contentDiv;',
  '}',

  'function setLoading(loading){',
  '  isSending=loading;',
  '  loadingIndicator.style.display=loading?"block":"none";',
  '  sendBtn.disabled=loading;',
  '  chatInput.disabled=loading;',
  '}',

  '// 安全解析JSON，避免解析失败导致按钮无法恢复',
  'function safeParseJSON(str){',
  '  try{return JSON.parse(str);}',
  '  catch(e){return null;}',
  '}',

  'function handleSSELine(line,aiContentDiv){',
  '  if(!line.startsWith("data: "))return;',
  '  var data=safeParseJSON(line.substring(6));',
  '  if(!data)return;',
  '  if(data.type==="chunk"){',
  '    aiContentDiv.textContent=(aiContentDiv.textContent||"")+data.content;',
  '    chatMessages.scrollTop=chatMessages.scrollHeight;',
  '    return;',
  '  }',
  '  if(data.type==="error"){',
  '    aiContentDiv.textContent="错误: "+data.content;',
  '    return;',
  '  }',
  '  if(data.type==="complete"&&data.content){',
  '    var parsed=safeParseJSON(data.content);',
  '    if(parsed&&parsed.response){',
  '      aiContentDiv.textContent=parsed.response;',
  '    }',
  '  }',
  '}',

  'function clearInput(){',
  '  chatInput.value="";',
  '  currentFile=null;',
  '  filePreview.style.display="none";',
  '  fileIndicator.style.display="none";',
  '  fileInput.value="";',
  '}',

  'function formatTime(timestamp){',
  '  var d=new Date(timestamp);',
  '  var month=d.getMonth()+1;',
  '  var day=d.getDate();',
  '  var hour=d.getHours();',
  '  var min=d.getMinutes();',
  '  return month+"/"+day+" "+hour+":"+(min<10?"0":"")+min;',
  '}',

  '// tmpfile实时显示功能',
  'function showTmpFile(content){',
  '  tmpfileSection.style.display="flex";',
  '  tmpfileContent.textContent=content||"";',
  '}',

  'function updateTmpFileStatus(status){',
  '  tmpfileStatus.textContent=status||"";',
  '}',

  'function hideTmpFile(){',
  '  tmpfileSection.style.display="none";',
  '  tmpfileContent.textContent="";',
  '  if(tmpfilePollInterval){',
  '    clearInterval(tmpfilePollInterval);',
  '    tmpfilePollInterval=null;',
  '  }',
  '}',

  'function pollTmpFile(){',
  '  fetch(appPath("/uploads/tmpfile.txt")+"?_t="+Date.now())',
  '  .then(function(r){',
  '    if(r.ok)return r.text();',
  '    throw new Error("文件不存在");',
  '  })',
  '  .then(function(content){',
  '    showTmpFile(content);',
  '    updateTmpFileStatus("实时更新中...");',
  '  })',
  '  .catch(function(e){',
  '    hideTmpFile();',
  '  });',
  '}',

  'function startTmpFilePolling(){',
  '  if(tmpfilePollInterval)clearInterval(tmpfilePollInterval);',
  '  tmpfilePollInterval=setInterval(pollTmpFile,1000);',
  '}',

  'function stopTmpFilePolling(){',
  '  if(tmpfilePollInterval){',
  '    clearInterval(tmpfilePollInterval);',
  '    tmpfilePollInterval=null;',
  '  }',
  '  updateTmpFileStatus("");',
  '}',

  'function loadHistory(){',
  '  fetch(appPath("/api/dialogs"))',
  '  .then(function(r){return r.json();})',
  '  .then(function(data){',
  '    if(data.dialogs&&data.dialogs.length>0){',
  '      historySection.style.display="block";',
  '      historyList.innerHTML="";',
  '      data.dialogs.forEach(function(d){',
  '        var item=document.createElement("div");',
  '        item.className="history-item";',
  '        item.onclick=function(){showDialog(d.id);};',
  '        var timeSpan=document.createElement("span");',
  '        timeSpan.className="history-time";',
  '        timeSpan.textContent=formatTime(d.timestamp);',
  '        var previewSpan=document.createElement("span");',
  '        previewSpan.className="history-preview";',
  '        previewSpan.textContent=(d.userMessage||"").substring(0,50)+(d.userMessage&&d.userMessage.length>50?"...":"");',
  '        item.appendChild(timeSpan);',
  '        item.appendChild(previewSpan);',
  '        historyList.appendChild(item);',
  '      });',
  '    }else{',
  '      historySection.style.display="none";',
  '    }',
  '  })',
  '  .catch(function(e){',
  '    console.error("加载历史记录失败:",e);',
  '  });',
  '}',

  'function showDialog(dialogId){',
  '  chatMessages.innerHTML="";',
  '  fetch(appPath("/api/dialogs/"+dialogId))',
  '  .then(function(r){return r.json();})',
  '  .then(function(d){',
  '    if(d.error){',
  '      addMessage("ai","加载对话失败: "+d.error);',
  '      return;',
  '    }',
  '    addMessage("user",d.userMessage||"");',
  '    addMessage("ai",d.aiResponse||"");',
  '  })',
  '  .catch(function(e){',
  '    addMessage("ai","加载对话失败: "+e.message);',
  '  });',
  '}',

  'async function sendMessage(){',
  '  if(isSending)return;',
  '  var text=chatInput.value.trim();',
  '  if(!text&&!currentFile)return;',
  '  setLoading(true);',
  '  addMessage("user",text,currentFile?currentFile.name:null);',
  '  var formData=new FormData();',
  '  formData.append("text",text);',
  '  if(currentFile){',
  '    formData.append("file",currentFile);',
  '    formData.append("fileName",currentFile.name);',
  '  }',
  '  var aiContentDiv=addMessage("ai","");',
  '  var response=null;',
  '  var reader=null;',
  '  try{',
  '    startTmpFilePolling();',
  '    response=await fetch(appPath("/api/claude-sse"),{method:"POST",body:formData});',
  '    if(!response.ok){',
  '      throw new Error("HTTP "+response.status);',
  '    }',
  '    if(!response.body||!response.body.getReader){',
  '      throw new Error("浏览器不支持流式响应");',
  '    }',
  '    reader=response.body.getReader();',
  '    var decoder=new TextDecoder();',
  '    var buffer="";',
  '    while(true){',
  '      var result=await reader.read();',
  '      if(result.done)break;',
  '      var chunk=decoder.decode(result.value,{stream:true});',
  '      buffer+=chunk;',
  '      var lines=buffer.split("\\n");',
  '      buffer=lines.pop()||"";',
  '      for(var i=0;i<lines.length;i++){',
  '        handleSSELine(lines[i],aiContentDiv);',
  '      }',
  '      await new Promise(function(r){setTimeout(r,10);});',
  '    }',
  '    if(buffer.trim()){',
  '      handleSSELine(buffer.trim(),aiContentDiv);',
  '    }',
  '  }catch(e){',
  '    console.error("发送消息失败:",e);',
  '    aiContentDiv.textContent="请求失败: "+e.message;',
  '  }finally{',
  '    stopTmpFilePolling();',
  // '    hideTmpFile();  // 不要自动隐藏，让tmpfile保留到下一轮对话前',
  '    clearInput();',
  '    setLoading(false);',
  '    loadHistory();',
  '  }',
  '}',

  'loadHistory();',

  '// 初始欢迎消息',
  'setTimeout(function(){',
  '  if(chatMessages.children.length===0){',
  '    addMessage("ai","你好！我是AI助手。你可以上传简历或文件，我会帮你分析和解答问题。");',
  '  }',
  '},100);',
].join('\n');

var page = '<!DOCTYPE html>' +
'<html lang=zh-CN>' +
'<head><meta charset=UTF-8 /><meta name=viewport content="width=device-width,initial-scale=1.0" /><title>字节跳动 · 面试题直通车</title>' +
'<style>' + css + '</style></head>' +
'<body>' +
'<div class=header><h1>&#128293; 字节跳动 · 面试题直通车</h1><p>按岗位分类 · 数据来源：<strong>Nowcoder 面经</strong>（约120+篇，190+条算法题）</p><p style="margin-top:0.4rem;color:#3fb950;">&#10003; 每题均附 LeetCode 刷题链接，点按钮即可跳转</p></div>' +

'<div class=tabs id=mainTabs>' + tabsHtml + '</div>' +

'<div id=tab-AI助手 class="tab-content active">' + aiTabContent + '</div>' +
'<div id=tab-后端 class=tab-content>' + buildGrid('后端') + '</div>' +
'<div id=tab-客户端 class=tab-content>' + buildGrid('客户端') + '</div>' +
'<div id=tab-前端 class=tab-content>' + buildGrid('前端') + '</div>' +
'<div id=tab-算法岗 class=tab-content>' + buildGrid('算法岗') + '</div>' +
'<div id=tab-测试岗 class=tab-content>' + buildGrid('测试岗') + '</div>' +

'<div class=footer>数据来源：<a href="https://www.nowcoder.com/discuss/353156554083999744" target=_blank>Nowcoder</a> &nbsp;&middot;&nbsp;GitHub：<a href="https://github.com/afatcoder/LeetcodeTop" target=_blank>afatcoder/LeetcodeTop</a></div>' +

'<script>' +
'var COLORS=' + JSON.stringify(COLORS) + ';' +
'function switchTab(btn){' +
  'var k=btn.getAttribute("data-tab");' +
  'var tabs=document.getElementById("mainTabs").querySelectorAll("button");' +
  'for(var i=0;i<tabs.length;i++){' +
    'var t=tabs[i];var key=t.getAttribute("data-tab");var is=key===k;' +
    'var c=COLORS[key]||{color:"#58a6ff"};' +
    't.style.background=is?c.color:"var(--surface)";' +
    't.style.borderColor=is?c.color:"var(--border)";' +
    't.style.color=is?"#fff":"var(--muted)";' +
  '}' +
  'var contents=document.querySelectorAll(".tab-content");' +
  'for(var j=0;j<contents.length;j++){contents[j].classList.remove("active");}' +
  'var target=document.getElementById("tab-"+k);if(target)target.classList.add("active");' +
  'if(k==="AI助手"){loadHistory();}' +
'}' +
chatJS +
'</script>' +
'</body></html>';

fs.writeFileSync(path.join(__dirname, 'page.html'), page);
console.log('OK size=' + page.length);

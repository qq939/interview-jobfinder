function getTag(count) {
  if (count >= 4) return '<span class="tag tag-hot">🔥 高频</span>';
  if (count >= 3) return '<span class="tag tag-med">⭐ 常见</span>';
  return '<span class="tag tag-low">一般</span>';
}

function badgeStyle(count) {
  if (count >= 4) return { bg: '#ff7b7233', color: '#ff7b72' };
  if (count >= 3) return { bg: '#f0883e33', color: '#f0883e' };
  return { bg: '#3fb95033', color: '#3fb950' };
}

function cardHTML(item, col) {
  var slug = SLUGS[item.name] || '';
  var url = 'https://leetcode.cn/problems/' + slug + '/';
  var bs = badgeStyle(item.count);
  var badge = '<div class="count-badge" style="background:' + bs.bg + ';color:' + bs.color + ';">出现 ' + item.count + ' 次</div>';
  var countBig = '<span class="card-count" style="color:' + col.color + '">' + item.count + '×</span>';
  var nameDiv = '<div class="card-name">' + item.name + '</div>';
  var tags = '<div class="tags">' + getTag(item.count) + '</div>';
  var link = '<a class="card-link" href="' + url + '" target="_blank" rel="noopener" style="color:' + col.color + ';border-color:' + col.color + '40;background:' + col.color + '15;">⚡ LeetCode 刷题直通车 →</a>';
  return '<div class="card" style="--card-color:' + col.color + ';">' + badge + '<div class="card-meta">' + countBig + '<span class="card-times">出现次数</span></div>' + nameDiv + tags + link + '</div>';
}

function render() {
  var i, k, c, tabsHTML = '', tabsEl = document.getElementById('tabs');
  var keys = Object.keys(DATA);

  tabsHTML = '';
  for (i = 0; i < keys.length; i++) {
    k = keys[i];
    c = COLORS[k] || COLORS['后端'];
    var extra = k === active ? ('background:' + c.color + ';border-color:' + c.color + ';') : '';
    tabsHTML += '<button class="tab-btn' + (k === active ? ' active' : '') + '" style="' + extra + '" onclick="active=\'' + k + '\';render()">' + k + '</button>';
  }
  tabsEl.innerHTML = tabsHTML;

  var col = COLORS[active] || COLORS['后端'];
  var gridEl = document.getElementById('grid');
  var items = DATA[active];
  var html = '';
  for (i = 0; i < items.length; i++) {
    html += cardHTML(items[i], col);
  }
  gridEl.innerHTML = html;
}

render();

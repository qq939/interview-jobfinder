from flask import Flask, jsonify
from collections import defaultdict

app = Flask(__name__)

# LeetCode slug 映射（驼峰转连字符，精确匹配）
LEETCODE_SLUGS = {
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
}

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>字节跳动面试题直通车 · LeetCode</title>
  <style>
    :root {{
      --bg: #0d1117; --surface: #161b22; --border: #30363d;
      --accent: #58a6ff; --green: #3fb950; --orange: #f0883e;
      --purple: #d2a8ff; --pink: #ff7b72; --yellow: #e3b341;
      --text: #c9d1d9; --muted: #8b949e;
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; padding: 2rem; }}
    .header {{ text-align: center; margin-bottom: 2.5rem; }}
    .header h1 {{ font-size: 2rem; color: var(--accent); margin-bottom: 0.5rem; }}
    .header p {{ color: var(--muted); font-size: 0.9rem; }}
    .tabs {{ display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center; margin-bottom: 2rem; }}
    .tab-btn {{
      background: var(--surface); border: 1px solid var(--border); color: var(--muted);
      padding: 0.5rem 1.2rem; border-radius: 8px; cursor: pointer; font-size: 0.9rem;
      transition: all 0.2s;
    }}
    .tab-btn:hover {{ border-color: var(--accent); color: var(--accent); }}
    .tab-btn.active {{ background: var(--accent); color: #fff; border-color: var(--accent); font-weight: 600; }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; max-width: 1200px; margin: 0 auto; }}
    .card {{
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      padding: 1.2rem; transition: all 0.2s; position: relative; overflow: hidden;
    }}
    .card:hover {{ border-color: {accent_color}; transform: translateY(-2px); box-shadow: 0 4px 20px rgba(0,0,0,0.3); }}
    .card::before {{
      content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%;
      background: {accent_color};
    }}
    .card-title {{ font-size: 0.8rem; color: var(--muted); margin-bottom: 0.3rem; text-transform: uppercase; letter-spacing: 0.05em; }}
    .card-count {{ font-size: 2rem; font-weight: 700; color: {accent_color}; }}
    .card-name {{ font-size: 1rem; font-weight: 600; color: var(--text); margin-bottom: 0.8rem; }}
    .card-link {{
      display: inline-flex; align-items: center; gap: 0.4rem;
      background: {accent_bg}; color: {accent_color}; border: 1px solid {accent_color}40;
      padding: 0.4rem 0.9rem; border-radius: 6px; text-decoration: none; font-size: 0.85rem;
      font-weight: 500; transition: all 0.2s;
    }}
    .card-link:hover {{ background: {accent_color}22; border-color: {accent_color}; }}
    .section-label {{ grid-column: 1 / -1; font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; margin-top: 0.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.3rem; }}
    .tag {{
      display: inline-block; background: var(--border); color: var(--muted);
      font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 12px; margin-right: 0.3rem; margin-bottom: 0.5rem;
    }}
    .tag.hot {{ background: #ff7b7233; color: var(--pink); }}
    .tag.med {{ background: #f0883e33; color: var(--orange); }}
    .tag.low {{ background: #3fb95033; color: var(--green); }}
    .footer {{ text-align: center; color: var(--muted); font-size: 0.8rem; margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--border); }}
  </style>
</head>
<body>
  <div class="header">
    <h1>🔥 字节跳动 · 面试题直通车</h1>
    <p>按岗位分类 · 数据来源：Nowcoder 面经统计（5月–6月，约120+篇，190+条算法题）</p>
    <p style="margin-top:0.3rem; color: var(--accent);">⭐ 点击题目直接跳转 LeetCode 刷题</p>
  </div>

  <div class="tabs" id="tabs"></div>
  <div class="grid" id="grid"></div>
  <div class="footer">
    数据来源：Nowcoder · 字节跳动按岗位汇总算法高频题 &nbsp;|&nbsp;
    GitHub：afatcoder/LeetcodeTop &nbsp;|&nbsp;
    仅供学习参考
  </div>

  <script>
    const DATA = {data_json};

    const COLORS = {{
      "后端":       {{ color: "#58a6ff", bg: "#58a6ff15" }},
      "客户端":     {{ color: "#3fb950", bg: "#3fb95015" }},
      "前端":       {{ color: "#d2a8ff", bg: "#d2a8ff15" }},
      "算法岗":     {{ color: "#f0883e", bg: "#f0883e15" }},
      "测试岗":     {{ color: "#ff7b72", bg: "#ff7b7233" }},
    }};

    let active = Object.keys(DATA)[0];

    function getTag(count, max) {{
      if (count >= 4) return '<span class="tag hot">🔥 高频</span>';
      if (count >= 3) return '<span class="tag med">⭐ 常见</span>';
      return '<span class="tag low">一般</span>';
    }}

    function render() {{
      const tabsEl = document.getElementById("tabs");
      tabsEl.innerHTML = Object.keys(DATA).map(k =>
        `<button class="tab-btn${k === active ? ' active' : ''}" onclick="active='${k}';render()">${k}</button>`
      ).join("");

      const gridEl = document.getElementById("grid");
      const items = DATA[active];
      const col = COLORS[active] || COLORS["后端"];
      gridEl.innerHTML = items.map(item => `
        <div class="card" style="--accent-color:${col.color};--accent-bg:${col.bg};">
          {getTag(item.count, 4)}
          <div class="card-name">{item.name}</div>
          <div class="card-title">出现次数</div>
          <div class="card-count">{item.count} 次</div>
          <br/>
          <a class="card-link" href="https://leetcode.cn/problems/{item.slug}/" target="_blank" rel="noopener">
            ⚡ 刷题直通车 →
          </a>
        </div>
      `).join("");
    }}

    render();
  </script>
</body>
</html>"""

def build_data():
    raw = {
        "后端": [
            ("K个一组翻转链表", 4), ("买卖股票", 4),
            ("三数之和", 3), ("最小栈", 3), ("二叉树最大路径和", 3),
            ("二叉树右视图", 3), ("无重复字符最长子串", 3), ("合并有序数组", 3),
            ("有序数组转二叉搜索树", 3), ("平衡二叉树", 3),
            ("二叉树最近公共祖先", 3), ("搜索旋转排序数组", 3), ("零钱兑换", 3),
        ],
        "客户端": [
            ("反转链表", 4), ("二叉树前序遍历", 4),
            ("二叉树最近公共祖先", 3), ("K个一组翻转链表", 3),
            ("买卖股票", 3), ("最大子序和", 3), ("字符串解码", 3),
        ],
        "前端": [
            ("长度最小的子数组", 4),
            ("复原IP地址", 2), ("数组第K个最大元素", 2),
            ("翻转二叉树", 2), ("二叉树中序遍历", 2),
        ],
        "算法岗": [
            ("相交链表", 1), ("数组第K个最大元素", 1),
            ("搜索旋转排序数组", 1), ("岛屿数量", 1),
            ("函数独占时间", 1), ("二叉树锯齿形层次遍历", 1),
        ],
        "测试岗": [
            ("最大数", 2), ("两数之和", 2), ("三数之和", 2),
            ("无重复字符最长子串", 1), ("相交链表", 1),
            ("数组中出现次数超过一半的数字", 1), ("有效括号", 1),
        ],
    }

    result = {}
    for role, items in raw.items():
        result[role] = [
            {
                "name": name,
                "count": count,
                "slug": LEETCODE_SLUGS.get(name, ""),
            }
            for name, count in items
        ]
    return result

@app.route("/")
def index():
    data = build_data()
    html = HTML_TEMPLATE.format(
        data_json=jsonify(data).data.decode(),
        accent_color="var(--accent)",
    )
    return html

if __name__ == "__main__":
    print("🚀 面试题直通车已启动: http://localhost:8082")
    app.run(host="0.0.0.0", port=8082, debug=False)

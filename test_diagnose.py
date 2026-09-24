#!/usr/bin/env python3
"""
诊断页面问题：检查页面加载、元素存在和交互
"""
from playwright.sync_api import sync_playwright

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 监听控制台消息
        console_messages = []
        page.on("console", lambda msg: console_messages.append(f"[{msg.type}] {msg.text}"))

        print("1. 访问页面...")
        page.goto('http://localhost:8082')
        page.wait_for_load_state('networkidle')

        # 截图
        page.screenshot(path='/tmp/page_initial.png', full_page=True)
        print("已保存截图到 /tmp/page_initial.png")

        # 检查关键元素
        print("\n2. 检查关键元素...")

        # 检查AI助手tab
        ai_tab = page.locator('button[data-tab="AI助手"]')
        print(f"  AI助手tab存在: {ai_tab.count() > 0}")

        # 检查聊天区域
        chat_area = page.locator('#chat-area')
        print(f"  聊天区域存在: {chat_area.count() > 0}")

        # 检查消息区域
        chat_messages = page.locator('#chat-messages')
        print(f"  消息区域存在: {chat_messages.count() > 0}")

        # 检查输入框
        chat_input = page.locator('#chat-input')
        print(f"  输入框存在: {chat_input.count() > 0}")

        # 检查发送按钮
        send_btn = page.locator('#send-btn')
        print(f"  发送按钮存在: {send_btn.count() > 0}")

        # 检查tmpfile区域
        tmpfile_section = page.locator('#tmpfile-section')
        print(f"  tmpfile区域存在: {tmpfile_section.count() > 0}")

        # 检查历史记录区域
        history_section = page.locator('#history-section')
        print(f"  历史记录区域存在: {history_section.count() > 0}")

        # 等待欢迎消息
        page.wait_for_timeout(500)

        # 检查消息内容
        messages = page.locator('.message-ai')
        print(f"\n3. 检查欢迎消息...")
        print(f"  AI消息数量: {messages.count()}")
        if messages.count() > 0:
            first_msg = messages.first.locator('.message-content').text_content()
            print(f"  第一条AI消息: {first_msg[:100] if first_msg else 'None'}...")

        # 检查历史记录加载
        print("\n4. 检查历史记录...")
        history_display = history_section.evaluate('el => el.style.display')
        print(f"  历史记录区域display: {history_display}")

        # 检查API响应
        print("\n5. 检查API响应...")
        try:
            dialogs_response = page.request.get('http://localhost:8082/api/dialogs')
            print(f"  /api/dialogs 状态: {dialogs_response.status}")
            print(f"  /api/dialogs 响应: {dialogs_response.text()[:200]}")
        except Exception as e:
            print(f"  /api/dialogs 错误: {e}")

        # 检查tmpfile API
        try:
            tmpfile_response = page.request.get('http://localhost:8082/uploads/tmpfile.txt')
            print(f"  /uploads/tmpfile.txt 状态: {tmpfile_response.status}")
        except Exception as e:
            print(f"  /uploads/tmpfile.txt 错误: {e}")

        # 尝试输入并点击发送
        print("\n6. 测试发送按钮...")
        chat_input.fill("测试消息")
        print(f"  已填入测试消息")

        # 检查按钮状态
        btn_disabled = send_btn.evaluate('el => el.disabled')
        print(f"  按钮是否禁用: {btn_disabled}")

        # 点击发送
        print("  点击发送按钮...")
        send_btn.click()

        # 等待一下
        page.wait_for_timeout(1000)

        # 再次检查
        btn_disabled_after = send_btn.evaluate('el => el.disabled')
        print(f"  点击后按钮是否禁用: {btn_disabled_after}")

        # 检查消息
        user_messages = page.locator('.message-user')
        print(f"  用户消息数量: {user_messages.count()}")

        # 查看控制台错误
        print("\n7. 控制台消息:")
        for msg in console_messages:
            if 'error' in msg.lower() or 'Error' in msg:
                print(f"  {msg}")

        browser.close()
        print("\n诊断完成!")

if __name__ == '__main__':
    main()
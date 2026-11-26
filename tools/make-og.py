# 產生分享預覽圖 og.jpg（1200×630）與 artifact 縮圖 thumb.jpg（600×315）
# 用法：在專案根目錄起 python -m http.server 8765，再執行 python tools/make-og.py
import asyncio
from playwright.async_api import async_playwright
from PIL import Image

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1200, "height": 630})
        await pg.goto("http://localhost:8765/tools/og.html")
        await pg.evaluate("document.fonts.ready")
        await pg.wait_for_timeout(1200)
        await pg.locator("#og").screenshot(path="og.png")
        await b.close()
    im = Image.open("og.png").convert("RGB")
    im.save("og.jpg", quality=86, optimize=True, progressive=True)
    im.resize((600, 315), Image.LANCZOS).save("thumb.jpg", quality=84, optimize=True)
    import os; os.remove("og.png")
    print("og.jpg / thumb.jpg 已更新")

asyncio.run(main())

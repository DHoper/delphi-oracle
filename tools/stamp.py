# 每次推上 Pages 前執行：替 CSS 與每個 JS 模組加上內容雜湊版本號，手機與 LINE 內建瀏覽器才不會沿用快取的舊檔
# 做法：index.html 裡的 <link css> 與 <script main.js> 加 ?v=；其餘模組用 import map 對應到帶 ?v= 的網址
import hashlib, json, re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
h = lambda p: hashlib.sha1(p.read_bytes()).hexdigest()[:8]
html = (ROOT / "index.html").read_text(encoding="utf-8")
js = sorted(p for p in (ROOT / "js").rglob("*.js"))
imap = {"./" + p.relative_to(ROOT).as_posix(): "./" + p.relative_to(ROOT).as_posix() + "?v=" + h(p) for p in js}
block = '<script type="importmap" id="vmap">' + json.dumps({"imports": imap}, ensure_ascii=False) + "</script>"
if 'id="vmap"' in html: html = re.sub(r'<script type="importmap" id="vmap">.*?</script>', lambda m: block, html, flags=re.S)
else: html = html.replace('<script type="module" src="js/main.js', block + '\n<script type="module" src="js/main.js', 1)
html = re.sub(r'href="css/main\.css(\?v=\w+)?"', f'href="css/main.css?v={h(ROOT / "css/main.css")}"', html)
html = re.sub(r'src="js/main\.js(\?v=\w+)?"', f'src="js/main.js?v={h(ROOT / "js/main.js")}"', html)
(ROOT / "index.html").write_text(html, encoding="utf-8")
print("stamped", len(imap), "modules")

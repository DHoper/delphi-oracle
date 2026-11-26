# 標題字體子集化：把網站用到的字從源流明體（GenRyuMin2 TC B，OFL）切出來，存成 assets/fonts/genryumin-b.woff2
# 用法：python tools/subset-fonts.py <GenRyuMin2TC-B.otf 的路徑>
# 文案有增減時重跑一次；沒有收進子集的字會退回內文字體（思源宋體）
import sys, glob, os
from fontTools import subset

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/Downloads/genryu/GenRyuMin2TC-B.otf")
files = [os.path.join(root, "index.html")] + glob.glob(os.path.join(root, "js", "**", "*.js"), recursive=True)
chars = set(chr(c) for c in range(0x20, 0x7F))
chars |= set("　、。，．：；！？「」『』（）《》〈〉…—–・·～")
for f in files:
    chars |= set(open(f, encoding="utf-8").read())
chars = {c for c in chars if c.isprintable() and not c.isspace() or c == " "}
opts = subset.Options(); opts.flavor = "woff2"; opts.layout_features = ["*"]; opts.name_IDs = ["*"]; opts.notdef_outline = True
font = subset.load_font(src, opts)
sub = subset.Subsetter(opts); sub.populate(text="".join(sorted(chars))); sub.subset(font)
out = os.path.join(root, "assets", "fonts", "genryumin-b.woff2")
subset.save_font(font, out, opts)
cmap = font.getBestCmap()
missing = sorted(c for c in chars if ord(c) > 0x2E80 and ord(c) not in cmap)
print(f"{len(cmap)} glyphs → {out} ({os.path.getsize(out) // 1024} KB)")
if missing: print("字體裡沒有的字：", "".join(missing))

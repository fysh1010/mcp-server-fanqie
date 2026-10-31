# 生成 awesome-dsh-plugin 市场用的光栅图标 docs/assets/icon-180.png。
# 设计与 plugins/deepseek-harness/icon.svg 一致：番茄红圆角底 + 摊开的书页 + 番茄蒂。
# 运行：python scripts/make_icon.py（需要 Pillow）
from PIL import Image, ImageDraw

SIZE = 256
img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# 番茄红圆角方底
d.rounded_rectangle([8, 8, 248, 248], radius=56, fill=(232, 69, 44, 255))

# 摊开的书页（两页 + 中缝）
d.rounded_rectangle([56, 72, 200, 196], radius=18, fill=(255, 245, 236, 255))
d.line([128, 84, 128, 188], fill=(232, 69, 44, 255), width=8)
# 页内文字线
for y in (104, 128, 152):
    d.line([72, y, 114, y], fill=(210, 190, 170, 255), width=6)
    d.line([142, y, 184, y], fill=(210, 190, 170, 255), width=6)

# 番茄蒂（绿圆 + 叶）
d.ellipse([112, 30, 152, 70], fill=(47, 125, 50, 255))
d.polygon([(128, 34), (108, 46), (128, 52), (148, 46)], fill=(47, 125, 50, 255))

import pathlib
out = pathlib.Path(__file__).resolve().parent.parent / 'docs' / 'assets' / 'icon-180.png'
out.parent.mkdir(parents=True, exist_ok=True)
img.save(out)
print(f'saved {out}')

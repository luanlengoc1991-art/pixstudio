# Icon 3D của công cụ

Mỗi icon trong `renderer/public/icons3d` là biểu tượng lucide được đùn khối chrome
trên tấm kính màu, render bằng three.js trong một cửa sổ Electron ẩn.

```bash
cd scripts/render-icons
npm install
node prep.js ../..                 # nét lucide -> SVG đặc (sharp + potrace của app)
../../node_modules/electron/dist/electron.exe main.js out glass   # render PNG 512px vào out/
```

Sau đó cắt bớt viền trong suốt, chép vào `renderer/public/icons3d` và tăng
`ICON_VERSION` trong `renderer/lib/tool-style.ts`. Màu lấy theo `TOOL_ACCENT`
(khai báo lại trong `main.js`). Kiểu `solid` cho tấm màu đặc thay vì kính.

# PixStudio

Phần mềm **phóng to ảnh** và **tách nền ảnh** bằng AI, chạy ngay trên máy tính.
Dựa trên [Upscayl](https://github.com/upscayl/upscayl) (giấy phép AGPL-3.0). Hướng dẫn gốc của Upscayl: [docs/UPSCAYL-README.md](docs/UPSCAYL-README.md).

## Tải bản cài đặt

- **Bản chính thức:** vào mục **Releases** ở cột bên phải trang GitHub, tải file `PixStudio-x.y.z-win.exe`.
- **Bản build mới nhất:** vào tab **Actions**, mở lần chạy "Build Windows" gần nhất, tải file trong mục **Artifacts**.

## Sửa code trên một máy mới

### 1. Cài công cụ (chỉ làm một lần)
- [Git](https://git-scm.com/download/win)
- [Node.js 20 LTS](https://nodejs.org/)
- [VS Code](https://code.visualstudio.com/) (không bắt buộc, nhưng nên có)

### 2. Tải code về
```bash
git clone https://github.com/luanlengoc1991-art/pixstudio.git
cd pixstudio
npm install
```

### 3. Chạy thử khi đang sửa
```bash
npm run build   # build giao diện
npm start       # mở app
```

### 4. Lưu và đẩy thay đổi lên GitHub
```bash
git add .
git commit -m "Mô tả ngắn thay đổi"
git push
```
Sau mỗi lần `git push`, GitHub sẽ tự build file cài đặt mới (xem trong tab **Actions**, mất khoảng 10 phút).

### 5. Phát hành phiên bản mới
1. Sửa `"version"` trong `package.json` (ví dụ `1.0.1`), rồi commit.
2. Gắn tag phiên bản và đẩy lên:
```bash
git tag v1.0.1
git push --tags
```
GitHub sẽ tự build và tạo một bản trong mục **Releases**.

### 6. Khi đổi qua lại giữa nhiều máy
Trước khi bắt đầu sửa, luôn chạy `git pull` để lấy thay đổi mới nhất từ máy kia về.

## Code nằm ở đâu

| Thư mục / file | Nội dung |
|---|---|
| `renderer/` | Giao diện (Next.js + React + Tailwind) |
| `renderer/components/sidebar/` | Thanh bên: tab Phóng to, Tách nền, Cài đặt |
| `renderer/locales/vi.json` | Toàn bộ chữ tiếng Việt |
| `electron/` | Phần xử lý chính (main process) |
| `electron/commands/remove-background.ts` | Tách nền (ONNX, model của rembg) |
| `electron/commands/image-upscayl.ts` | Phóng to ảnh (gọi `upscayl-bin`) |
| `resources/models/` | 7 model phóng to |
| `resources/win/bin/` | `upscayl-bin.exe` |
| `.github/workflows/build-windows.yml` | Cấu hình tự build trên GitHub |

## Giấy phép

AGPL-3.0 (xem [LICENSE](LICENSE)). Khi phát hành app cho người khác, bạn phải công khai mã nguồn và giữ dòng ghi công Upscayl.

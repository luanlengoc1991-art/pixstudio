# Luan_MKT_Studio

Bộ công cụ xử lý ảnh bằng AI cho Windows, chạy ngay trên máy tính.
Dựa trên [Upscayl](https://github.com/upscayl/upscayl) (giấy phép AGPL-3.0). Hướng dẫn gốc của Upscayl: [docs/UPSCAYL-README.md](docs/UPSCAYL-README.md).

## Công cụ

| Công cụ | Trạng thái | Cách chạy |
|---|---|---|
| Kích nét ảnh (phóng to 4x, cả thư mục, 7 model) | ✅ | Trên máy, GPU (`upscayl-bin`) |
| Xóa Nền PNG | ✅ | Trên máy, model ONNX tự tải lần đầu (~170 MB) |
| Chuyển Vector (8 kiểu, SVG / PDF) | ✅ | Trên máy (`vtracer`, `potrace`) |
| Bế file in ấn (theo viền, bao cụm, bo tròn, chữ nhật) | ✅ | Trên máy, xuất PNG + SVG có lớp `CutContour` |
| Chỉnh sửa ảnh thẻ: Cắt ảnh + Xếp in | ✅ | Trên máy (2x3, 3x4, 4x6, Visa; khổ 10x15, A5, A4) |
| Bóc Tách Layer, Phục hồi ấn phẩm, Retoucher sản phẩm, Render 2D sang 3D, Thiết kế quảng cáo, Fake Model, Phối cảnh biển hiệu, Phục hồi ảnh cũ | ✅ | Qua cửa sổ ChatGPT trong app (tài khoản ChatGPT của bạn): app tự dán ảnh + yêu cầu, bạn bấm Gửi, ảnh tải về tự hiện trong công cụ |
| Ảnh thẻ AI (đổi trang phục, phông nền) | 🕓 | Chưa làm |

## Tải bản cài đặt

- **Bản chính thức:** vào mục **Releases** ở cột bên phải trang GitHub, tải file `Luan_MKT_Studio-x.y.z-win.exe`.
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
| `renderer/lib/tools.ts` | Danh sách 13 công cụ trên Trang chủ (tên, mô tả, trạng thái) |
| `renderer/components/shell/` | Thanh tab trên cùng và Trang chủ |
| `renderer/components/tools/` | Giao diện từng công cụ (`common/` là phần dùng chung, `chatgpt-tool.tsx` cho 8 công cụ qua ChatGPT) |
| `renderer/lib/ai-tools.ts` | Ô ảnh, tùy chọn và prompt của từng công cụ qua ChatGPT |
| `renderer/components/sidebar/` | Giao diện Kích nét ảnh (gốc Upscayl) |
| `renderer/locales/vi.json` | Chữ tiếng Việt của phần Kích nét ảnh |
| `electron/` | Phần xử lý chính (main process) |
| `electron/commands/remove-background.ts` | Xóa nền (ONNX, model của rembg) |
| `electron/commands/vectorize.ts` | Chuyển Vector và xuất PDF |
| `electron/commands/die-cut.ts` | Tạo đường bế |
| `electron/commands/image-upscayl.ts` | Phóng to ảnh (gọi `upscayl-bin`) |
| `electron/commands/chatgpt-bridge.ts` | Cửa sổ ChatGPT: nhớ đăng nhập, tự dán ảnh + prompt, bắt ảnh tải về |
| `resources/models/` | 7 model phóng to |
| `resources/win/bin/` | `upscayl-bin.exe`, `vtracer.exe` (MIT), `potrace.exe` (GPL, xem `licenses/`) |
| `.github/workflows/build-windows.yml` | Cấu hình tự build trên GitHub |

## Giấy phép

AGPL-3.0 (xem [LICENSE](LICENSE)). Khi phát hành app cho người khác, bạn phải công khai mã nguồn và giữ dòng ghi công Upscayl.

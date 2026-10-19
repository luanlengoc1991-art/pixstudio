# LMS trên web (Cloudflare Pages)

Bản web của LMS dùng chung giao diện với app (`renderer/`), build với
`NEXT_PUBLIC_LMS_WEB=1`. Phần việc của Electron được làm ngay trong trình duyệt
(`renderer/lib/web/`): Kích nét (Real-ESRGAN ONNX, WebGPU), Xóa nền (rembg ONNX),
Chuyển Vector (potrace + vtracer WASM), Bế file, Ảnh thẻ (cắt + xếp in).
Các công cụ qua ChatGPT chỉ có trong app máy tính.

```bash
npm run build:web    # xuất web/dist
npm run deploy:web   # build rồi đẩy lên Cloudflare Pages (project lms-studio)
```

Model AI nằm trong bucket R2 `lms-web-models`, được `functions/models/[name].ts`
trả về ở đường dẫn `/models/<tên>.onnx`. Thêm model mới:

```bash
npx wrangler r2 object put lms-web-models/<tên>.onnx --file <tệp> --remote
```

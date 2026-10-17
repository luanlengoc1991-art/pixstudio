# Bàn giao: tiếp tục sửa trên máy khác

Tóm tắt phiên làm việc ngày 16/10/2026 (Luan + Claude Code), để mở trên máy khác là
sửa tiếp được ngay. Khi mở phiên Claude Code mới, hãy bảo Claude đọc file này trước.

## Bắt đầu trên máy mới

```bash
git clone https://github.com/luanlengoc1991-art/pixstudio.git
cd pixstudio
npm install
npm start          # chạy app ở chế độ dev (Next dev server + Electron)
```

- Cần Git và Node.js 22.12+ (Electron 44 yêu cầu; các máy đang dùng Node 24).
- Nếu `npm start` báo `Not running in an Electron environment`, nghĩa là biến
  `ELECTRON_RUN_AS_NODE` đang bật (terminal trong VS Code hay đặt biến này). Tắt rồi chạy lại:
  PowerShell `$env:ELECTRON_RUN_AS_NODE = $null`, bash `env -u ELECTRON_RUN_AS_NODE npm start`.
- Đăng nhập ChatGPT một lần trong tab ChatGPT của app. Mỗi máy lưu phiên đăng nhập riêng.
  Google chặn đăng nhập ngay trong app ("Couldn't sign you in"), nên dùng nút
  **"Đăng nhập bằng Chrome"**: app mở Chrome (không có thì Edge) bằng hồ sơ riêng, bạn đăng
  nhập Google như trên web, app tự chép phiên ChatGPT về (`electron/commands/browser-login.ts`).
- Trước khi sửa: `git pull`. Sửa xong: commit rồi `git push`. GitHub Actions tự build bản cài.

## Phát hành & tự cập nhật (quy tắc bắt buộc)

App LMS đã cài **phải luôn tự cập nhật lên bản mới**. Cơ chế:

- Mỗi lần push lên `main`, workflow `.github/workflows/build-windows.yml` đặt phiên bản
  `<major>.<minor>.<số lần chạy>` (ví dụ 1.2.12), build và **phát hành GitHub Release**
  kèm `latest.yml`. Không cần gắn tag tay.
- App kiểm tra bản mới lúc mở và 30 phút một lần (`electron/main-window.ts`), tải ngầm, hỏi
  "Khởi động lại & cập nhật"; chọn "Để sau" thì bản mới tự cài khi đóng app
  (`electron/commands/auto-update.ts`).
- Không được làm hỏng chuỗi này:
  - Giữ `build.publish` trỏ về `luanlengoc1991-art/pixstudio` với `releaseType: release`.
  - **Không** đặt `win.publisherName` khi bản build chưa ký số (trình cập nhật sẽ từ chối).
  - Giữ `appId` `com.pixstudio.app` và thư mục dữ liệu `%APPDATA%\PixStudio`.
  - Muốn tăng phiên bản lớn thì sửa `major.minor` trong `package.json`; số cuối do workflow đặt.
  - Bản demo build tay phải đánh số cao hơn bản đã phát hành (ví dụ `1.3.0-demo.N`), nếu
    không nó sẽ tự "cập nhật" ngược về bản cũ.
- Phát hành bằng `gh release create` (một lần), **không** để electron-builder tự publish:
  electron-builder 26 tạo hai lượt upload chạy đua và để lại bản phát hành thiếu `latest.yml`.
- **Mac:** job `mac` chạy sau Windows, build `LMS-x.y.z-mac-arm64.dmg` và `-mac-x64.dmg`
  (ký ad-hoc `identity: "-"`, không cần Apple Developer) rồi đính vào cùng Release. App Mac
  chưa ký Apple nên không tự cài được; `electron/utils/mac-update.ts` hỏi GitHub, khi bản mới
  đã có .dmg đúng chip thì báo và mở link tải. vtracer lấy bản Mac chính thức, potrace biên
  dịch từ mã nguồn trong CI.
- Sau mỗi lần push, kiểm tra lần chạy "Build & Release" thành công và Release mới có đủ
  `LMS-x.y.z-win.exe`, `.blockmap`, `latest.yml`, `LMS-x.y.z-mac-arm64.dmg`, `LMS-x.y.z-mac-x64.dmg`.

## App hiện có gì

Tên hiển thị **LMS (LUAN MKT STUDIO)** (đổi từ Luan_MKT_Studio ngày 17/10) (repo vẫn tên `pixstudio`, `appId` và thư mục dữ liệu
`%APPDATA%\PixStudio` giữ nguyên để bản cài mới ghi đè bản cũ và không mất đăng nhập).

- **13 công cụ.** 5 chạy trên máy: Kích nét, Xóa nền, Vector, Bế file, Ảnh thẻ.
  8 chạy qua ChatGPT: Bóc tách layer, Phục hồi ấn phẩm, Retoucher, Render 3D,
  Thiết kế quảng cáo, Fake Model, Phối cảnh biển hiệu, Phục hồi ảnh cũ.
- **ChatGPT nhúng dạng tab** (`<webview>`, partition `persist:chatgpt`). Mỗi công cụ gửi
  một *job* gồm prompt, ảnh và số ảnh cần nhận. App tự làm các bước:
  - Đính kèm ảnh qua giao thức gỡ lỗi Chromium (`DOM.setFileInputFiles`). Nếu không được
    thì dán clipboard, cuối cùng là giả lập sự kiện.
  - Gõ prompt, bấm Gửi.
  - Chờ không giới hạn sớm: tối đa 25 phút với job nhiều ảnh.
  - Tự thu ảnh qua hook fetch/XHR và quét DOM. Ảnh người dùng gửi lên bị loại, ảnh trùng
    bị lọc bằng so sánh 32x32.
  - Có nút **"Lấy kết quả từ ChatGPT"** để quét lại cuộc chat đang mở.
- **Bóc tách layer** có màn hình riêng:
  - Chế độ tự động 10 lớp, hoặc khoanh vùng đỏ và đặt tên từng đối tượng.
  - Lưới 5 cột, "Tách tiếp" khi ChatGPT trả thiếu, "Tải toàn bộ" vào thư mục.
  - Gửi từng lớp sang Kích nét hoặc Vector. Prompt lấy từ pixAI.
- **Giao diện:**
  - Nền navy, kiểu dark là mặc định.
  - Thanh trên: VRAM / RAM / GPU (nvidia-smi), ô GPT đã kết nối (đọc cookie đăng nhập),
    tìm công cụ Ctrl+K.
  - Trang chủ kiểu đồ họa esports: nền 3D, các dòng công cụ đánh số, đồng hồ thời gian thực,
    dải chữ chạy.
  - Một font duy nhất là Be Vietnam Pro: tiêu đề đậm, chữ nhỏ ExtraLight.
- **Icon 3D** render bằng three.js. Mỗi công cụ một hình khối và màu riêng
  (`renderer/lib/tool-style.ts`). Script render lại nằm ở `scripts/render-icons/`. Khi thay
  file icon nhớ tăng `ICON_VERSION`.

## Mục tiêu đang làm dở

Người dùng muốn PixStudio **có đủ mọi chức năng của pixAI 1.2.6**. pixAI là app đã cài ở
`C:\Program Files\pixvip\pixAI`, cũng là fork Upscayl theo AGPL. Muốn đọc mã thì giải nén
`resources\app.asar`. Không đưa vào: mã kích hoạt bản quyền, quảng cáo, PostHog/Firebase.

Tiến độ và việc còn lại ghi trong [PIXAI-PARITY.md](PIXAI-PARITY.md). Thứ tự làm tiếp:

1. **Kiểm tra thực tế Bóc tách layer** với ChatGPT thật. Lần thử gần nhất ảnh đã lên được
   ChatGPT, nhưng app bỏ cuộc sớm. Đã sửa luật chờ, chưa thử lại.
2. ~~**Thiết kế quảng cáo + setup sự kiện.**~~ Đã làm ngày 17/10 (màn hình `components/tools/ad-designer/`), còn chờ thử với ChatGPT thật. Có 9 loại ấn phẩm, bảng màu, ảnh tham chiếu,
   và setup sự kiện cưới / sinh nhật / thôi nôi / khai trương… Prompt chi tiết nằm trong
   bundle của pixAI, ở đoạn khoảng ký tự 158000–205000 của file
   `renderer/out/_next/static/chunks/pages/index-*.js` sau khi giải nén app.asar.
3. ~~**Ảnh thẻ AI.**~~ Đã làm ngày 17/10 (`components/tools/id-photo/ai-panel.tsx`), còn chờ thử với ChatGPT thật. Đổi trang phục, phông nền, làm đẹp; mỗi lượt tối đa 10 ảnh.
4. **Phần lẻ từng công cụ:** tỉ lệ ảnh, mẫu bối cảnh mặt tiền, các chế độ so sánh.

## Cách người dùng muốn làm việc

- Trả lời bằng tiếng Việt.
- Sửa xong thì chạy app và chụp màn hình kiểm tra trước khi báo.
- Commit sau mỗi bước. Chỉ push khi người dùng bảo.
- Giao diện: ưu tiên dễ đọc, 3D hiện đại, không hoạt hình.

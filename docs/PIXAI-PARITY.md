# Đối chiếu chức năng với pixAI 1.2.6

pixAI (`C:\Program Files\pixvip\pixAI`) cũng là bản fork Upscayl (AGPL-3.0). Bảng dưới
liệt kê từng chức năng của pixAI và trạng thái trong PixStudio. Các phần thương mại của
pixAI (mã kích hoạt bản quyền theo máy, quảng cáo popup, danh sách chờ Pixel UP Cloud,
thu thập dữ liệu PostHog/Firebase) **không** đưa vào PixStudio.

Ký hiệu: ✅ đã có · 🟡 có một phần · ❌ còn thiếu

## Nền tảng

| Chức năng | Trạng thái | Ghi chú |
|---|---|---|
| ChatGPT nhúng trong app dạng tab (webview), nhớ đăng nhập, nút Back/Forward/Reload, chấm trạng thái đã kết nối | ✅ | |
| Tự đính kèm ảnh (file input → kéo thả → dán), tự gõ prompt, tự bấm Gửi | ✅ | Thêm DOM.setFileInputFiles qua DevTools protocol |
| Tự thu ảnh kết quả về công cụ (nhiều ảnh/lượt, bỏ ảnh đã gửi lên, chống trùng) | ✅ | Cần thử lại với ChatGPT thật sau khi sửa luật chờ |
| Sửa tiếp ảnh vừa tạo bằng nút "Chỉnh sửa" của ChatGPT | ✅ | "Chỉnh bằng AI" ở màn hình công cụ AI |
| Theo dõi GPU (% dùng, VRAM, nhiệt độ) | ✅ | Thanh trên cùng |
| Lưu tất cả ảnh kết quả vào một thư mục | ✅ | |
| Chuyển ảnh giữa các công cụ (→ Kích nét, → Vector, → Bóc tách) | ✅ | |
| Giao diện sáng / tối | ✅ | |

## Công cụ

| Công cụ | Trạng thái | Còn thiếu |
|---|---|---|
| Kích nét ảnh (7 model, 1–16x, thư mục, double, TTA, tile, metadata, custom width) | ✅ | Bảng điều khiển kiểu pixAI (thẻ model có icon, xem trước kích thước đầu ra, nút "Ảnh đã lưu") |
| Xóa nền | ✅ | |
| Bóc tách layer | ✅ | Chưa thử trọn vẹn với ChatGPT thật |
| Phục hồi ấn phẩm | ✅ | |
| Retoucher sản phẩm | 🟡 | Tỉ lệ (theo gốc, ngang chuẩn, dọc thời trang, ngang rộng); thêm phông (đen studio...) |
| Render 2D sang 3D | ✅ | |
| Thiết kế quảng cáo | ✅ | Màn hình riêng (`components/tools/ad-designer/`): 9 loại ấn phẩm + tỉ lệ, bảng màu, chip phong cách, ảnh tài liệu (20, có ghi chú) / phong cách (10) / mẫu chữ, "Chỉnh bằng AI", lịch sử. Chưa thử với ChatGPT thật |
| Thiết kế setup sự kiện (trong Thiết kế quảng cáo) | ✅ | 10 loại sự kiện, 6 kiểu dựng, 4 quy mô, 7 kích thước, vị trí chữ, bục/bóng/standee, ảnh thật hoặc Chibi 3D, phong cách decor, bối cảnh, ảnh nhân vật / mẫu setup / logo; nút gửi sang Bóc tách layer. Chưa thử với ChatGPT thật |
| Fake Model AI | 🟡 | Chọn giữ bối cảnh Ảnh 1 / Ảnh 2 / tự nhập; chế độ xem so sánh dáng, so sánh mặt & đồ, 3 ảnh cạnh nhau |
| Phối cảnh biển hiệu | 🟡 | Tự mô tả mặt tiền bằng chữ + 6 mẫu gợi ý; so sánh mặt tiền / thiết kế / 3 ảnh |
| Phục hồi ảnh cũ | ✅ | |
| Bế file in ấn | ✅ | |
| Chuyển Vector | ✅ | Xem trước mặt nạ logo 1 màu |
| Ảnh thẻ: cắt + xếp in | 🟡 | Khổ 13x18, Visa 5x5; tự động lấp đầy / xếp thủ công; combo 3x4 + 4x6; khổ dọc/ngang |
| Ảnh thẻ AI (trang phục, phông nền, làm đẹp; 1 ảnh hoặc 10 ảnh/lượt) | ❌ | |

## Thứ tự làm

1. ~~Nền tảng ChatGPT nhúng + tự gửi + tự thu ảnh~~ (xong)
2. ~~Bóc tách layer đầy đủ~~ (xong, chờ thử thực tế)
3. ~~Thiết kế quảng cáo + setup sự kiện~~ (xong, chờ thử thực tế)
4. Ảnh thẻ AI + bổ sung xếp in ← làm tiếp từ đây
5. Phần còn lại của từng công cụ (so sánh, tỉ lệ, mẫu gợi ý), GPU, lưu tất cả

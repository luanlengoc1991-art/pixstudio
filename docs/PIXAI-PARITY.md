# Đối chiếu chức năng với pixAI 1.2.6

pixAI (`C:\Program Files\pixvip\pixAI`) cũng là bản fork Upscayl (AGPL-3.0). Bảng dưới
liệt kê từng chức năng của pixAI và trạng thái trong PixStudio. Các phần thương mại của
pixAI (mã kích hoạt bản quyền theo máy, quảng cáo popup, danh sách chờ Pixel UP Cloud,
thu thập dữ liệu PostHog/Firebase) **không** đưa vào PixStudio.

Ký hiệu: ✅ đã có · 🟡 có một phần · ❌ còn thiếu

## Nền tảng

| Chức năng | Trạng thái | Ghi chú |
|---|---|---|
| ChatGPT nhúng trong app dạng tab (webview), nhớ đăng nhập, nút Back/Forward/Reload, chấm trạng thái đã kết nối | ❌ | PixStudio đang mở cửa sổ riêng |
| Tự đính kèm ảnh (file input → kéo thả → dán), tự gõ prompt, tự bấm Gửi | 🟡 | PixStudio dán ảnh + prompt, người dùng tự bấm Gửi |
| Tự thu ảnh kết quả về công cụ (nhiều ảnh/lượt, bỏ ảnh đã gửi lên, chống trùng) | 🟡 | PixStudio chỉ nhận ảnh khi người dùng bấm tải xuống |
| Sửa tiếp ảnh vừa tạo bằng nút "Chỉnh sửa" của ChatGPT | ❌ | |
| Theo dõi GPU (% dùng, VRAM, nhiệt độ) | ❌ | |
| Lưu tất cả ảnh kết quả vào một thư mục | ❌ | |
| Chuyển ảnh giữa các công cụ (→ Kích nét, → Vector, → Bóc tách) | 🟡 | Mới có → Kích nét |
| Giao diện sáng / tối | ✅ | |

## Công cụ

| Công cụ | Trạng thái | Còn thiếu |
|---|---|---|
| Kích nét ảnh (7 model, 1–16x, thư mục, double, TTA, tile, metadata, custom width) | ✅ | Bảng điều khiển kiểu pixAI (thẻ model có icon, xem trước kích thước đầu ra, nút "Ảnh đã lưu") |
| Xóa nền | ✅ | Nút "Chuyển sang Vector" |
| Bóc tách layer | 🟡 | Chế độ tự động 10 lớp; chế độ khoanh vùng đỏ có đặt tên từng đối tượng; lưới kết quả N ảnh + ảnh nền đã xóa; "Tách tiếp"; tải tất cả; gửi từng lớp sang Kích nét / Vector |
| Phục hồi ấn phẩm | 🟡 | So sánh trước/sau; tiến trình từng bước |
| Retoucher sản phẩm | 🟡 | Tỉ lệ (theo gốc, ngang chuẩn, dọc thời trang, ngang rộng); thêm phông (đen studio...); so sánh trước/sau |
| Render 2D sang 3D | 🟡 | So sánh trước/sau |
| Thiết kế quảng cáo | 🟡 | Loại ấn phẩm (banner, poster, standee, backdrop, biển hiệu, Facebook, sản phẩm, thiệp mời, tự chọn kích thước); bảng màu; chip phong cách; ảnh tham chiếu (tài liệu, phong cách, font); lịch sử; "Chỉnh bằng AI" |
| Thiết kế setup sự kiện (trong Thiết kế quảng cáo) | ❌ | 9 mẫu sự kiện; quy mô setup; vị trí chữ; bục/bóng/standee; standee chibi hoặc ảnh thật; logo; bối cảnh; sửa bằng AI |
| Fake Model AI | 🟡 | Chọn giữ bối cảnh Ảnh 1 / Ảnh 2 / tự nhập; chế độ xem so sánh dáng, so sánh mặt & đồ, 3 ảnh cạnh nhau |
| Phối cảnh biển hiệu | 🟡 | Tự mô tả mặt tiền bằng chữ + 6 mẫu gợi ý; so sánh mặt tiền / thiết kế / 3 ảnh |
| Phục hồi ảnh cũ | 🟡 | So sánh trước/sau |
| Bế file in ấn | ✅ | |
| Chuyển Vector | ✅ | Xem trước mặt nạ logo 1 màu |
| Ảnh thẻ: cắt + xếp in | 🟡 | Khổ 13x18, Visa 5x5; tự động lấp đầy / xếp thủ công; combo 3x4 + 4x6; khổ dọc/ngang |
| Ảnh thẻ AI (trang phục, phông nền, làm đẹp; 1 ảnh hoặc 10 ảnh/lượt) | ❌ | |

## Thứ tự làm

1. Nền tảng ChatGPT nhúng + tự gửi + tự thu ảnh (mọi công cụ AI phụ thuộc phần này)
2. Bóc tách layer đầy đủ
3. Thiết kế quảng cáo + setup sự kiện
4. Ảnh thẻ AI + bổ sung xếp in
5. Phần còn lại của từng công cụ (so sánh, tỉ lệ, mẫu gợi ý), GPU, lưu tất cả

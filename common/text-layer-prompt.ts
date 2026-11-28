export const TEXT_LAYER_TRANSPARENCY_RULES = `QUY TẮC RIÊNG CHO CÁC FILE CHỮ — ƯU TIÊN CAO NHẤT:
1. NỀN TRONG SUỐT THỰC SỰ (TRUE ALPHA = 0):
   - Mọi pixel không thuộc nét chữ hoặc hiệu ứng trực tiếp của chữ (stroke, viền sáng, bóng đổ sát chữ) BẮT BUỘC phải hoàn toàn trong suốt (RGBA alpha = 0).
   - Toàn bộ khoảng trống giữa các chữ cái, khoảng cách giữa các dòng và đặc biệt là LÒNG CHỮ KHÉP KÍN (bên trong các chữ O, Ô, Ơ, A, Ă, Â, P, B, D, Đ, R, Q, số 0, 4, 6, 8, 9) PHẢI TRONG SUỐT XUYÊN THẤU, tuyệt đối không được giữ màu nền cũ bên trong lòng chữ!
   - TUYỆT ĐỐI KHÔNG tạo tấm bảng chữ nhật, nhãn dán hay mảng nền màu lót phía sau khối chữ.
   - TUYỆT ĐỐI KHÔNG vẽ bàn cờ caro xám-trắng giả trong suốt (fake checkerboard).
2. BẢO TOÀN TUYỆT ĐỐI CHỮ TIẾNG VIỆT & TYPOGRAPHY:
   - Giữ chính xác 100% nội dung văn bản, chính tả và đầy đủ dấu tiếng Việt (sắc, huyền, hỏi, ngã, nặng, mũ, râu móc).
   - Giữ đúng kiểu font chữ, độ dày nét, khoảng cách ký tự (kerning/tracking), màu sắc, gradient, ánh kim 3D và viền stroke như thiết kế gốc.
   - Giữ nguyên kích thước khung canvas và đúng vị trí/tỷ lệ của cụm chữ trên ảnh gốc để khi đặt đè lên ảnh nền sạch sẽ khớp khít 100%.`;

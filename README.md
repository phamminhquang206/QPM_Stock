# 📈 QPM Stock AI - Trợ Lý Chứng Khoán Việt Nam Realtime

Ứng dụng web tích hợp trợ lý ảo về thị trường chứng khoán Việt Nam, theo dõi giá cổ phiếu, vàng

---

## 🚀 Tính Năng Nổi Bật

1. **⚡ Dữ Liệu Khớp Lệnh Realtime**:
   - Truy vấn trực tiếp giá khớp, trần, sàn, tham chiếu, khối lượng giao dịch và dòng tiền khối ngoại (Foreign Net Buy/Sell).
2. **🤖 Gemini Function Calling (Tools)**:
   - `get_stock_quote`: Lấy dữ liệu bảng giá cho bất kỳ mã cổ phiếu nào (`FPT`, `HPG`, `VNM`, `SSI`, `VCB`, `MWG`...).
   - `get_market_indices`: Cập nhật diễn biến các chỉ số `VN-INDEX`, `VN30`, `HNX`, `UPCoM`.
   - `get_financial_ratios`: Phân tích định giá cơ bản (`P/E`, `P/B`, `ROE`, `EPS`, Vốn hóa).
   - `get_stock_history`: Lấy dữ liệu lịch sử giá OHLCV phục vụ phân tích kỹ thuật.
4. **🔒 Bảo Mật Tuyệt Đối**:
   - Gemini API Key được lưu trực tiếp trong `localStorage` trên trình duyệt của bạn, không truyền qua bất kỳ server trung gian nào.

---

### Bước Thiết Lập Gemini API Key
1. Nhận API Key miễn phí từ [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Nhấn nút **⚙️ Cấu hình Gemini API** ở góc trên bên phải màn hình ứng dụng.
3. Dán API Key vào ô và nhấn **Lưu Cấu Hình**.
4. Bắt đầu trò chuyện và phân tích cổ phiếu!

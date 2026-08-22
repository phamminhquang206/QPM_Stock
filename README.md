# 📈 QPM Stock AI - Trợ Lý Chứng Khoán Việt Nam Realtime

Ứng dụng web trợ lý ảo thông minh chuyên sâu về thị trường chứng khoán Việt Nam (HOSE, HNX, UPCoM), kết hợp sức mạnh phân tích của **Google Gemini AI** với cơ chế **Function Calling (Tools)** truy vấn bảng giá trực tiếp theo thời gian thực.

---

## 🚀 Tính Năng Nổi Bật

1. **⚡ Dữ Liệu Khớp Lệnh Realtime 100% Chính Xác**:
   - Truy vấn trực tiếp giá khớp, trần, sàn, tham chiếu, khối lượng giao dịch và dòng tiền khối ngoại (Foreign Net Buy/Sell).
   - Tự động hiển thị thẻ cổ phiếu (**Live Stock Card**) trực quan ngay trong hội thoại.
2. **🤖 Gemini Function Calling (Tools)**:
   - `get_stock_quote`: Lấy dữ liệu bảng giá cho bất kỳ mã cổ phiếu nào (`FPT`, `HPG`, `VNM`, `SSI`, `VCB`, `MWG`...).
   - `get_market_indices`: Cập nhật diễn biến các chỉ số `VN-INDEX`, `VN30`, `HNX`, `UPCoM`.
   - `get_financial_ratios`: Phân tích định giá cơ bản (`P/E`, `P/B`, `ROE`, `EPS`, Vốn hóa).
   - `get_stock_history`: Lấy dữ liệu lịch sử giá OHLCV phục vụ phân tích kỹ thuật.
3. **📊 Biểu Đồ Kỹ Thuật Tương Tác**:
   - Tích hợp biểu đồ nến Candlestick & Volume đa khung thời gian (`1M`, `3M`, `6M`, `1Y`).
   - Tự động đồng bộ biểu đồ sang mã cổ phiếu mà bạn đang hỏi AI.
4. **🔒 Bảo Mật Tuyệt Đối**:
   - Gemini API Key được lưu trực tiếp trong `localStorage` trên trình duyệt của bạn, không truyền qua bất kỳ server trung gian nào.

---

## 💻 Hướng Dẫn Sử Dụng

### Cách 1: Mở trực tiếp trên trình duyệt
- Nhấp đúp vào file [`index.html`](index.html) trong thư mục `QPM_Stock/` để mở ngay trên trình duyệt Chrome / Edge.

### Cách 2: Chạy qua Live Server hoặc Local HTTP Server
```bash
# Sử dụng Python để mở local server
cd d:\Code\QuangPM_APP\QPM_Stock
python -m http.server 8080
```
Sau đó truy cập: `http://localhost:8080`

### Bước Thiết Lập Gemini API Key
1. Nhận API Key miễn phí từ [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Nhấn nút **⚙️ Cấu hình Gemini API** ở góc trên bên phải màn hình ứng dụng.
3. Dán API Key vào ô và nhấn **Lưu Cấu Hình**.
4. Bắt đầu trò chuyện và phân tích cổ phiếu!

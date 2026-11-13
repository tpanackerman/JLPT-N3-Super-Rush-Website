# JLPT N3 Super Rush Website

Ứng dụng web hỗ trợ ôn luyện kiến thức tiếng Nhật trình độ JLPT N3 (Từ vựng, Kanji, Ngữ pháp và Luyện đề tốc độ cao).

## Tính năng chính

- **Luyện tập trọng tâm:** Hệ thống hóa kiến thức N3 theo từng chủ đề và lộ trình ôn thi cấp tốc.
- **Giao diện trực quan:** Tối ưu hóa trải nghiệm học tập và tra cứu nhanh trên trình duyệt.
- **Chạy mượt mà ở môi trường local:** Xây dựng trên nền tảng Node.js hiện đại.

## Yêu cầu hệ thống

- [Node.js](https://nodejs.org/) (phiên bản 18 trở lên)
- `npm` (đi kèm khi cài đặt Node.js)

## How to Run Locally

1. **Clone repository về máy:**
   ```bash
   git clone [https://github.com/tpanackerman/JLPT-N3-Super-Rush-Website.git](https://github.com/tpanackerman/JLPT-N3-Super-Rush-Website.git)
   cd JLPT-N3-Super-Rush-Website
   ```

2. **Cài đặt các thư viện phụ thuộc:**
   ```bash
   npm install
   ```

3. **Khởi chạy server phát triển (Development Server):**
   ```bash
   npm run dev
   ```
   *(Hoặc nếu bạn đang mở trực tiếp từ thư mục làm việc cá nhân:*
   ```bash
   cd "/home/tpan/Study Material /JLPT /jlpt-n3-app"
   npm run dev
   ```
   *)*

4. Mở trình duyệt và truy cập địa chỉ hiển thị trên Terminal (thường là `http://localhost:5173` hoặc `http://localhost:3000`).

## Cấu trúc thư mục cơ bản

```text
jlpt-n3-app/
├── public/          # Tài nguyên tĩnh (hình ảnh, icon,...)
├── src/             # Mã nguồn chính của ứng dụng
├── package.json     # Danh sách thư viện và script chạy dự án
└── README.md        # Tài liệu giới thiệu và hướng dẫn sử dụng
```# JLPT-N3-Super-Rush-Website

# Needles Backend

Backend API for Needles e-commerce platform built with Node.js, Express, Prisma, and PostgreSQL.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

3. Run database migrations:
   ```bash
   npm run prisma:migrate
   ```

4. Seed the database:
   ```bash
   npm run seed
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

## API Endpoints

- **Auth**: `/api/auth`
- **Products**: `/api/products`
- **Categories**: `/api/categories`
- **Orders**: `/api/orders`
- **Customers**: `/api/customers`
- **Reviews**: `/api/reviews`
- **Coupons**: `/api/coupons`
- **Banners**: `/api/banners`
- **Testimonials**: `/api/testimonials`
- **Dashboard**: `/api/dashboard`

## Image upload deployment requirements

Admin image and video uploads use `multipart/form-data` and are stored in Cloudinary.
The backend accepts up to 10 MB per file by default (`UPLOAD_MAX_FILE_SIZE` can
override this in bytes). The reverse proxy must allow the complete multipart
request, including two banner images:

```nginx
location / {
    client_max_body_size 25m;
    proxy_pass http://127.0.0.1:5000;
}
```

Keep the frontend upload budget below the proxy limit. The admin frontend
compresses single images to 800 KB and each of the two optional banner images
to 400 KB, keeping the complete banner multipart request below 1 MB.

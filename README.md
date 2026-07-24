# Neddles Backend

Backend API for Neddles e-commerce platform built with Node.js, Express, Prisma, and PostgreSQL.

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

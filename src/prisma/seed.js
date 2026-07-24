const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@neddles.com" },
    update: {},
    create: {
      email: "admin@neddles.com",
      name: "Admin",
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  const customerUser = await prisma.user.upsert({
    where: { email: "customer@neddles.com" },
    update: {},
    create: {
      email: "customer@neddles.com",
      name: "Test Customer",
      password: await bcrypt.hash("customer123", 12),
      role: "CUSTOMER",
    },
  });

  const customer = await prisma.customer.upsert({
    where: { id: customerUser.id },
    update: {},
    create: {
      id: customerUser.id,
      name: "Test Customer",
      email: "customer@neddles.com",
      phone: "+1234567890",
      address: "123 Test Street, Test City",
    },
  });

  const category1 = await prisma.category.upsert({
    where: { slug: "dresses" },
    update: {},
    create: { name: "Dresses", slug: "dresses", description: "Beautiful women dresses" },
  });

  const category2 = await prisma.category.upsert({
    where: { slug: "tops" },
    update: {},
    create: { name: "Tops", slug: "tops", description: "Stylish tops and blouses" },
  });

  const category3 = await prisma.category.upsert({
    where: { slug: "bottoms" },
    update: {},
    create: { name: "Bottoms", slug: "bottoms", description: "Pants, skirts, and shorts" },
  });

  await prisma.product.upsert({
    where: { slug: "floral-summer-dress" },
    update: {},
    create: {
      name: "Floral Summer Dress",
      slug: "floral-summer-dress",
      description: "Light and breezy floral dress perfect for summer",
      price: 49.99,
      stock: 50,
      sku: "DRS-001",
      categoryId: category1.id,
    },
  });

  await prisma.product.upsert({
    where: { slug: "elegant-evening-gown" },
    update: {},
    create: {
      name: "Elegant Evening Gown",
      slug: "elegant-evening-gown",
      description: "Stunning evening gown for special occasions",
      price: 129.99,
      stock: 25,
      sku: "DRS-002",
      categoryId: category1.id,
    },
  });

  await prisma.product.upsert({
    where: { slug: "silk-blouse" },
    update: {},
    create: {
      name: "Silk Blouse",
      slug: "silk-blouse",
      description: "Premium silk blouse with elegant design",
      price: 39.99,
      stock: 100,
      sku: "TOP-001",
      categoryId: category2.id,
    },
  });

  await prisma.product.upsert({
    where: { slug: "high-waist-jeans" },
    update: {},
    create: {
      name: "High Waist Jeans",
      slug: "high-waist-jeans",
      description: "Comfortable high waist denim jeans",
      price: 59.99,
      stock: 75,
      sku: "BTT-001",
      categoryId: category3.id,
    },
  });

  await prisma.banner.upsert({
    where: { id: "banner-welcome" },
    update: {},
    create: {
      id: "banner-welcome",
      title: "Welcome to Neddles",
      image: "/uploads/banners/welcome.jpg",
      link: "/collections",
      isActive: true,
    },
  });

  await prisma.testimonial.upsert({
    where: { id: "testimonial-1" },
    update: {},
    create: {
      id: "testimonial-1",
      name: "Sarah Johnson",
      comment: "Amazing quality clothing! Love every piece I've ordered.",
      rating: 5,
      isActive: true,
    },
  });

  console.log("Seed data created successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

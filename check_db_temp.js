const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, isActive: true, lastLogin: true },
    });
    console.log("Users:", JSON.stringify(users, null, 2));
    const target = await prisma.user.findUnique({ where: { email: "aaneddles@gmail.com" } });
    console.log("Target exists?", !!target);
    if (target) console.log("Target user:", JSON.stringify(target, null, 2));
    else console.log("User aaneddles@gmail.com not found in database");
  } catch (e) {
    console.error("Error:", e.message);
  }
  await prisma.$disconnect();
}
main();

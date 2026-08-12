const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const email = "aaneddles@gmail.com";
  const password = "Password123@";
  const hashed = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("User already exists, updating password and role...");
    await prisma.user.update({
      where: { email },
      data: { password: hashed, isActive: true, role: "ADMIN" },
    });
    console.log("Updated.");
  } else {
    const user = await prisma.user.create({
      data: {
        email,
        name: "AA Neddles Admin",
        password: hashed,
        role: "ADMIN",
        isActive: true,
      },
    });
    console.log("Admin user created:", user.id, user.email, user.role);
  }

  const verify = await prisma.user.findUnique({ where: { email } });
  console.log("Verification - Found:", !!verify, "Role:", verify.role, "Active:", verify.isActive);
  const pwMatch = await bcrypt.compare(password, verify.password);
  console.log("Password match:", pwMatch);

  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

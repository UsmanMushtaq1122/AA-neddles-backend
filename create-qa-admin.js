const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const email = "qa.bannertest@gmail.com";
  const existing = await prisma.user.findUnique({ where: { email } });
  const hash = await bcrypt.hash("QaTest123!", 12);

  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { password: hash, role: "ADMIN", isActive: true } })
    : await prisma.user.create({ data: { email, name: "QA Banner Test Admin", password: hash, role: "ADMIN" } });

  console.log(JSON.stringify({ id: user.id, email: user.email, role: user.role, created: !existing }));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

const prisma = require("../config/db");
const { sendEmail } = require("../utils/email");
const logger = require("../config/logger");

const checkLowStock = async () => {
  try {
    const lowStockProducts = await prisma.product.findMany({
      where: { stock: { lte: 10 } },
    });

    if (lowStockProducts.length > 0) {
      const productList = lowStockProducts
        .map((p) => `${p.name} (Stock: ${p.stock})`)
        .join("<br>");

      await sendEmail({
        to: process.env.ADMIN_EMAIL,
        subject: "Low Stock Alert",
        html: `<p>The following products are low on stock:</p><p>${productList}</p>`,
      });
    }

    logger.info(`Checked low stock: ${lowStockProducts.length} products`);
  } catch (error) {
    logger.error("Inventory alert job failed:", error);
  }
};

module.exports = { checkLowStock };

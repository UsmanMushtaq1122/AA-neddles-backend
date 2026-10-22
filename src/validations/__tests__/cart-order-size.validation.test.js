const { addCartItemSchema } = require("../cart.validation");
const { createOrderSchema } = require("../order.validation");

const shippingAddress = {
  firstName: "Test",
  lastName: "Customer",
  email: "test@example.com",
  phone: "03001234567",
  addressLine1: "1 Main Street",
  city: "Lahore",
  province: "Punjab",
  country: "Pakistan",
};

describe("selected size validation", () => {
  test("accepts a selected size on cart items", () => {
    const { error, value } = addCartItemSchema.validate({
      productId: "product-id",
      quantity: 1,
      selectedSize: "M",
    });

    expect(error).toBeUndefined();
    expect(value.selectedSize).toBe("M");
  });

  test("accepts and preserves selected sizes in checkout items", () => {
    const { error, value } = createOrderSchema.validate({
      items: [{ productId: "product-id", quantity: 1, price: 100, selectedSize: "M" }],
      shippingAddress,
      paymentMethod: "COD",
    });

    expect(error).toBeUndefined();
    expect(value.items[0].selectedSize).toBe("M");
  });

  test("rejects non-string selected sizes", () => {
    const { error } = addCartItemSchema.validate({
      productId: "product-id",
      quantity: 1,
      selectedSize: 3,
    });

    expect(error).toBeDefined();
  });
});

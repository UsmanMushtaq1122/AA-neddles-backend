const { createProductSchema, updateProductSchema } = require("../product.validation");

describe("product size and care-instruction validation", () => {
  test("parses and trims admin multipart JSON arrays", () => {
    const { error, value } = createProductSchema.validate({
      name: "Test product",
      price: "10",
      stock: "2",
      categoryId: "category-id",
      sizes: '[" M ", "L"]',
      careInstructions: '[" Wash cold "]',
    });

    expect(error).toBeUndefined();
    expect(value.sizes).toEqual(["M", "L"]);
    expect(value.careInstructions).toEqual(["Wash cold"]);
  });

  test("accepts native arrays and explicit empty arrays on update", () => {
    const { error, value } = updateProductSchema.validate({
      name: "Test product",
      sizes: [],
      careInstructions: ["Hand wash"],
    });

    expect(error).toBeUndefined();
    expect(value.sizes).toEqual([]);
    expect(value.careInstructions).toEqual(["Hand wash"]);
  });

  test.each([
    ["not-json", "Sizes"],
    ['["", "M"]', "Sizes"],
    ['["M", 2]', "Sizes"],
    ['[""]', "Care instructions"],
  ])("rejects invalid array input %s", (input, field) => {
    const property = field === "Sizes" ? "sizes" : "careInstructions";
    const { error } = updateProductSchema.validate({ name: "Test product", [property]: input });

    expect(error).toBeDefined();
    expect(error.details.some((detail) => detail.message.includes(field))).toBe(true);
  });
});

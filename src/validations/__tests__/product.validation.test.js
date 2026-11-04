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

describe("product detailed description validation", () => {
  test("parses structured JSON and preserves dynamic sections", () => {
    const { error, value } = createProductSchema.validate({
      name: "Detailed product",
      price: "10",
      stock: "2",
      categoryId: "category-id",
      fabric: " Silk ",
      descriptionSections: JSON.stringify({
        color: "Navy",
        note: "Dry clean only",
        sections: [{ title: "Shirt", items: ["Embroidered front", "Sleeves"] }],
      }),
    });

    expect(error).toBeUndefined();
    expect(value.fabric).toBe(" Silk ");
    expect(value.descriptionSections.sections).toHaveLength(1);
    expect(value.descriptionSections.sections[0].items).toEqual([
      "Embroidered front",
      "Sleeves",
    ]);
  });

  test("rejects malformed structured description payloads", () => {
    const { error } = updateProductSchema.validate({
      name: "Detailed product",
      descriptionSections: '{"sections":"not-an-array"}',
    });

    expect(error).toBeDefined();
  });
});

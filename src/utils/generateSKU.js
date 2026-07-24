const generateSKU = (name) => {
  const prefix = name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase())
    .join("")
    .slice(0, 4);
  const suffix = Date.now().toString(36).toUpperCase().slice(-4);
  return `${prefix}-${suffix}`;
};

module.exports = generateSKU;

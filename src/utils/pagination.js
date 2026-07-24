const getSkip = (page, limit) => {
  const safePage = Math.max(1, parseInt(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit) || 10));
  return (safePage - 1) * safeLimit;
};

const paginate = (total, page, limit) => {
  const safePage = Math.max(1, parseInt(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit) || 10));
  return {
    total,
    page: safePage,
    totalPages: Math.ceil(total / safeLimit),
  };
};

module.exports = { getSkip, paginate };

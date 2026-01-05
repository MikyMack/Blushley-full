exports.getFinalPrice = (product, variantOption) => {
    // Priority: Admin Sale → Admin Base → Sale → Base
    if (variantOption) {
      if (variantOption.adminSalePrice > 0) return variantOption.adminSalePrice;
      if (variantOption.adminBasePrice > 0) return variantOption.adminBasePrice;
      if (variantOption.price > 0) return variantOption.price;
    }
  
    if (product.adminSalePrice > 0) return product.adminSalePrice;
    if (product.adminBasePrice > 0) return product.adminBasePrice;
    if (product.salePrice > 0) return product.salePrice;
  
    return product.basePrice;
  };
  
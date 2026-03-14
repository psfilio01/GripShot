export interface Product {
  id: string;
  name?: string;
  /**
   * Root folder for this product, e.g. <DATA_ROOT>/products/pilates-mini-ball
   */
  basePath: string;
}

export function buildProductFromId(productId: string, dataRoot: string): Product {
  return {
    id: productId,
    name: productId,
    basePath: `${dataRoot}/products/${productId}`
  };
}


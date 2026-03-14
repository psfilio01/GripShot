"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProductFromId = buildProductFromId;
function buildProductFromId(productId, dataRoot) {
    return {
        id: productId,
        name: productId,
        basePath: `${dataRoot}/products/${productId}`
    };
}

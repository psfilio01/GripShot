"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGeneratedRoot = getGeneratedRoot;
exports.storeImage = storeImage;
exports.moveImage = moveImage;
const fs_extra_1 = __importDefault(require("fs-extra"));
const node_path_1 = require("node:path");
function getGeneratedRoot(dataRoot) {
    return (0, node_path_1.join)(dataRoot, "generated");
}
async function storeImage(args) {
    const { product, jobId, bucket, imageId, extension = "png", buffer } = args;
    const dataRoot = process.env.WORKFLOW_DATA_ROOT ?? process.cwd() + "/data";
    const generatedRoot = getGeneratedRoot(dataRoot);
    const dir = (0, node_path_1.join)(generatedRoot, product.id, jobId, bucket);
    await fs_extra_1.default.ensureDir(dir);
    const filePath = (0, node_path_1.join)(dir, `${imageId}.${extension}`);
    await fs_extra_1.default.writeFile(filePath, buffer);
    return filePath;
}
async function moveImage(currentPath, targetBucket, productId, jobId, imageId) {
    const dataRoot = process.env.WORKFLOW_DATA_ROOT ?? process.cwd() + "/data";
    const generatedRoot = getGeneratedRoot(dataRoot);
    const ext = currentPath.split(".").pop() ?? "png";
    const targetDir = (0, node_path_1.join)(generatedRoot, productId, jobId, targetBucket);
    await fs_extra_1.default.ensureDir(targetDir);
    const targetPath = (0, node_path_1.join)(targetDir, `${imageId}.${ext}`);
    await fs_extra_1.default.move(currentPath, targetPath, { overwrite: true });
    return targetPath;
}

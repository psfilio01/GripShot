#!/usr/bin/env bash
set -euo pipefail

# Download and install Real-ESRGAN binary for the current platform.
# Usage: ./scripts/setup-realesrgan.sh
# The binary + models are placed in vendor/realesrgan-ncnn-vulkan/

# Release tag vs. ncnn asset names: GitHub uses dated zips (e.g. 20220424), not ${VERSION} in the filename.
VERSION="v0.2.5.0"
NCNN_BUILD="20220424"
BASE_URL="https://github.com/xinntao/Real-ESRGAN/releases/download/${VERSION}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
VENDOR_DIR="${REPO_ROOT}/vendor/realesrgan-ncnn-vulkan"

detect_platform() {
  local os
  os="$(uname -s)"

  case "${os}" in
    Linux)
      echo "realesrgan-ncnn-vulkan-${NCNN_BUILD}-ubuntu.zip"
      ;;
    Darwin)
      echo "realesrgan-ncnn-vulkan-${NCNN_BUILD}-macos.zip"
      ;;
    MINGW*|MSYS*|CYGWIN*|Windows_NT)
      echo "realesrgan-ncnn-vulkan-${NCNN_BUILD}-windows.zip"
      ;;
    *)
      echo ""
      ;;
  esac
}

ARCHIVE="$(detect_platform)"

if [ -z "${ARCHIVE}" ]; then
  echo "ERROR: Unsupported platform: $(uname -s) $(uname -m)"
  exit 1
fi

DOWNLOAD_URL="${BASE_URL}/${ARCHIVE}"

echo "==> Platform: $(uname -s) $(uname -m)"
echo "==> Downloading Real-ESRGAN ${VERSION} from ${DOWNLOAD_URL}"

mkdir -p "${VENDOR_DIR}"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

curl -fSL "${DOWNLOAD_URL}" -o "${TMP_DIR}/realesrgan.zip"
echo "==> Extracting to ${VENDOR_DIR}"
unzip -o -q "${TMP_DIR}/realesrgan.zip" -d "${TMP_DIR}/extracted"

# The ZIP may contain a top-level directory or flat files
EXTRACTED_DIR="${TMP_DIR}/extracted"
if [ "$(ls -d "${EXTRACTED_DIR}"/realesrgan-* 2>/dev/null | wc -l)" -ge 1 ]; then
  EXTRACTED_DIR="$(ls -d "${EXTRACTED_DIR}"/realesrgan-* | head -1)"
fi

cp -f "${EXTRACTED_DIR}/realesrgan-ncnn-vulkan"* "${VENDOR_DIR}/" 2>/dev/null || true
cp -f "${EXTRACTED_DIR}/realesrgan-ncnn-vulkan.exe" "${VENDOR_DIR}/" 2>/dev/null || true

# Copy model files
mkdir -p "${VENDOR_DIR}/models"
cp -f "${EXTRACTED_DIR}/models/"* "${VENDOR_DIR}/models/" 2>/dev/null || true

# Make binary executable
chmod +x "${VENDOR_DIR}/realesrgan-ncnn-vulkan" 2>/dev/null || true

echo "==> Installed to ${VENDOR_DIR}"
echo "==> Binary: ${VENDOR_DIR}/realesrgan-ncnn-vulkan"
echo "==> Models: ${VENDOR_DIR}/models/"
echo ""
echo "Done! The upscaler is ready to use."

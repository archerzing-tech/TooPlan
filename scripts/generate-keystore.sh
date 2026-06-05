#!/bin/bash
# Generate a stable Android keystore for TooPlan APK signing
#
# Run this script ONCE to create a keystore and get the values
# needed for GitHub Actions secrets.
#
# Usage: bash scripts/generate-keystore.sh
#
# Then add these GitHub secrets to your repository:
#   ANDROID_KEY_BASE64  (output of base64 below)
#   ANDROID_KEY_ALIAS   = "tooplan"
#   ANDROID_KEY_PASSWORD = "tooplan123"

set -euo pipefail

KEYSTORE_DIR="src-tauri/gen/android"
KEYSTORE_FILE="$KEYSTORE_DIR/tooplan-release.keystore"
KEY_ALIAS="tooplan"
KEY_PASSWORD="tooplan123"
KEY_VALIDITY=10000

echo "=================================================="
echo "  TooPlan Android Keystore Generator"
echo "=================================================="
echo ""
echo "This will create a keystore at: $KEYSTORE_FILE"
echo ""

if [ -f "$KEYSTORE_FILE" ]; then
    echo "⚠️  Keystore already exists at $KEYSTORE_FILE"
    read -p "Overwrite? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
fi

mkdir -p "$KEYSTORE_DIR"

# Generate the keystore
keytool -genkey -v \
    -keystore "$KEYSTORE_FILE" \
    -alias "$KEY_ALIAS" \
    -keyalg RSA \
    -keysize 2048 \
    -validity "$KEY_VALIDITY" \
    -storepass "$KEY_PASSWORD" \
    -keypass "$KEY_PASSWORD" \
    -dname "CN=TooPlan, OU=Development, O=TooPlan, L=Beijing, S=Beijing, C=CN"

echo ""
echo "✅ Keystore generated: $KEYSTORE_FILE"
echo ""

# Output the GitHub secrets values
echo "=================================================="
echo "  Add these GitHub secrets for CI/CD:"
echo "=================================================="
echo ""
echo "  1. ANDROID_KEY_BASE64 (copy below):"
echo ""
base64 -i "$KEYSTORE_FILE"
echo ""
echo "  2. ANDROID_KEY_ALIAS = $KEY_ALIAS"
echo "  3. ANDROID_KEY_PASSWORD = $KEY_PASSWORD"
echo ""
echo "=================================================="
echo ""
echo "To add secrets to GitHub:"
echo "  1. Go to your repo: Settings → Secrets and variables → Actions"
echo "  2. Add each secret above"
echo "  3. The next 'v*' tag push will use the consistent key"
echo ""
echo "Done!"

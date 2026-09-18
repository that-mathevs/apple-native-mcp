#!/bin/sh
# Sign a development build of the helper with an identity of the developer's own, when they name
# one in HELPER_SIGNING_IDENTITY.
#
# `swift build` signs ad hoc, and an ad-hoc build is identified by the hash of its code: to macOS
# it is a new program every time it is rebuilt, and every permission granted to the last build is
# gone. Signed with a certificate, it is identified by its identifier and that certificate, which
# a rebuild does not change (#4 found the same for Developer ID). The identity lives in the
# developer's keychain, so nothing is signed unless they name one, and a release is never signed
# here: that is CI's job, with Developer ID, hardened and notarised (ADR-0003).
set -eu

build="${1:?usage: sign-development-build.sh <path to the built helper>}"
identity="${HELPER_SIGNING_IDENTITY:-}"

if [ ! -f "$build" ]; then
  echo "There is no helper build at $build." >&2
  exit 1
fi

if [ -z "$identity" ]; then
  echo "The helper is ad-hoc signed, so macOS forgets its permissions at every rebuild."
  echo "To keep them, name a signing identity: HELPER_SIGNING_IDENTITY=\"Apple Development\"."
  exit 0
fi

# The identifier is the one in Info.plist, which is what the permissions are attributed to.
codesign --force --sign "$identity" \
  --identifier io.github.that-mathevs.apple-native-mcp "$build"
codesign --verify --strict "$build"

echo "The helper is signed as:"
codesign --display --requirements - "$build" 2>&1 | sed -n 's/^designated => /  /p'

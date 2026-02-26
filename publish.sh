#!/bin/bash

# Publish script for busibox-frontend monorepo
# Creates a GitHub release with a tag and auto-generated changelog.
#
# Execution context: Run from repo root (admin workstation)
# Requirements:
#   - gh CLI installed and authenticated
#   - jq installed
#   - On the main branch with a clean working tree
#
# Usage:
#   bash publish.sh              # auto-bump patch
#   bash publish.sh patch        # explicit patch bump (0.1.0 -> 0.1.1)
#   bash publish.sh minor        # minor bump (0.1.0 -> 0.2.0)
#   bash publish.sh major        # major bump (0.1.0 -> 1.0.0)
#   bash publish.sh 2.5.0        # explicit version

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

TAG_PREFIX="release/v"

handle_error() {
    local line=$1
    local command=$2
    echo ""
    echo -e "${RED}Error at line $line: $command${NC}"
    exit 1
}
trap 'handle_error $LINENO "$BASH_COMMAND"' ERR

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

require_cmd() {
    if ! command -v "$1" &>/dev/null; then
        echo -e "${RED}$1 is required but not installed.${NC}"
        echo "  Install: $2"
        exit 1
    fi
}

bump_version() {
    local cur=$1 part=$2
    IFS='.' read -r major minor patch <<< "$cur"
    case "$part" in
        major) echo "$((major + 1)).0.0" ;;
        minor) echo "${major}.$((minor + 1)).0" ;;
        patch) echo "${major}.${minor}.$((patch + 1))" ;;
        *)     echo "$part" ;;  # treat as explicit version
    esac
}

# Categorise a one-line commit message into a section
categorise() {
    local msg="$1"
    case "$msg" in
        feat:*|feat\(*) echo "Features" ;;
        fix:*|fix\(*)   echo "Bug Fixes" ;;
        perf:*|perf\(*) echo "Performance" ;;
        docs:*|docs\(*) echo "Documentation" ;;
        refactor:*|refactor\(*|Refactor*) echo "Refactoring" ;;
        chore:*|chore\(*) echo "Chores" ;;
        test:*|test\(*) echo "Tests" ;;
        *) echo "Other" ;;
    esac
}

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------

echo -e "${GREEN}=== busibox-frontend release ===${NC}"
echo ""

require_cmd gh  "brew install gh"
require_cmd jq  "brew install jq"
require_cmd git "https://git-scm.com/downloads"

# Must be on main
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
    echo -e "${RED}You must be on the main branch (currently on '$BRANCH').${NC}"
    exit 1
fi

# Working tree must be clean
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}Working tree is not clean. Commit or stash changes first.${NC}"
    git status --short
    exit 1
fi

# Ensure we're up to date
echo -e "${YELLOW}Fetching latest from origin...${NC}"
git fetch origin --tags --quiet
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main 2>/dev/null || echo "")
if [ -n "$REMOTE" ] && [ "$LOCAL" != "$REMOTE" ]; then
    echo -e "${RED}Local main differs from origin/main. Pull or push first.${NC}"
    exit 1
fi
echo -e "${GREEN}OK${NC}"
echo ""

# gh auth check
if ! gh auth status &>/dev/null; then
    echo -e "${RED}gh CLI is not authenticated. Run: gh auth login${NC}"
    exit 1
fi

# ---------------------------------------------------------------------------
# Resolve version
# ---------------------------------------------------------------------------

CURRENT_VERSION=$(node -p "require('./package.json').version")
BUMP_ARG="${1:-patch}"
NEW_VERSION=$(bump_version "$CURRENT_VERSION" "$BUMP_ARG")

# Validate version format
if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}Invalid version: $NEW_VERSION${NC}"
    echo "Usage: bash publish.sh [patch|minor|major|X.Y.Z]"
    exit 1
fi

TAG_NAME="${TAG_PREFIX}${NEW_VERSION}"

# Check tag doesn't already exist
if git rev-parse "$TAG_NAME" &>/dev/null; then
    echo -e "${RED}Tag $TAG_NAME already exists!${NC}"
    exit 1
fi

echo -e "${CYAN}Current version : ${CURRENT_VERSION}${NC}"
echo -e "${CYAN}New version     : ${NEW_VERSION}${NC}"
echo -e "${CYAN}Tag             : ${TAG_NAME}${NC}"
echo ""

# ---------------------------------------------------------------------------
# Build changelog
# ---------------------------------------------------------------------------

echo -e "${YELLOW}Generating changelog...${NC}"

# Find previous release tag
PREV_TAG=$(git tag --list "${TAG_PREFIX}*" --sort=-version:refname | head -n1 || echo "")
if [ -z "$PREV_TAG" ]; then
    # No previous release tag — use all commits
    RANGE="HEAD"
    COMPARE_NOTE="(initial release)"
else
    RANGE="${PREV_TAG}..HEAD"
    COMPARE_NOTE="since ${PREV_TAG}"
fi

COMMIT_COUNT=$(git rev-list --count $RANGE 2>/dev/null || echo "0")
echo "  $COMMIT_COUNT commits $COMPARE_NOTE"
echo ""

# Build grouped changelog
declare -A SECTIONS
while IFS= read -r line; do
    [ -z "$line" ] && continue
    HASH="${line%% *}"
    MSG="${line#* }"
    SEC=$(categorise "$MSG")
    SECTIONS["$SEC"]+="- ${MSG} (\`${HASH}\`)"$'\n'
done < <(git log --oneline $RANGE -- 2>/dev/null || true)

CHANGELOG=""
for SEC in "Features" "Bug Fixes" "Performance" "Refactoring" "Documentation" "Tests" "Chores" "Other"; do
    if [ -n "${SECTIONS[$SEC]:-}" ]; then
        CHANGELOG+="### ${SEC}"$'\n'$'\n'
        CHANGELOG+="${SECTIONS[$SEC]}"$'\n'
    fi
done

if [ -z "$CHANGELOG" ]; then
    CHANGELOG="No notable changes."
fi

RELEASE_BODY="## What's Changed${COMPARE_NOTE:+ (${COMPARE_NOTE})}

${CHANGELOG}"

echo -e "${CYAN}--- Release notes preview ---${NC}"
echo "$RELEASE_BODY"
echo -e "${CYAN}----------------------------${NC}"
echo ""

# ---------------------------------------------------------------------------
# Confirm
# ---------------------------------------------------------------------------

read -p "Create release ${TAG_NAME}? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Aborted.${NC}"
    exit 0
fi

# ---------------------------------------------------------------------------
# Publish @jazzmind/busibox-app package
# ---------------------------------------------------------------------------

echo ""
echo -e "${YELLOW}Publishing @jazzmind/busibox-app to GitHub Packages...${NC}"

if [ -f "packages/app/publish.sh" ]; then
    (cd packages/app && bash publish.sh)
    echo -e "${GREEN}OK${NC}"

    # The busibox-app publish may have changed files — stage them
    if [ -n "$(git status --porcelain)" ]; then
        echo -e "${YELLOW}Staging busibox-app publish changes...${NC}"
        git add -A
        git commit -m "chore: publish @jazzmind/busibox-app"
        echo -e "${GREEN}OK${NC}"
    fi
else
    echo -e "${YELLOW}packages/app/publish.sh not found, skipping busibox-app publish${NC}"
fi
echo ""

# ---------------------------------------------------------------------------
# Bump version in package.json
# ---------------------------------------------------------------------------

echo ""
echo -e "${YELLOW}Bumping version in package.json...${NC}"

# Use node to update version cleanly (preserves formatting better than sed)
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '${NEW_VERSION}';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"
echo -e "${GREEN}OK${NC}"

# ---------------------------------------------------------------------------
# Commit, tag, push
# ---------------------------------------------------------------------------

echo -e "${YELLOW}Committing version bump...${NC}"
git add package.json
git commit -m "release: v${NEW_VERSION}"
echo -e "${GREEN}OK${NC}"

echo -e "${YELLOW}Creating tag ${TAG_NAME}...${NC}"
git tag -a "$TAG_NAME" -m "Release v${NEW_VERSION}"
echo -e "${GREEN}OK${NC}"

echo -e "${YELLOW}Pushing to origin...${NC}"
git push origin main --quiet
git push origin "$TAG_NAME" --quiet
echo -e "${GREEN}OK${NC}"
echo ""

# ---------------------------------------------------------------------------
# Create GitHub release
# ---------------------------------------------------------------------------

echo -e "${YELLOW}Creating GitHub release...${NC}"

gh release create "$TAG_NAME" \
    --title "v${NEW_VERSION}" \
    --notes "$RELEASE_BODY" \
    --target main

RELEASE_URL=$(gh release view "$TAG_NAME" --json url -q .url 2>/dev/null || echo "")

echo ""
echo -e "${GREEN}=== Release v${NEW_VERSION} published! ===${NC}"
if [ -n "$RELEASE_URL" ]; then
    echo -e "  ${CYAN}${RELEASE_URL}${NC}"
fi
echo ""

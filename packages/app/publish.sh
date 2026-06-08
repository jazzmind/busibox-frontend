#!/bin/bash

# Publish script for @jazzmind/busibox-app
# This script builds, versions, and publishes the package to npmjs.org
#
# Execution context: Run from packages/app directory (admin workstation or CI/CD)
# Requirements:
#   - pnpm installed
#   - NPM_TOKEN env var set, or logged in via `npm login`
#   - Publish access to @jazzmind scope on npmjs.org
#
# Usage:
#   bash publish.sh
#   or
#   chmod +x publish.sh && ./publish.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

handle_error() {
    local line=$1
    local command=$2
    echo ""
    echo -e "${RED}❌ Error occurred at line $line: $command${NC}"
    echo ""
    
    if [ -f "package.json.backup" ]; then
        echo -e "${YELLOW}Restoring dev package.json after error...${NC}"
        mv package.json.backup package.json
        echo -e "${GREEN}✓ Dev package.json restored${NC}"
    fi
    
    exit 1
}

trap 'handle_error $LINENO "$BASH_COMMAND"' ERR

echo -e "${GREEN}🚀 Starting publish process for @jazzmind/busibox-app${NC}"
echo ""

# Step 0: Switch to production package.json
echo -e "${YELLOW}Step 0/7: Switching to production package.json...${NC}"
if [ ! -f "package.json.prod" ]; then
    echo -e "${RED}package.json.prod not found!${NC}"
    echo "Fix: Ensure you're in the packages/app directory"
    exit 1
fi

if [ -f "package.json" ]; then
    cp package.json package.json.backup
    echo "  Backed up current package.json to package.json.backup"
fi

cp package.json.prod package.json
echo -e "${GREEN}✓ Switched to production package.json${NC}"
echo ""

# Step 1: Build the package
echo -e "${YELLOW}Step 1/7: Building package...${NC}"

if [ ! -d "node_modules" ] || [ ! -f "node_modules/.modules.yaml" ]; then
    echo "  Installing dependencies..."
    # CI=true prevents pnpm from aborting when it can't prompt (no TTY).
    if ! CI=true pnpm install; then
        echo -e "${RED}Failed to install dependencies!${NC}"
        exit 1
    fi
fi

if ! pnpm run build; then
    echo -e "${RED}Build failed!${NC}"
    echo "Fix: Check TypeScript errors and ensure all dependencies are installed"
    exit 1
fi
echo -e "${GREEN}✓ Build successful${NC}"
echo ""

# Step 2: Check npm authentication
echo -e "${YELLOW}Step 2/7: Checking npm authentication...${NC}"

if [ -n "${NPM_TOKEN:-}" ]; then
    npm config set "//registry.npmjs.org/:_authToken" "$NPM_TOKEN"
    echo -e "${GREEN}✓ NPM_TOKEN configured${NC}"
else
    # Check if already logged in
    if npm whoami --registry=https://registry.npmjs.org 2>/dev/null; then
        echo -e "${GREEN}✓ Already logged in to npmjs.org${NC}"
    else
        echo -e "${YELLOW}Not logged in to npmjs.org. Please log in:${NC}"
        npm login --registry=https://registry.npmjs.org
    fi
fi
echo ""

# Step 3: Fetch latest published version from npm
echo -e "${YELLOW}Step 3/7: Checking latest published version on npmjs.org...${NC}"
PACKAGE_NAME=$(jq -r '.name' package.json)

PACKAGE_EXISTS=false
LATEST_PUBLISHED_VERSION=""

# Temporarily disable ERR trap — npm view fails if package doesn't exist yet
trap - ERR
NPM_VIEW_OUTPUT=$(npm view "$PACKAGE_NAME" version --registry=https://registry.npmjs.org 2>/dev/null) || true
NPM_EXIT_CODE=$?
trap 'handle_error $LINENO "$BASH_COMMAND"' ERR

if [ $NPM_EXIT_CODE -eq 0 ] && [[ "$NPM_VIEW_OUTPUT" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    PACKAGE_EXISTS=true
    LATEST_PUBLISHED_VERSION="$NPM_VIEW_OUTPUT"
    echo -e "${GREEN}✓ Latest published version: ${LATEST_PUBLISHED_VERSION}${NC}"
else
    echo -e "${YELLOW}⚠ Package not found on npmjs.org (first publish?)${NC}"
fi
echo ""

# Step 4: Compute new version by incrementing patch of the PUBLISHED version.
# We always derive from the npm-published version so local package.json drift
# can never cause a "cannot publish over existing version" error.
echo -e "${YELLOW}Step 4/7: Computing and writing new version...${NC}"
if [ "$PACKAGE_EXISTS" = true ]; then
    # Parse major.minor.patch from the published version string
    IFS='.' read -r VER_MAJOR VER_MINOR VER_PATCH <<< "$LATEST_PUBLISHED_VERSION"
    VER_PATCH=$((VER_PATCH + 1))
    NEW_VERSION="${VER_MAJOR}.${VER_MINOR}.${VER_PATCH}"
    echo "  Published: ${LATEST_PUBLISHED_VERSION} → New: ${NEW_VERSION}"
else
    # First publish: use whatever is in package.json.prod
    NEW_VERSION=$(jq -r '.version' package.json)
    echo "  First publish, using version from package.json: ${NEW_VERSION}"
fi

# Write the new version directly into package.json (avoids pnpm workspace version issues)
sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"${NEW_VERSION}\"/" package.json
echo -e "${GREEN}✓ package.json updated to ${NEW_VERSION}${NC}"
echo ""

# Step 5: Publish
echo -e "${YELLOW}Step 5/7: Publishing to npmjs.org...${NC}"

if ! pnpm publish --no-git-checks --access public; then
    echo -e "${RED}Publish failed!${NC}"
    echo ""
    echo "Debugging steps:"
    echo "  1. Check authentication: npm whoami --registry=https://registry.npmjs.org"
    echo "  2. Ensure you have publish access to the @jazzmind scope"
    echo "  3. Try: NPM_TOKEN=<your-token> bash publish.sh"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Successfully published @jazzmind/busibox-app@$NEW_VERSION to npmjs.org!${NC}"
echo ""

# Step 6: Update package.json.prod and restore dev package.json
echo -e "${YELLOW}Step 6/7: Updating package.json.prod and restoring dev package.json...${NC}"

if [ "$PACKAGE_EXISTS" = true ]; then
    cp package.json package.json.prod
    echo "  Updated package.json.prod with new version $NEW_VERSION"
fi

if [ -f "package.json.backup" ]; then
    # Also bump the version in the dev package.json backup so next publish starts correctly
    sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"${NEW_VERSION}\"/" package.json.backup
    mv package.json.backup package.json
    echo -e "${GREEN}✓ Restored dev package.json (version updated to ${NEW_VERSION})${NC}"
else
    echo -e "${YELLOW}⚠ No backup found, keeping production package.json${NC}"
fi
echo ""

# Step 7: Git commit and tag (optional)
echo -e "${YELLOW}Step 7/7: Git commit and tag...${NC}"

if command -v git &> /dev/null && git rev-parse --git-dir > /dev/null 2>&1; then
    CHANGED_FILES=$(git status --porcelain 2>/dev/null || echo "")
    
    if [ -n "$CHANGED_FILES" ]; then
        echo "  Changed files detected:"
        echo "$CHANGED_FILES" | sed 's/^/    /'
        echo ""
        
        if [ "$(echo "$CHANGED_FILES" | wc -l | tr -d ' ')" -eq "1" ] && echo "$CHANGED_FILES" | grep -q "package.json.prod"; then
            echo -e "${GREEN}  ✓ Only package.json.prod changed (as expected)${NC}"
            echo ""
            
            read -p "  Auto-commit and tag this version? (y/N): " -n 1 -r
            echo ""
            
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                git add package.json.prod
                git commit -m "chore: bump version to $NEW_VERSION"
                echo -e "${GREEN}  ✓ Committed version bump${NC}"
                
                git tag "v$NEW_VERSION"
                echo -e "${GREEN}  ✓ Created tag v$NEW_VERSION${NC}"
                
                echo ""
                read -p "  Push commit and tag to remote? (y/N): " -n 1 -r
                echo ""
                
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    git push
                    git push --tags
                    echo -e "${GREEN}  ✓ Pushed to remote${NC}"
                else
                    echo -e "${YELLOW}  ⚠ Skipped push. Run manually:${NC}"
                    echo "     git push && git push --tags"
                fi
            else
                echo -e "${YELLOW}  ⚠ Skipped auto-commit${NC}"
                echo ""
                echo "  Manual steps:"
                echo "    git add package.json.prod"
                echo "    git commit -m 'chore: bump version to $NEW_VERSION'"
                echo "    git tag v$NEW_VERSION"
                echo "    git push && git push --tags"
            fi
        else
            echo -e "${YELLOW}  ⚠ Multiple files changed or unexpected changes detected${NC}"
            echo "  For safety, skipping auto-commit."
        fi
    else
        echo -e "${YELLOW}  ⚠ No changes detected${NC}"
    fi
else
    echo -e "${YELLOW}  ⚠ Git not available or not a git repository${NC}"
fi
echo ""

echo -e "${GREEN}🎉 Publish complete!${NC}"
echo ""
echo -e "${YELLOW}⚠ Important: Make sure package.json.prod is committed so the next publish uses the correct version!${NC}"

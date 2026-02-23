#!/bin/bash

# Publish script for @jazzmind/busibox-app
# This script builds, versions, and publishes the package to GitHub Packages
#
# Execution context: Run from project root (admin workstation or CI/CD)
# Requirements:
#   - pnpm installed
#   - gh CLI installed and authenticated
#   - Write access to GitHub Packages
#
# Usage:
#   bash publish.sh
#   or
#   chmod +x publish.sh && ./publish.sh

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Error handler
handle_error() {
    local line=$1
    local command=$2
    echo ""
    echo -e "${RED}❌ Error occurred at line $line: $command${NC}"
    echo ""
    
    # Restore dev package.json on error
    if [ -f "package.json.backup" ]; then
        echo -e "${YELLOW}Restoring dev package.json after error...${NC}"
        mv package.json.backup package.json
        echo -e "${GREEN}✓ Dev package.json restored${NC}"
    fi
    
    echo "Troubleshooting:"
    case "$command" in
        *"npm build"*)
            echo "  • Check TypeScript compilation errors: pnpm run build"
            echo "  • Verify tsconfig.json is configured correctly"
            echo "  • Ensure all dependencies are installed: pnpm install"
            ;;
        *"npm config delete"*)
            echo "  • This is usually non-fatal, continuing..."
            ;;
        *"gh auth login"*)
            echo "  • Complete the browser authentication flow"
            echo "  • Enter the code shown in the terminal"
            echo "  • Ensure you authorize the required scopes (read:packages, write:packages)"
            echo "  • Verify authentication: gh auth status"
            ;;
        *"gh auth token"*)
            echo "  • Verify gh CLI is installed: gh --version"
            echo "  • Check authentication status: gh auth status"
            echo "  • Re-authenticate if needed: gh auth login"
            ;;
        *"npm config set"*)
            echo "  • Verify the token was obtained successfully"
            echo "  • Check npm config: npm config list"
            ;;
        *"npm version patch"*)
            echo "  • Ensure working directory is clean: git status"
            echo "  • Check you have write access to the repository"
            echo "  • Verify package.json is valid: pnpm install"
            ;;
        *"npm publish"*)
            echo "  • Verify token has write:packages scope"
            echo "  • Check package name matches GitHub organization: @jazzmind/busibox-app"
            echo "  • Ensure version doesn't already exist on GitHub Packages"
            echo "  • Verify publishConfig.registry is set correctly in package.json"
            echo "  • Check npm config: npm config get registry"
            echo "  • If package doesn't exist, ensure you have admin/write access to the org"
            echo "  • First-time publish creates the package automatically"
            ;;
        *"gh api"*)
            echo "  • This is a verification step (non-fatal)"
            echo "  • Package will be created automatically on first publish"
            ;;
        *)
            echo "  • Review the error message above"
            echo "  • Check logs for more details"
            ;;
    esac
    exit 1
}

trap 'handle_error $LINENO "$BASH_COMMAND"' ERR

echo -e "${GREEN}🚀 Starting publish process for @jazzmind/busibox-app${NC}"
echo ""

# Step 0: Switch to production package.json
echo -e "${YELLOW}Step 0/8: Switching to production package.json...${NC}"
if [ ! -f "package.json.prod" ]; then
    echo -e "${RED}package.json.prod not found!${NC}"
    echo "Fix: Ensure you're in the busibox-app directory"
    exit 1
fi

# Backup current package.json (likely dev version)
if [ -f "package.json" ]; then
    cp package.json package.json.backup
    echo "  Backed up current package.json to package.json.backup"
fi

# Use production package.json for build and publish
cp package.json.prod package.json
echo -e "${GREEN}✓ Switched to production package.json${NC}"
echo ""

# Step 1: Build the package
echo -e "${YELLOW}Step 1/8: Building package...${NC}"

# First ensure dependencies are installed
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.modules.yaml" ]; then
    echo "  Installing dependencies..."
    if ! pnpm install; then
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

# Step 2: Clear existing GitHub token
echo -e "${YELLOW}Step 2/8: Clearing existing GitHub token...${NC}"
unset GITHUB_TOKEN || true
echo -e "${GREEN}✓ Existing token cleared${NC}"
echo ""

# Step 3: Get new GitHub token with package scopes
echo -e "${YELLOW}Step 3/8: Obtaining GitHub token with package scopes...${NC}"
if ! command -v gh &> /dev/null; then
    echo -e "${RED}gh CLI not found!${NC}"
    echo "Fix: Install GitHub CLI: brew install gh (macOS) or see https://cli.github.com/"
    exit 1
fi

# Check authentication status and required scopes
NEEDS_REAUTH=false
AUTH_STATUS=$(gh auth status 2>&1) || {
    echo -e "${YELLOW}Not authenticated with GitHub CLI. Starting authentication...${NC}"
    NEEDS_REAUTH=true
}

# Check if token has required scopes (if authenticated)
if [ "$NEEDS_REAUTH" = false ]; then
    HAS_WRITE_PACKAGES=false

    if echo "$AUTH_STATUS" | grep -q "write:packages"; then
        HAS_WRITE_PACKAGES=true
    fi
    
    if [ "$HAS_WRITE_PACKAGES" = false ]; then
        echo -e "${YELLOW}Token missing required scopes (write:packages). Re-authenticating...${NC}"
        NEEDS_REAUTH=true
    else
        echo -e "${GREEN}✓ Token already has required scopes${NC}"
    fi
fi

# Re-authenticate if needed
if [ "$NEEDS_REAUTH" = true ]; then
    echo ""
    echo -e "${YELLOW}Please complete authentication:${NC}"
    echo "  1. A browser window will open, or you'll see a URL"
    echo "  2. Authorize GitHub CLI"
    echo "  3. Enter the code shown in the terminal"
    echo ""
    
    if ! gh auth login --hostname github.com --scopes gist,read:org,repo,workflow,write:packages,read:packages; then
        echo -e "${RED}Authentication failed!${NC}"
        echo "Fix:"
        echo "  • Make sure you complete the browser authentication"
        echo "  • Enter the code correctly when prompted"
        echo "  • Ensure you have access to the GitHub organization"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Authentication successful${NC}"
fi

# Get token (without scopes flag to avoid forcing re-auth)
GITHUB_TOKEN=$(gh auth token) || {
    echo -e "${RED}Failed to obtain GitHub token!${NC}"
    echo "Fix:"
    echo "  • Re-authenticate: gh auth login"
    echo "  • Verify authentication: gh auth status"
    exit 1
}

if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}Token is empty!${NC}"
    echo "Fix: Re-authenticate with: gh auth login"
    exit 1
fi

echo -e "${GREEN}✓ GitHub token obtained${NC}"
echo ""

# Step 4: Set token in npm config
echo -e "${YELLOW}Step 4/8: Setting GitHub token in npm config...${NC}"
npm config set "//npm.pkg.github.com/:_authToken" "$GITHUB_TOKEN" || {
    echo -e "${RED}Failed to set npm config!${NC}"
    echo "Fix: Check npm is installed and accessible"
    exit 1
}
# Also export as environment variable (for .npmrc file that uses ${GITHUB_TOKEN})
export GITHUB_TOKEN="$GITHUB_TOKEN"

# Verify token is set (can't read protected token, but can check it's configured)
TOKEN_PREFIX=$(echo "$GITHUB_TOKEN" | head -c 10)
echo -e "${GREEN}✓ Token configured (starts with: ${TOKEN_PREFIX}...)${NC}"
echo "  Note: Token is set in npm config and exported as GITHUB_TOKEN env var"
echo ""

# Step 5: Quick package check and get latest version
echo -e "${YELLOW}Step 5/8: Checking package status and latest version...${NC}"
PACKAGE_NAME=$(node -p "require('./package.json').name")
CURRENT_VERSION=$(node -p "require('./package.json').version")

# Extract org from package name (e.g., @jazzmind/busibox-app -> jazzmind)
if [[ "$PACKAGE_NAME" =~ @([^/]+)/(.+) ]]; then
    ORG_NAME="${BASH_REMATCH[1]}"
    PACKAGE_BASE="${BASH_REMATCH[2]}"
else
    echo -e "${RED}Invalid package name format! Expected @org/package${NC}"
    exit 1
fi

# Check if package exists and get latest version from GitHub Packages registry
PACKAGE_EXISTS=false
LATEST_PUBLISHED_VERSION=""
set +e

# Query GitHub Packages registry for latest version
# Need to use the token we just configured
NPM_VIEW_OUTPUT=$(npm view "$PACKAGE_NAME" version --registry=https://npm.pkg.github.com 2>&1)
NPM_EXIT_CODE=$?

if [ $NPM_EXIT_CODE -eq 0 ] && [[ "$NPM_VIEW_OUTPUT" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    PACKAGE_EXISTS=true
    LATEST_PUBLISHED_VERSION="$NPM_VIEW_OUTPUT"
fi
set -e

if [ "$PACKAGE_EXISTS" = true ]; then
    echo -e "${GREEN}✓ Package exists${NC}"
    if [ -n "$LATEST_PUBLISHED_VERSION" ]; then
        echo "  Latest published version: ${LATEST_PUBLISHED_VERSION}"
        echo "  Version in package.json: ${CURRENT_VERSION}"
        
        # Compare versions to see if we need to update package.json first
        if [ "$CURRENT_VERSION" != "$LATEST_PUBLISHED_VERSION" ]; then
            echo -e "${YELLOW}  ⚠ Version mismatch detected!${NC}"
            echo "  Updating package.json to match latest published version..."
            
            # Update package.json to latest published version before bumping
            pnpm version "$LATEST_PUBLISHED_VERSION" --no-git-tag-version --allow-same-version
            CURRENT_VERSION="$LATEST_PUBLISHED_VERSION"
            echo -e "${GREEN}  ✓ Updated to ${LATEST_PUBLISHED_VERSION}${NC}"
        else
            echo -e "${GREEN}  ✓ Version matches latest published${NC}"
        fi
    fi
else
    echo -e "${YELLOW}⚠ Package not found in registry${NC}"
    echo "  This could mean:"
    echo "    - First publish (package will be created)"
    echo "    - Token doesn't have read:packages permission"
    echo "    - Package exists but registry query failed"
    echo ""
    echo "  Continuing with version from package.json: ${CURRENT_VERSION}"
fi
echo ""

# Step 6: Auto-bump version if package exists
# Note: We always bump when package exists to avoid version conflicts
# If you want to publish the same version, manually revert the bump after
if [ "$PACKAGE_EXISTS" = true ]; then
    echo -e "${YELLOW}Step 6/8: Bumping version (patch)...${NC}"
    if ! pnpm version patch --no-git-tag-version; then
        echo -e "${RED}Version bump failed!${NC}"
        echo "Fix:"
        echo "  • Ensure working directory is clean or commit changes first"
        echo "  • Check package.json is valid JSON"
        echo "  • Verify you have write permissions"
        exit 1
    fi
    NEW_VERSION=$(node -p "require('./package.json').version")
    echo -e "${GREEN}✓ Version bumped to $NEW_VERSION${NC}"
else
    echo -e "${YELLOW}Step 6/8: Skipping version bump (first publish)${NC}"
    NEW_VERSION=$(node -p "require('./package.json').version")
    echo -e "${GREEN}✓ Using version $NEW_VERSION${NC}"
fi
echo ""

# Step 7: Publish
echo -e "${YELLOW}Step 7/8: Publishing to GitHub Packages...${NC}"

# Verify token works by testing API access
echo "  Verifying token access..."
if ! gh api "/user" &>/dev/null; then
    echo -e "${RED}Token verification failed!${NC}"
    echo "Fix:"
    echo "  • Re-authenticate: gh auth login"
    echo "  • Verify token: gh auth status"
    exit 1
fi

# Attempt publish
if ! pnpm publish --no-git-checks; then
    echo -e "${RED}Publish failed!${NC}"
    echo ""
    echo "Debugging steps:"
    echo ""
    echo "1. Verify token is set correctly:"
    echo "   npm config list | grep pkg.github.com"
    echo "   echo \$GITHUB_TOKEN | head -c 20"
    echo ""
    echo "2. Test token with GitHub API:"
    echo "   gh api /user"
    echo "   gh api /orgs/${ORG_NAME}/packages/npm/${PACKAGE_BASE}"
    echo ""
    echo "3. Verify package permissions:"
    echo "   gh api /orgs/${ORG_NAME}/packages/npm/${PACKAGE_BASE} || echo 'Package does not exist (will be created)'"
    echo ""
    echo "4. Manual publish test:"
    echo "   export GITHUB_TOKEN=\$(gh auth token)"
    echo "   pnpm publish --dry-run"
    echo ""
    echo "5. If package doesn't exist, ensure you have:"
    echo "   - write:packages scope in your token"
    echo "   - Admin or write access to the ${ORG_NAME} organization"
    echo "   - Package creation enabled in org settings"
    echo ""
    echo "6. Check organization package settings:"
    echo "   Visit: https://github.com/organizations/${ORG_NAME}/settings/packages"
    echo ""
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Successfully published @jazzmind/busibox-app@$NEW_VERSION to GitHub Packages!${NC}"
echo ""

# Step 8: Update package.json.prod and restore dev package.json
echo -e "${YELLOW}Step 8/8: Updating package.json.prod and restoring dev package.json...${NC}"

# Save the new version to package.json.prod (the bumped version)
if [ "$PACKAGE_EXISTS" = true ]; then
    cp package.json package.json.prod
    echo "  Updated package.json.prod with new version $NEW_VERSION"
fi

# Restore dev package.json
if [ -f "package.json.backup" ]; then
    mv package.json.backup package.json
    echo -e "${GREEN}✓ Restored dev package.json${NC}"
else
    echo -e "${YELLOW}⚠ No backup found, keeping production package.json${NC}"
fi
echo ""

# Step 9: Auto-commit and tag (optional)
echo -e "${YELLOW}Step 9/9: Git commit and tag...${NC}"

# Check if git is available and we're in a git repo
if command -v git &> /dev/null && git rev-parse --git-dir > /dev/null 2>&1; then
    # Check what files changed
    CHANGED_FILES=$(git status --porcelain 2>/dev/null || echo "")
    
    if [ -n "$CHANGED_FILES" ]; then
        echo "  Changed files detected:"
        echo "$CHANGED_FILES" | sed 's/^/    /'
        echo ""
        
        # Check if only package.json.prod changed (expected)
        if [ "$(echo "$CHANGED_FILES" | wc -l | tr -d ' ')" -eq "1" ] && echo "$CHANGED_FILES" | grep -q "package.json.prod"; then
            echo -e "${GREEN}  ✓ Only package.json.prod changed (as expected)${NC}"
            echo ""
            
            # Ask user if they want to auto-commit
            read -p "  Auto-commit and tag this version? (y/N): " -n 1 -r
            echo ""
            
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                # Commit the version bump
                git add package.json.prod
                git commit -m "chore: bump version to $NEW_VERSION"
                echo -e "${GREEN}  ✓ Committed version bump${NC}"
                
                # Create tag
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
            echo ""
            echo "  Manual steps:"
            echo "    git add package.json.prod"
            echo "    git commit -m 'chore: bump version to $NEW_VERSION'"
            echo "    git tag v$NEW_VERSION"
            echo "    git push && git push --tags"
        fi
    else
        echo -e "${YELLOW}  ⚠ No changes detected${NC}"
    fi
else
    echo -e "${YELLOW}  ⚠ Git not available or not a git repository${NC}"
    echo ""
    echo "  Manual steps:"
    echo "    git add package.json.prod"
    echo "    git commit -m 'chore: bump version to $NEW_VERSION'"
    echo "    git tag v$NEW_VERSION"
    echo "    git push && git push --tags"
fi
echo ""

echo -e "${GREEN}🎉 Publish complete!${NC}"
echo ""
echo -e "${YELLOW}⚠ Important: Make sure package.json.prod is committed so the next publish uses the correct version!${NC}"


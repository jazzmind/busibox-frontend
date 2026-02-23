# AI Portal Setup Fix Summary

## Issues Fixed

### 1. Left Sidebar Showing During Setup
**Problem**: The setup page was located at `src/app/(authenticated)/admin/setup/page.tsx`, which inherited the admin layout with the left sidebar navigation.

**Solution**: Moved the setup page to `src/app/(authenticated)/setup/page.tsx`. This keeps it in the authenticated route group (clearly indicating auth is required) but outside the `admin/` folder, so it doesn't inherit the admin layout with the sidebar.

**Admin-Only Protection**: Added two layers of security:
1. **Server-side Layout Guard**: Created `src/app/(authenticated)/setup/layout.tsx` that checks for Admin role server-side and redirects non-admins
2. **Client-side Verification**: The setup page component checks session and admin role on load

**Files Changed**:
- Created: `src/app/(authenticated)/setup/layout.tsx` (NEW - server-side admin guard)
- Location: `src/app/(authenticated)/setup/page.tsx` (already exists at correct location)
- Deleted: `src/app/admin/` (old incorrect location)

### 2. Setup Not Marked Complete Properly
**Problem**: After completing portal customization, users were redirected back to setup because:
- The proxy checked `state.phase === 'complete'` to determine if setup was done
- The setup complete API only set `SETUP_COMPLETE: 'true'` flag
- These two checks were inconsistent

**Solution**: Made setup completion checks consistent across all files:
- Setup complete API now sets **both** `SETUP_COMPLETE: 'true'` AND `phase: 'complete'`
- All setup check logic now accepts either condition as valid
- Added a root-level `middleware.ts` to properly export the proxy function
- Updated proxy to redirect to `/setup` (not `/admin/setup`)

**Files Changed**:
1. **`src/proxy.ts`**: Updated to check both `SETUP_COMPLETE === 'true'` OR `phase === 'complete'`, redirects to `/setup`
2. **`src/app/api/admin/setup/complete/route.ts`**: Now sets both `SETUP_COMPLETE: 'true'` and `phase: 'complete'`
3. **`src/app/api/admin/setup/status/route.ts`**: Checks both flags for setup completion
4. **`src/app/api/admin/deploy/status/route.ts`**: Checks both flags for setup completion

**Note**: Next.js 16+ uses `src/proxy.ts` directly, NOT `middleware.ts` at the root.

## Changes Summary

### New Files
- `src/app/(authenticated)/setup/layout.tsx` - Server-side admin-only guard for setup pages

### Deleted Files
- `src/app/admin/` - Old incorrect setup location (entire folder removed)

### Modified Files
- `src/proxy.ts` - Updated setup check logic, redirects to `/setup`
- `src/app/(authenticated)/setup/page.tsx` - Already at correct location
- `src/app/api/admin/setup/complete/route.ts` - Sets both completion flags
- `src/app/api/admin/setup/status/route.ts` - Checks both completion flags
- `src/app/api/admin/deploy/status/route.ts` - Checks both completion flags

## Testing Checklist

- [ ] Setup page loads without left sidebar
- [ ] Non-admin users are redirected away from `/setup` (server-side)
- [ ] Admin users without valid session are redirected to login
- [ ] Only authenticated admin users can access `/setup`
- [ ] After completing portal customization, user is redirected to `/admin`
- [ ] After setup is complete, admin users can access all admin pages without redirect to setup
- [ ] Non-admin users are not affected by setup redirect logic
- [ ] Setup status API returns correct `setupComplete` value

## How to Test

1. **Test Admin-Only Access**:
   ```bash
   # Try to access /setup as non-admin user
   # Should redirect to /home
   
   # Try to access /setup without being logged in
   # Should redirect to /login
   
   # Access /setup as admin user
   # Should load setup page successfully
   ```

2. **Test Setup Flow**:
   ```bash
   # Reset setup state (if you have access to deploy-api)
   # Set SETUP_COMPLETE=false and phase=initial
   
   # Navigate to AI Portal as admin
   # Should automatically redirect to /setup
   # Verify no left sidebar is visible during setup
   ```

3. **Complete Setup**:
   ```bash
   # Complete all setup steps
   # Verify redirect to /admin after customization
   # Verify no more redirects to /setup
   ```

4. **Verify APIs**:
   ```bash
   # Check setup status
   curl http://localhost:3000/api/admin/setup/status
   # Should return: {"success":true,"data":{"setupComplete":true,...}}
   
   # Check deploy status
   curl http://localhost:3000/api/admin/deploy/status
   # installState.setupComplete should be true
   ```

## Notes

- **Next.js 16+ uses `src/proxy.ts` directly** - no `middleware.ts` file needed
- Setup completion is now dual-checked for backward compatibility
- The setup page is at `/setup` within the `(authenticated)` route group
- Admin-only access enforced via server-side layout guard (redirects non-admins)
- Client-side verification provides additional UX feedback
- Admin layout is only applied to pages in `(authenticated)/admin/`
- Setup page does NOT inherit admin layout (no sidebar)

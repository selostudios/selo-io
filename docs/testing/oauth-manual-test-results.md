# OAuth Manual Testing Results

Date: [To be completed by user]
Tester: [To be completed by user]
Status: PENDING MANUAL TESTING

## Overview

This document tracks manual testing of the LinkedIn OAuth 2.0 implementation. The user needs to complete these tests before the implementation can be considered fully verified.

## Prerequisites

Before testing, ensure:
- [ ] Development server is running (`npm run dev`)
- [ ] `.env.local` has LinkedIn OAuth credentials:
  ```bash
  LINKEDIN_CLIENT_ID=your_actual_client_id
  LINKEDIN_CLIENT_SECRET=your_actual_client_secret
  ```
- [ ] LinkedIn App is configured with redirect URL: `http://localhost:3000/api/auth/oauth/linkedin/callback`
- [ ] Required scopes are enabled: `r_organization_social`, `rw_organization_admin`

## Test Cases

### 1. OAuth Initiation
- [ ] Visit `http://localhost:3000/settings/integrations`
- [ ] Click "Connect" on LinkedIn card
- [ ] Expected: Redirects to `/api/auth/oauth/linkedin`
- [ ] Expected: State cookie is set (check DevTools → Application → Cookies)
- [ ] Expected: Platform cookie is set
- [ ] Expected: Redirects to LinkedIn authorization page

**Notes:**
_[User to document actual behavior]_

---

### 2. OAuth Authorization
- [ ] LinkedIn authorization page displays correctly
- [ ] App name and requested permissions are shown
- [ ] Click "Allow" to approve
- [ ] Expected: Redirects to `http://localhost:3000/api/auth/oauth/linkedin/callback?code=...&state=...`

**Notes:**
_[User to document actual behavior]_

---

### 3. OAuth Callback Success
- [ ] Callback processes successfully
- [ ] Expected: Redirects to `/settings/integrations?success=connected&platform=linkedin`
- [ ] Expected: Success toast appears: "LinkedIn connected successfully"
- [ ] Expected: Toast auto-dismisses after 5 seconds
- [ ] Expected: URL is cleaned (query params removed)
- [ ] Expected: Connection card now shows "active" status

**Notes:**
_[User to document actual behavior]_

---

### 4. Database Verification
- [ ] Check database for saved connection:
  ```sql
  SELECT * FROM platform_connections WHERE platform_type = 'linkedin';
  ```
- [ ] Expected fields:
  - `credentials.access_token`: Present and non-empty
  - `credentials.refresh_token`: Present and non-empty
  - `credentials.expires_at`: ISO 8601 timestamp (future date)
  - `credentials.organization_id`: LinkedIn organization ID
  - `credentials.organization_name`: Organization name
  - `credentials.scopes`: Array of granted scopes
  - `status`: 'active'

**Notes:**
_[User to document actual values - redact sensitive tokens]_

---

### 5. Error Handling - User Cancellation
- [ ] Clear any existing LinkedIn connections
- [ ] Click "Connect" on LinkedIn card
- [ ] On LinkedIn authorization page, click "Cancel" or "Deny"
- [ ] Expected: Redirects back to `/settings/integrations?error=...`
- [ ] Expected: Error toast appears with message about user cancellation
- [ ] Expected: Toast does NOT auto-dismiss (must click close button)
- [ ] Expected: No connection saved in database

**Notes:**
_[User to document actual behavior]_

---

### 6. Error Handling - CSRF Attack Simulation
- [ ] Click "Connect" on LinkedIn card
- [ ] On LinkedIn auth page, DON'T approve yet
- [ ] In DevTools, delete the `oauth_state` cookie
- [ ] Click "Allow" on LinkedIn
- [ ] Expected: Error toast about invalid state/CSRF attempt
- [ ] Expected: Error logged in console: "Invalid state token"
- [ ] Expected: No connection saved in database

**Notes:**
_[User to document actual behavior]_

---

### 7. Error Handling - Duplicate Connection
- [ ] Ensure you already have an active LinkedIn connection
- [ ] Click "Connect" on LinkedIn card again
- [ ] Approve on LinkedIn
- [ ] Expected: Error toast: "This LinkedIn organization is already connected"
- [ ] Expected: No duplicate connection in database

**Notes:**
_[User to document actual behavior]_

---

### 8. Error Handling - No Organizations
- [ ] Note: This test requires a LinkedIn account with NO organization pages
- [ ] Click "Connect" on LinkedIn card
- [ ] Approve on LinkedIn
- [ ] Expected: Error toast: "No LinkedIn organizations found. Please ensure your account has access to at least one organization page."
- [ ] Expected: No connection saved in database
- [ ] Check server logs for error: `no_organizations`

**Notes:**
_[User to document actual behavior - This test may be difficult to perform without a test LinkedIn account that has no organization access]_

---

### 9. Token Refresh - Proactive Refresh
- [ ] After successful connection, manually update the database to simulate near-expiration:
  ```sql
  UPDATE platform_connections
  SET credentials = jsonb_set(
    credentials,
    '{expires_at}',
    to_jsonb((NOW() + INTERVAL '6 days')::timestamp::text)
  )
  WHERE platform_type = 'linkedin';
  ```
- [ ] Trigger a manual sync (if sync functionality exists)
- [ ] Check server logs for token refresh
- [ ] Expected: Token refresh triggered (less than 7 days until expiration)
- [ ] Expected: New access token saved to database
- [ ] Expected: New expires_at timestamp (60 days in future)

**Notes:**
_[User to document actual behavior]_

---

### 10. Token Refresh - Expired Token
- [ ] Manually update database to set expired token:
  ```sql
  UPDATE platform_connections
  SET credentials = jsonb_set(
    credentials,
    '{expires_at}',
    to_jsonb((NOW() - INTERVAL '1 day')::timestamp::text)
  )
  WHERE platform_type = 'linkedin';
  ```
- [ ] Trigger a manual sync
- [ ] Expected: Token refresh triggered
- [ ] Expected: New tokens saved
- [ ] Expected: Sync completes successfully

**Notes:**
_[User to document actual behavior]_

---

## Development Mode Error Display

Test that error details are shown in development:
- [ ] Set `NODE_ENV=development`
- [ ] Trigger an error (e.g., user cancellation)
- [ ] Expected: Error toast shows detailed error message
- [ ] Expected: DevTools console shows full error with structured logging

**Notes:**
_[User to document actual behavior]_

---

## Routes Verification

Verify routes are accessible:
- [ ] `/api/auth/oauth/linkedin` - Returns 405 if accessed directly (method not allowed)
- [ ] `/api/auth/oauth/linkedin/callback` - Returns error if accessed without code param

**Notes:**
_[User to document actual responses]_

---

## Summary

**Total Test Cases:** 12
**Passed:** _[User to fill in]_
**Failed:** _[User to fill in]_
**Not Tested:** _[User to fill in]_

**Overall Status:** PENDING

**Issues Found:**
_[User to document any bugs or unexpected behavior]_

**Recommendations:**
_[User to document any suggestions for improvements]_

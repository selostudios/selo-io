This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Testing

This project includes comprehensive testing infrastructure with unit tests, integration tests, and E2E tests.

### Running Tests

```bash
# Run all tests (unit, integration, and E2E)
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run only E2E tests
npm run test:e2e

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Seed test data for E2E tests
npm run test:seed
```

### Test Structure

- `tests/unit/` - Unit tests for components and utilities
- `tests/integration/` - Integration tests for server actions and RLS policies
- `tests/e2e/` - End-to-end tests for critical user journeys
- `tests/helpers/` - Test utilities and database helpers
- `tests/fixtures/` - Reusable test data

For more details, see [docs/testing.md](docs/testing.md).

## LinkedIn OAuth Setup

### Development

1. Create LinkedIn App at https://www.linkedin.com/developers/apps
2. Add redirect URL: `http://localhost:3000/api/auth/oauth/linkedin/callback`
3. Request scopes:
   - `r_organization_social`
   - `r_organization_admin`
   - `rw_organization_admin`
4. Add credentials to `.env.local`:
   ```
   LINKEDIN_CLIENT_ID=your_client_id
   LINKEDIN_CLIENT_SECRET=your_client_secret
   ```

### Production

1. Add production redirect URL: `https://selo-io.vercel.app/api/auth/oauth/linkedin/callback`
2. Add credentials to Vercel environment variables
3. Verify `NEXT_PUBLIC_SITE_URL` is set correctly

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

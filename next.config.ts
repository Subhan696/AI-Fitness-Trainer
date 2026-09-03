import type { NextConfig } from "next";

function getClerkFrontendApi(): string {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  if (!publishableKey) return "firm-slug-85.clerk.accounts.dev";

  try {
    const rawKey = publishableKey.replace(/^pk_(test|live)_/, "");
    const decoded = Buffer.from(rawKey, "base64").toString("utf-8");
    return decoded.replace(/\$$/, "");
  } catch {
    return "firm-slug-85.clerk.accounts.dev";
  }
}

const nextConfig: NextConfig = {
  async rewrites() {
    const clerkFrontendApi = getClerkFrontendApi();
    return [
      {
        source: "/__clerk/:path*",
        destination: `https://${clerkFrontendApi}/:path*`,
      },
    ];
  },
};

export default nextConfig;

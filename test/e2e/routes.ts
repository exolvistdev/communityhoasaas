// Route inventories for the crawl specs — kept in one file so they're easy to
// update as pages are added. Source: components/Sidebar.tsx, PortalTabBar.tsx
// + app/portal/page.tsx tile links, middleware.ts PROTECTED, and a directory
// listing of app/(admin)/**/page.tsx, app/reports/**/page.tsx, app/portal/**,
// app/guard, app/platform/(console) (2026-09-13).

export const ADMIN_ROUTES = [
  "/dashboard",
  "/properties",
  "/billing",
  "/reconciliation",
  "/water",
  "/bills",
  "/vendors",
  "/ledger",
  "/gate-passes",
  "/announcements",
  "/meetings",
  "/votes",
  "/elections",
  "/board",
  "/maintenance",
  "/violations",
  "/amenities",
  "/marketplace",
  "/documents",
  "/team",
  "/audit",
  "/data-requests",
  "/settings",
  "/account",
  "/notifications",
];

export const REPORT_ROUTES = [
  "/reports",
  "/reports/income-statement",
  "/reports/balance-sheet",
  "/reports/aging",
  "/reports/payables",
  "/reports/collections",
  "/reports/late-fees",
  "/reports/vendor-spend",
  "/reports/violations",
  "/reports/homeowners",
  "/reports/water",
  "/reports/board-pack",
];

export const PORTAL_ROUTES = [
  "/portal",
  "/portal/pay",
  "/portal/amenities",
  "/portal/maintenance",
  "/portal/market",
  "/portal/messages",
  "/portal/announcements",
  "/portal/documents",
  "/portal/gate-pass",
  "/portal/board",
  "/portal/elections",
  "/portal/votes",
  "/portal/violations",
  "/portal/meetings",
  "/portal/water",
  "/account",
  "/notifications",
];

export const GUARD_ROUTES = ["/guard"];

export const PLATFORM_ROUTES = ["/platform"];

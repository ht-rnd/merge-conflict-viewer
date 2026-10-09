import type { JsonObject } from "../../../src/lib/types"

export interface Example {
  label: string
  /** One line shown under the example picker: what to look at. */
  description: string
  current: JsonObject
  incoming: JsonObject
}

const userProfile: Example = {
  label: "User Profile",
  description:
    "Values edited, keys added and removed, a nested object changed and a small array extended.",
  current: {
    id: "usr_001",
    name: "Alice Martin",
    email: "alice@example.com",
    age: 28,
    role: "engineer",
    phone: "+1 555 0100",
    address: {
      street: "1 Main St",
      city: "New York",
      zip: "10001",
    },
    preferences: {
      theme: "light",
      newsletter: true,
    },
    languages: ["en", "fr"],
  },
  incoming: {
    id: "usr_001",
    name: "Alice M. Martin",
    email: "alice.martin@example.com",
    age: 29,
    role: "senior engineer",
    address: {
      street: "1 Main St",
      city: "San Francisco",
      zip: "94105",
      country: "US",
    },
    preferences: {
      theme: "dark",
      newsletter: true,
    },
    languages: ["en", "fr", "de"],
    timezone: "America/Los_Angeles",
  },
}

const productCatalog: Example = {
  label: "Product Catalog",
  description:
    "Arrays of values and of objects matched by id: items inserted, reordered, edited in place, removed and added, plus whole arrays and objects appearing or disappearing.",
  current: {
    id: "prd-1234",
    name: "Wireless Headphones",
    price: 79.99,
    tags: ["audio", "wireless", "bluetooth"],
    colors: ["black", "white"],
    categories: ["electronics", "audio", "gifts"],
    variants: [
      { id: "v1", color: "black", price: 79.99, stock: 120 },
      { id: "v2", color: "white", price: 79.99, stock: 0 },
      { id: "v3", color: "red", price: 84.99, stock: 15 },
    ],
    dimensions: { widthMm: 180, heightMm: 200 },
    discontinuedSizes: ["XXL"],
  },
  incoming: {
    id: "prd-1234",
    name: "Wireless Noise-Cancelling Headphones",
    price: 99.99,
    tags: ["audio", "wireless", "noise-cancelling", "bluetooth"],
    colors: ["white", "black"],
    categories: ["electronics", "gifts", "audio"],
    variants: [
      { id: "v1", color: "black", price: 99.99, stock: 80 },
      { id: "v2", color: "white", price: 99.99, stock: 25 },
      { id: "v4", color: "blue", price: 99.99, stock: 40 },
    ],
    dimensions: { widthMm: 180, heightMm: 200, depthMm: 90 },
    bundles: ["BND-7"],
  },
}

const ciPipeline: Example = {
  label: "CI Pipeline",
  description:
    "Arrays of objects with no id: identical steps anchor the alignment, an inserted step is a clean addition, and edited steps are compared field by field.",
  current: {
    pipeline: "web-app",
    triggers: ["push", "pull_request"],
    steps: [
      { run: "npm ci" },
      { run: "npm run lint" },
      { run: "npm test", timeout: 300 },
      { run: "npm run build", env: ["CI=true"] },
      { run: "docker push registry/web-app", if: "branch == main" },
    ],
    notifications: ["slack", "email"],
  },
  incoming: {
    pipeline: "web-app",
    triggers: ["push", "pull_request", "schedule"],
    steps: [
      { run: "npm ci" },
      { run: "npm run lint" },
      { run: "npm run typecheck" },
      { run: "npm test", timeout: 300 },
      {
        run: "npm run build",
        env: ["CI=true", "NODE_ENV=production"],
        timeout: 900,
      },
    ],
    notifications: [],
  },
}

/**
 * Everything at once: scalar edits, keys added/removed (with object values),
 * a type change, arrays of primitives, arrays of objects matched by id/name,
 * arrays of objects without ids, nested arrays, and arrays inside objects
 * inside arrays.
 */
const deploymentManifest: Example = {
  label: "Deployment Manifest",
  description:
    "Real-world mix: scalar edits, keys added and removed, a type change, arrays matched by id and name, positional arrays, nested arrays and arrays inside objects inside arrays.",
  current: {
    name: "checkout-service",
    replicas: 3,
    owner: "platform-team",
    image: {
      repository: "registry.example.com/checkout",
      tag: "2.4.1",
      pullPolicy: "IfNotPresent",
    },
    labels: ["team:payments", "tier:backend", "legacy"],
    ports: [
      { name: "http", port: 8080, protocol: "TCP" },
      { name: "metrics", port: 9090, protocol: "TCP" },
      { name: "debug", port: 5005, protocol: "TCP" },
    ],
    containers: [
      {
        id: "app",
        image: "checkout:2.4.1",
        resources: { cpu: "500m", memory: "512Mi" },
        env: [
          { name: "LOG_LEVEL", value: "info" },
          { name: "FEATURE_X", value: "off" },
        ],
        probes: {
          liveness: { path: "/live", intervalSeconds: 10 },
        },
      },
      {
        id: "sidecar",
        image: "proxy:1.8",
        args: ["--mode=sidecar", "--verbose"],
      },
      {
        id: "migrator",
        image: "migrate:0.9",
        command: ["run", "--once"],
      },
    ],
    strategy: "RollingUpdate",
    rollout: [[10, 25], [50]],
    alerts: [
      { severity: "warn", channels: ["slack"] },
      { severity: "critical", channels: ["pager", "slack"] },
    ],
    schedule: { cron: "0 2 * * *", timezone: "UTC" },
    deprecatedFlags: ["useLegacyAuth", "skipTls"],
  },
  incoming: {
    name: "checkout-service",
    replicas: 5,
    team: "payments-squad",
    image: {
      repository: "registry.example.com/checkout",
      tag: "2.5.0",
      pullPolicy: "Always",
    },
    labels: ["team:payments", "tier:backend", "env:prod"],
    ports: [
      { name: "http", port: 8443, protocol: "TCP" },
      { name: "metrics", port: 9090, protocol: "TCP" },
      { name: "grpc", port: 50051, protocol: "TCP" },
    ],
    containers: [
      {
        id: "app",
        image: "checkout:2.5.0",
        resources: { cpu: "500m", memory: "1Gi" },
        env: [
          { name: "LOG_LEVEL", value: "debug" },
          { name: "OTEL_ENDPOINT", value: "http://otel:4317" },
        ],
        probes: {
          liveness: { path: "/live", intervalSeconds: 5 },
          readiness: { path: "/ready", intervalSeconds: 5 },
        },
      },
      {
        id: "sidecar",
        image: "proxy:1.8",
        args: ["--mode=sidecar"],
      },
      {
        id: "exporter",
        image: "exporter:3.1",
        ports: [{ name: "prom", port: 9102 }],
      },
    ],
    strategy: { type: "RollingUpdate", maxSurge: "25%", maxUnavailable: 0 },
    rollout: [[10, 25, 50], [100]],
    alerts: [
      { severity: "warn", channels: ["slack", "email"] },
      { severity: "critical", channels: ["pager"] },
    ],
    autoscaling: {
      min: 2,
      max: 10,
      metrics: [{ type: "cpu", target: 70 }],
    },
    deprecatedFlags: [],
  },
}

const configMigration: Example = {
  label: "Config Migration",
  description:
    "Awkward cases: keys with dots and slashes, strings turned into numbers, booleans and arrays, null becoming a value, an array becoming an object, empty containers filling up, and multi-line text.",
  current: {
    "app.kubernetes.io/name": "billing",
    "app.kubernetes.io/version": "1.4.0",
    port: "8080",
    debug: "false",
    retries: "3",
    timeoutMs: null,
    allowedOrigins: "https://a.example.com,https://b.example.com",
    database: {
      host: "db.internal",
      pool: {},
    },
    cache: [],
    limits: [100, 200],
    motd: "Welcome!\nMaintenance window: Sunday 02:00 UTC",
    greeting: "Grüße aus Zürich ☕",
    legacyMode: { enabled: true, sunset: "2026-12-31" },
  },
  incoming: {
    "app.kubernetes.io/name": "billing",
    "app.kubernetes.io/version": "1.5.0",
    port: 8080,
    debug: false,
    retries: 3,
    timeoutMs: 30000,
    allowedOrigins: ["https://a.example.com", "https://b.example.com"],
    database: {
      host: "db.internal",
      pool: { min: 2, max: 20 },
    },
    cache: { enabled: true, ttlSeconds: 60 },
    limits: { rps: 100, burst: 200 },
    motd: "Welcome!\nMaintenance window: Saturday 03:00 UTC\nExpect brief downtime.",
    greeting: "Grüße aus Zürich ☕",
  },
}

const longLines: Example = {
  label: "Long Lines",
  description:
    "Values far wider than a pane: URLs, a SQL query, a header and a token. Turn off Wrap lines to keep one row per line and scroll all three panes together.",
  current: {
    service: "reporting-api",
    baseUrl:
      "https://reporting.internal.example.com/api/v2/reports/quarterly?region=eu-central-1&format=json&include=totals,breakdown,forecast",
    query:
      "SELECT account_id, SUM(amount) AS total FROM invoices WHERE status = 'paid' AND issued_at >= '2026-01-01' GROUP BY account_id ORDER BY total DESC LIMIT 100",
    csp: "default-src 'self'; script-src 'self' https://cdn.example.com; img-src 'self' data: https://images.example.com; connect-src 'self' https://api.example.com",
    token:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    timeoutMs: 5000,
    owner: "platform-team",
  },
  incoming: {
    service: "reporting-api",
    baseUrl:
      "https://reporting.internal.example.com/api/v3/reports/quarterly?region=eu-west-1&format=json&include=totals,breakdown,forecast,variance",
    query:
      "SELECT account_id, SUM(amount) AS total FROM invoices WHERE status IN ('paid', 'refunded') AND issued_at >= '2026-04-01' GROUP BY account_id ORDER BY total DESC LIMIT 250",
    csp: "default-src 'self'; script-src 'self' https://cdn.example.com; img-src 'self' data: https://images.example.com; connect-src 'self' https://api.example.com https://telemetry.example.com",
    token:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkphbmUgRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.XbPfbIHMI6arZ3Y922BhjWgQzWXcXNrz0ogtVhfEd2o",
    timeoutMs: 10000,
    owner: "platform-team",
  },
}

export const examples: Record<string, Example> = {
  userProfile,
  productCatalog,
  ciPipeline,
  deploymentManifest,
  configMigration,
  longLines,
}

export const defaultExampleKey = "userProfile"

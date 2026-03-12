import { spec1, spec2 } from "@/lib/consts/specifications"
import type { JsonObject } from "@/lib/types"

export interface Example {
  label: string
  current: JsonObject
  incoming: JsonObject
}

const userProfile: Example = {
  label: "User Profile",
  current: {
    id: "usr_001",
    name: "Alice Martin",
    email: "alice@example.com",
    age: 28,
    city: "New York",
    role: "engineer",
    active: true,
  },
  incoming: {
    id: "usr_001",
    name: "Alice M. Martin",
    email: "alice.martin@example.com",
    age: 29,
    city: "San Francisco",
    role: "senior engineer",
    active: true,
  },
}

const product: Example = {
  label: "Product",
  current: {
    sku: "PRD-1234",
    name: "Wireless Headphones",
    price: 79.99,
    currency: "USD",
    category: "Electronics",
    inStock: true,
    tags: ["audio", "wireless"],
    rating: 4.2,
  },
  incoming: {
    sku: "PRD-1234",
    name: "Wireless Noise-Cancelling Headphones",
    price: 99.99,
    currency: "USD",
    category: "Audio",
    inStock: false,
    tags: ["audio", "wireless", "noise-cancelling"],
    rating: 4.6,
  },
}

const appConfig: Example = {
  label: "App Config",
  current: {
    environment: "staging",
    api: {
      baseUrl: "https://staging.api.example.com",
      timeout: 5000,
      retries: 2,
    },
    features: {
      darkMode: false,
      analytics: true,
      betaFeatures: false,
    },
    logLevel: "warn",
  },
  incoming: {
    environment: "production",
    api: {
      baseUrl: "https://api.example.com",
      timeout: 10000,
      retries: 3,
    },
    features: {
      darkMode: true,
      analytics: true,
      betaFeatures: false,
    },
    logLevel: "error",
  },
}

const serviceSpec: Example = {
  label: "Service Spec",
  current: spec1 as JsonObject,
  incoming: spec2 as JsonObject,
}

export const examples: Record<string, Example> = {
  userProfile,
  product,
  appConfig,
  serviceSpec,
}

export const defaultExampleKey = "userProfile"

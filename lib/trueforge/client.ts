import { TrueForge } from "@truefoundry/trueforge-sdk";

export function trueforge(): TrueForge {
  const token = process.env.TRUEFORGE_TOKEN;
  return new TrueForge({
    baseUrl: process.env.TRUEFORGE_BASE_URL ?? "http://localhost:8790",
    timeoutInSeconds: 600,
    ...(token ? { token } : {}),
  });
}

export function trueforgeBaseUrl(): string {
  return process.env.TRUEFORGE_BASE_URL ?? "http://localhost:8790";
}

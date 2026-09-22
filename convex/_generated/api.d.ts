/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as dailyMetrics from "../dailyMetrics.js";
import type * as healthExport from "../healthExport.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as logs from "../logs.js";
import type * as programs from "../programs.js";
import type * as seed from "../seed.js";
import type * as seedProgram from "../seedProgram.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  dailyMetrics: typeof dailyMetrics;
  healthExport: typeof healthExport;
  helpers: typeof helpers;
  http: typeof http;
  logs: typeof logs;
  programs: typeof programs;
  seed: typeof seed;
  seedProgram: typeof seedProgram;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

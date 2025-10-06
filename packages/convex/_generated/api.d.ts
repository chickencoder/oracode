/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as branches from "../branches.js";
import type * as github from "../github.js";
import type * as http from "../http.js";
import type * as messages from "../messages.js";
import type * as projects from "../projects.js";
import type * as sandboxes from "../sandboxes.js";
import type * as sessions from "../sessions.js";
import type * as types from "../types.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  branches: typeof branches;
  github: typeof github;
  http: typeof http;
  messages: typeof messages;
  projects: typeof projects;
  sandboxes: typeof sandboxes;
  sessions: typeof sessions;
  types: typeof types;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};

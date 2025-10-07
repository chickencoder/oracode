/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as github from "../github.js";
import type * as http from "../http.js";
import type * as messages from "../messages.js";
import type * as projects from "../projects.js";
import type * as sandboxes from "../sandboxes.js";
import type * as sessions from "../sessions.js";
import type * as types from "../types.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  github: typeof github;
  http: typeof http;
  messages: typeof messages;
  projects: typeof projects;
  sandboxes: typeof sandboxes;
  sessions: typeof sessions;
  types: typeof types;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

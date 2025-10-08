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
import type * as lib_clerkAuth from "../lib/clerkAuth.js";
import type * as lib_githubAuth from "../lib/githubAuth.js";
import type * as lib_sandbox from "../lib/sandbox.js";
import type * as lib_types from "../lib/types.js";
import type * as lib_workerBundle from "../lib/workerBundle.js";
import type * as lib_workerBundleContent from "../lib/workerBundleContent.js";
import type * as messages from "../messages.js";
import type * as projects from "../projects.js";
import type * as sandboxActions from "../sandboxActions.js";
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
  "lib/clerkAuth": typeof lib_clerkAuth;
  "lib/githubAuth": typeof lib_githubAuth;
  "lib/sandbox": typeof lib_sandbox;
  "lib/types": typeof lib_types;
  "lib/workerBundle": typeof lib_workerBundle;
  "lib/workerBundleContent": typeof lib_workerBundleContent;
  messages: typeof messages;
  projects: typeof projects;
  sandboxActions: typeof sandboxActions;
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

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
import type * as lib_clerk_auth from "../lib/clerk_auth.js";
import type * as lib_github_auth from "../lib/github_auth.js";
import type * as lib_sandbox from "../lib/sandbox.js";
import type * as lib_types from "../lib/types.js";
import type * as lib_worker_bundle from "../lib/worker_bundle.js";
import type * as lib_worker_bundle_content from "../lib/worker_bundle_content.js";
import type * as messages from "../messages.js";
import type * as projects from "../projects.js";
import type * as sandboxActions from "../sandboxActions.js";
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
  "lib/clerk_auth": typeof lib_clerk_auth;
  "lib/github_auth": typeof lib_github_auth;
  "lib/sandbox": typeof lib_sandbox;
  "lib/types": typeof lib_types;
  "lib/worker_bundle": typeof lib_worker_bundle;
  "lib/worker_bundle_content": typeof lib_worker_bundle_content;
  messages: typeof messages;
  projects: typeof projects;
  sandboxActions: typeof sandboxActions;
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

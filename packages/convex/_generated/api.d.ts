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
import type * as branches from "../branches.js";
import type * as github from "../github.js";
import type * as http from "../http.js";
import type * as lib_clerkAuth from "../lib/clerkAuth.js";
import type * as lib_crypto from "../lib/crypto.js";
import type * as lib_cryptoBrowser from "../lib/cryptoBrowser.js";
import type * as lib_daytonaImage from "../lib/daytonaImage.js";
import type * as lib_githubAuth from "../lib/githubAuth.js";
import type * as lib_sandbox from "../lib/sandbox.js";
import type * as lib_secretsHelpers from "../lib/secretsHelpers.js";
import type * as lib_settingsHelpers from "../lib/settingsHelpers.js";
import type * as lib_types from "../lib/types.js";
import type * as lib_variablesHelpers from "../lib/variablesHelpers.js";
import type * as lib_workerBundle from "../lib/workerBundle.js";
import type * as lib_workerBundleContent from "../lib/workerBundleContent.js";
import type * as messages from "../messages.js";
import type * as permissions from "../permissions.js";
import type * as projects from "../projects.js";
import type * as sandboxActions from "../sandboxActions.js";
import type * as secrets from "../secrets.js";
import type * as settings from "../settings.js";
import type * as types from "../types.js";
import type * as users from "../users.js";
import type * as variables from "../variables.js";

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
  "lib/clerkAuth": typeof lib_clerkAuth;
  "lib/crypto": typeof lib_crypto;
  "lib/cryptoBrowser": typeof lib_cryptoBrowser;
  "lib/daytonaImage": typeof lib_daytonaImage;
  "lib/githubAuth": typeof lib_githubAuth;
  "lib/sandbox": typeof lib_sandbox;
  "lib/secretsHelpers": typeof lib_secretsHelpers;
  "lib/settingsHelpers": typeof lib_settingsHelpers;
  "lib/types": typeof lib_types;
  "lib/variablesHelpers": typeof lib_variablesHelpers;
  "lib/workerBundle": typeof lib_workerBundle;
  "lib/workerBundleContent": typeof lib_workerBundleContent;
  messages: typeof messages;
  permissions: typeof permissions;
  projects: typeof projects;
  sandboxActions: typeof sandboxActions;
  secrets: typeof secrets;
  settings: typeof settings;
  types: typeof types;
  users: typeof users;
  variables: typeof variables;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

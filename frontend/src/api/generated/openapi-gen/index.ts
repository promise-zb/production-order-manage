import type { ResponseType } from 'axios';
import { client } from './client.gen';
import * as sdk from './sdk.gen';
import {
  configureOpenApiErrorHandling,
  openApiSettings,
  type OpenApiAuthState,
  type OpenApiErrorHandlingOptions,
} from './openapi-http.gen';
import { createOpenApiInitializer, resolveBase, type OpenApiCommonInit } from 'openapi-axios-sdk/runtime';

export type { ResponseType };

export type OpenApiOpenapiInit = Partial<Pick<OpenApiAuthState, 'BASE' | 'WITH_CREDENTIALS'>> & {
  pathPrefix?: string;
  defaultResponseType?: ResponseType;
  token?: string | (() => string | Promise<string | undefined> | undefined);
  headers?: OpenApiAuthState['HEADERS'];
  errorHandling?: OpenApiErrorHandlingOptions;
};

export function resolveOpenApiOpenapiBase(init: Pick<OpenApiOpenapiInit, 'BASE' | 'pathPrefix'>): string | undefined {
  return resolveBase(init);
}

export function configureOpenApiOpenapiBase(baseURL: string, more?: { responseType?: ResponseType }): void {
  openApiSettings.BASE = baseURL;
  client.setConfig({ baseURL, ...more });
}

export function configureOpenApiOpenapiResponseType(responseType: ResponseType): void {
  client.setConfig({ responseType });
}

const init = createOpenApiInitializer({
  sdk,
  client,
  settings: openApiSettings,
  configureErrorHandling: configureOpenApiErrorHandling,
});

/** openapi.yaml 对应的 SDK；在子应用入口初始化 BASE/token（该 spec 可能没有 servers.baseURL）。 */
export function OpenApiOpenapi(initArg?: OpenApiOpenapiInit): typeof sdk {
  return init(initArg as OpenApiCommonInit);
}

export {
  configureOpenApiErrorHandling,
  openApiHttpClient,
  openApiSilent,
  type OpenApiAuthState,
  type OpenApiErrorHandlingOptions,
  type OpenApiErrorReporter,
} from './openapi-http.gen';

export { client as clientOpenapi } from './client.gen';
export * from './sdk.gen';
export type * from './types';

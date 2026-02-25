import { type NextApiRequest, type NextApiResponse } from "next";
import { type ZodType, type z } from "zod/v4";
import { ApiAuthService } from "@/src/features/public-api/server/apiAuth";
import { prisma } from "@langfuse/shared/src/db";
import {
  redis,
  type AuthHeaderValidVerificationResult,
  logger,
} from "@langfuse/shared/src/server";
import { type RateLimitResource } from "@langfuse/shared";
import { RateLimitService } from "@/src/features/public-api/server/RateLimitService";
import { contextWithLangfuseProps } from "@langfuse/shared/src/server";
import * as opentelemetry from "@opentelemetry/api";
import { env } from "@/src/env.mjs";
import { traceException } from "@langfuse/shared/src/server";

type OrgRouteConfig<
  TQuery extends ZodType<any>,
  TBody extends ZodType<any>,
  TResponse extends ZodType<any>,
> = {
  name: string;
  querySchema?: TQuery;
  bodySchema?: TBody;
  responseSchema: TResponse;
  successStatusCode?: number;
  rateLimitResource?: z.infer<typeof RateLimitResource>;
  fn: (params: {
    query: z.infer<TQuery>;
    body: z.infer<TBody>;
    req: NextApiRequest;
    res: NextApiResponse;
    auth: AuthHeaderValidVerificationResult & {
      scope: { orgId: string; accessLevel: "organization" };
    };
  }) => Promise<z.infer<TResponse>>;
};

export const createAuthedOrgAPIRoute = <
  TQuery extends ZodType<any>,
  TBody extends ZodType<any>,
  TResponse extends ZodType<any>,
>(
  routeConfig: OrgRouteConfig<TQuery, TBody, TResponse>,
): ((req: NextApiRequest, res: NextApiResponse) => Promise<void>) => {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    let auth: AuthHeaderValidVerificationResult;

    try {
      const authResult = await new ApiAuthService(
        prisma,
        redis,
      ).verifyAuthHeaderAndReturnScope(req.headers.authorization);

      if (!authResult.validKey) {
        res.status(401).json({ message: authResult.error });
        return;
      }

      if (authResult.scope.accessLevel !== "organization") {
        res.status(401).json({
          message:
            "Access denied - need to use basic auth with an organization-scoped API key",
        });
        return;
      }

      if (!authResult.scope.orgId) {
        res.status(401).json({
          message: "Organization ID not found for API token",
        });
        return;
      }

      auth = authResult;
    } catch (error: any) {
      const statusCode = error.status || 401;
      const message = error.message || "Authentication failed";
      res.status(statusCode).json({ message });
      return;
    }

    const rateLimitResponse =
      await RateLimitService.getInstance().rateLimitRequest(
        auth.scope,
        routeConfig.rateLimitResource || "public-api",
      );

    if (rateLimitResponse?.isRateLimited()) {
      return rateLimitResponse.sendRestResponseIfLimited(res);
    }

    logger.debug(
      `Request to route ${routeConfig.name} orgId ${auth.scope.orgId}`,
      {
        query: req.query,
        body: req.body,
      },
    );

    const query = routeConfig.querySchema
      ? routeConfig.querySchema.parse(req.query)
      : ({} as z.infer<TQuery>);
    const body = routeConfig.bodySchema
      ? routeConfig.bodySchema.parse(req.body)
      : ({} as z.infer<TBody>);

    const ctx = contextWithLangfuseProps({
      headers: req.headers,
    });
    return opentelemetry.context.with(ctx, async () => {
      const response = await routeConfig.fn({
        query,
        body,
        req,
        res,
        auth: auth as AuthHeaderValidVerificationResult & {
          scope: { orgId: string; accessLevel: "organization" };
        },
      });

      if (env.NODE_ENV === "development" && routeConfig.responseSchema) {
        const parsingResult = routeConfig.responseSchema.safeParse(response);
        if (!parsingResult.success) {
          logger.error("Response validation failed:", parsingResult.error);
          traceException(parsingResult.error);
        }
      }

      res
        .status(
          res.statusCode !== 200
            ? res.statusCode
            : routeConfig.successStatusCode || 200,
        )
        .json(response || { message: "OK" });
    });
  };
};

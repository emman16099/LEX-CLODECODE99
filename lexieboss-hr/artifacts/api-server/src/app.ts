import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

app.use("/api", router);

app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const errorStatus = typeof error === "object" && error !== null && "status" in error
    ? Number(error.status)
    : 500;
  const status = Number.isInteger(errorStatus) && errorStatus >= 400 && errorStatus < 500
    ? errorStatus
    : 500;
  if (status >= 500) req.log.error({ err: error }, "Unhandled API error");
  else req.log.warn({ err: error }, "Rejected invalid API request");
  res.status(status).json({
    error: status === 400 ? "Invalid request body" : "An unexpected server error occurred",
  });
});

export default app;

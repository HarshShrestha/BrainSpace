import { spawn } from "node:child_process";
import { ApiError } from "../../utils/ApiError.js";

/** No network listener: the authenticated API starts a private Python worker per request. */
export function runWorker<T>(operation: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.env.RAG_PYTHON || "python3",
      ["-m", "rag.worker"],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: ["pipe", "pipe", "ignore"],
      },
    );
    let output = "";
    let settled = false;
    const finish = (err?: ApiError, data?: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(data as T);
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new ApiError(504, "AI processing timed out. Please try again."));
    }, 120_000);
    child.on("error", () =>
      finish(
        new ApiError(
          503,
          "Python AI service is unavailable. Check server setup.",
        ),
      ),
    );
    child.stdin.on("error", () =>
      finish(
        new ApiError(
          503,
          "Python AI service is unavailable. Check server setup.",
        ),
      ),
    );
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (data: string) => {
      output += data;
      if (output.length > 12_000_000) {
        child.kill("SIGKILL");
        finish(new ApiError(502, "AI service returned an oversized response."));
      }
    });
    child.on("close", (code) => {
      if (settled) return;
      try {
        const result = JSON.parse(output);
        if (code !== 0 || typeof result.ok !== "boolean") throw new Error();
        if (!result.ok) {
          const status =
            Number.isInteger(result.status) &&
            result.status >= 400 &&
            result.status <= 599
              ? result.status
              : 502;
          return finish(
            new ApiError(
              status,
              typeof result.message === "string"
                ? result.message
                : "AI processing failed.",
            ),
          );
        }
        finish(undefined, result.data as T);
      } catch {
        finish(
          new ApiError(502, "Python AI service returned an invalid response."),
        );
      }
    });
    child.stdin.end(JSON.stringify({ operation, payload }));
  });
}

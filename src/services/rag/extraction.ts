import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import ipaddr from "ipaddr.js";
import { load } from "cheerio";
import { ApiError } from "../../utils/ApiError.js";

const MAX_BYTES = 1_000_000;
export function isPublicAddress(address: string): boolean {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}
/** Fetch only public web pages. Resolve and pin each hop to defeat DNS rebinding. */
export async function fetchPublicText(input: string): Promise<string> {
  let current = input;
  for (let redirects = 0; redirects <= 3; redirects++) {
    let url: URL;
    try {
      url = new URL(current);
    } catch {
      throw new ApiError(400, "Invalid source URL");
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      (url.port &&
        !(
          (url.protocol === "https:" && url.port === "443") ||
          (url.protocol === "http:" && url.port === "80")
        ))
    )
      throw new ApiError(
        400,
        "Only public HTTP(S) pages on standard ports can be indexed",
      );
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    let addresses: { address: string; family: number }[];
    let dnsTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      addresses = await Promise.race([
        lookup(hostname, { all: true, verbatim: true }),
        new Promise<never>((_, reject) => {
          dnsTimer = setTimeout(() => reject(new Error("DNS timeout")), 5000);
        }),
      ]);
    } catch {
      throw new ApiError(422, "Could not resolve the source page");
    } finally {
      if (dnsTimer) clearTimeout(dnsTimer);
    }
    if (
      !addresses.length ||
      addresses.some(({ address }) => !isPublicAddress(address))
    )
      throw new ApiError(
        400,
        "Private or reserved network addresses cannot be indexed",
      );
    const selected = addresses[0]!;
    const result = await new Promise<{
      status: number;
      location?: string;
      contentType: string;
      data: Buffer;
    }>((resolve, reject) => {
      const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(
        url,
        {
          family: selected.family,
          headers: {
            Accept: "text/html,text/plain;q=0.9",
            "Accept-Encoding": "identity",
            "User-Agent": "BrainSpaceIndexer/1.0",
          },
          lookup: ((
            _host: string,
            _options: unknown,
            callback: (
              err: Error | null,
              address: string,
              family: number,
            ) => void,
          ) => callback(null, selected.address, selected.family)) as never,
        },
        (response) => {
          const data: Buffer[] = [];
          let size = 0;
          response.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > MAX_BYTES) {
              request.destroy(new Error("Page too large"));
            } else data.push(chunk);
          });
          response.on("end", () =>
            resolve({
              status: response.statusCode || 500,
              ...(response.headers.location
                ? { location: response.headers.location }
                : {}),
              contentType: String(response.headers["content-type"] || ""),
              data: Buffer.concat(data),
            }),
          );
          response.on("error", reject);
        },
      );
      const deadline = setTimeout(
        () => request.destroy(new Error("Page timeout")),
        12000,
      );
      request.on("close", () => clearTimeout(deadline));
      request.setTimeout(10000, () =>
        request.destroy(new Error("Page timeout")),
      );
      request.on("error", reject);
      request.end();
    }).catch(() => {
      throw new ApiError(
        422,
        "Could not safely read the page; try pasting its text instead",
      );
    });
    if ([301, 302, 303, 307, 308].includes(result.status) && result.location) {
      try {
        current = new URL(result.location, url).href;
      } catch {
        throw new ApiError(422, "Invalid redirect from source page");
      }
      continue;
    }
    if (result.status < 200 || result.status >= 300)
      throw new ApiError(
        422,
        "Source page is not publicly accessible; try pasting its text",
      );
    if (!/^(text\/html|text\/plain)(;|$)/i.test(result.contentType))
      throw new ApiError(
        422,
        "Only HTML and plain-text pages can be read; paste a transcript or document text instead",
      );
    const body = result.data.toString("utf8");
    if (result.contentType.toLowerCase().startsWith("text/plain"))
      return body.replace(/\s+/g, " ").trim().slice(0, 24000);
    const $ = load(body);
    $("script,style,noscript,nav,footer,header,form,svg,iframe").remove();
    const root = $("article").first().length
      ? $("article").first()
      : $("main").first().length
        ? $("main").first()
        : $("body");
    return root.text().replace(/\s+/g, " ").trim().slice(0, 24000);
  }
  throw new ApiError(422, "Too many redirects");
}

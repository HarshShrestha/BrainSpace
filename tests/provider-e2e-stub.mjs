// Test-only provider simulator. Production code always calls the real OpenAI API.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input.url;
  if (!url.startsWith("https://api.openai.com/v1/"))
    return originalFetch(input, init);
  const body = JSON.parse(init.body);
  if (url.endsWith("/embeddings"))
    return Response.json({
      data: body.input.map((_, index) => ({ index, embedding: [1, 0] })),
    });
  if (url.endsWith("/chat/completions")) {
    const name = body.response_format.json_schema.name;
    const source = JSON.parse(body.messages[1].content).sources?.[0];
    const data =
      name === "support_check"
        ? { supported: true }
        : source?.text.includes("The example uses blue cards for each source.")
          ? {
              answer: "The example uses blue cards.",
              evidence: [
                {
                  id: source.id,
                  quote: "The example uses blue cards for each source.",
                },
              ],
            }
          : { answer: "", evidence: [] };
    return Response.json({
      choices: [{ message: { content: JSON.stringify(data) } }],
    });
  }
  throw new Error("Unexpected AI provider endpoint in test");
};

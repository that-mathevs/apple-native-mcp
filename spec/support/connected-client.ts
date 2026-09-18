import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/** An agent's view of a server: a client connected to it in memory, as it would be over stdio. */
export const connectedTo = async (server: McpServer): Promise<Client> => {
  const client = new Client({ name: "spec", version: "0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return client;
};

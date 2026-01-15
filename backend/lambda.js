import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME;
const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};

const respond = (statusCode, body) => ({
  statusCode,
  headers: HEADERS,
  body: body ? JSON.stringify(body) : "",
});

const parseBody = (event) => {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch (err) {
    throw { statusCode: 400, message: "Invalid JSON" };
  }
};

const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const mapItem = (item) => ({
  id: item.sk.replace("todo#", ""),
  title: item.title,
  done: !!item.done,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

const getTodos = async () => {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
    ExpressionAttributeValues: {
      ":pk": "default",
      ":prefix": "todo#",
    },
  });
  const { Items = [] } = await ddb.send(command);
  return respond(200, { items: Items.map(mapItem) });
};

const createTodo = async (body) => {
  if (!body || typeof body.title !== "string" || !body.title.trim()) {
    throw { statusCode: 400, message: "title is required" };
  }
  const now = new Date().toISOString();
  const id = generateId();
  const item = {
    pk: "default",
    sk: `todo#${id}`,
    title: body.title.trim(),
    done: Boolean(body.done),
    createdAt: now,
    updatedAt: now,
  };
  const command = new PutCommand({ TableName: TABLE_NAME, Item: item });
  await ddb.send(command);
  return respond(201, { item: mapItem(item) });
};

const updateTodo = async (id, body) => {
  if (!id) throw { statusCode: 400, message: "id is required" };
  if (!body || (body.title === undefined && body.done === undefined)) {
    throw { statusCode: 400, message: "Nothing to update" };
  }
  const now = new Date().toISOString();
  const updates = [];
  const names = {};
  const values = { ":updatedAt": now };

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      throw { statusCode: 400, message: "title must be a non-empty string" };
    }
    updates.push("#title = :title");
    names["#title"] = "title";
    values[":title"] = body.title.trim();
  }
  if (body.done !== undefined) {
    updates.push("done = :done");
    values[":done"] = Boolean(body.done);
  }

  updates.push("updatedAt = :updatedAt");

  const command = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { pk: "default", sk: `todo#${id}` },
    UpdateExpression: `SET ${updates.join(", ")}`,
    ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
    ExpressionAttributeValues: values,
    ConditionExpression: "attribute_exists(pk)",
    ReturnValues: "ALL_NEW",
  });

  const { Attributes } = await ddb.send(command);
  if (!Attributes) throw { statusCode: 404, message: "Todo not found" };
  return respond(200, { item: mapItem(Attributes) });
};

const deleteTodo = async (id) => {
  if (!id) throw { statusCode: 400, message: "id is required" };
  const command = new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { pk: "default", sk: `todo#${id}` },
    ConditionExpression: "attribute_exists(pk)",
  });
  await ddb.send(command);
  return respond(200, { deleted: true, id });
};

export const handler = async (event) => {
  const method = event?.requestContext?.http?.method || "";
  const path = event?.rawPath || "";

  if (method === "OPTIONS") return respond(204);

  try {
    const body = ["POST", "PUT"].includes(method) ? parseBody(event) : null;

    if (path === "/todos" && method === "GET") return await getTodos();
    if (path === "/todos" && method === "POST") return await createTodo(body);

    const parts = path.split("/").filter(Boolean);
    if (parts.length === 2 && parts[0] === "todos") {
      const id = parts[1];
      if (method === "PUT") return await updateTodo(id, body);
      if (method === "DELETE") return await deleteTodo(id);
    }

    return respond(404, { message: "Not Found" });
  } catch (err) {
    if (err?.statusCode) return respond(err.statusCode, { message: err.message });
    console.error("Unhandled error", err);
    return respond(500, { message: "Internal Server Error" });
  }
};

import { createServer } from "node:http";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { authHandler, ensureAuthReady, requireSession } from "./auth.mjs";
import { env } from "./env.mjs";

const host = env.host;
const port = env.port;
const staticDir = env.staticDir;
const scenesDir = env.scenesDir;
const maxBodySize = 50 * 1024 * 1024;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

const sendJson = (res, statusCode, body) => {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(payload),
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(payload);
};

const sendError = (res, statusCode, message) => {
  sendJson(res, statusCode, { error: message });
};

const formatSceneResponse = ({ meta, scene }) => ({
  meta,
  scene,
});

const slugify = (value) => {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "untitled";
};

const prettifyId = (id) =>
  id
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ") || "Untitled";

const getScenePath = (id) => path.join(scenesDir, `${id}.excalidraw`);

const isSafeId = (id) => /^[a-z0-9][a-z0-9-]*$/.test(id);

const ensureSceneDirectory = async () => {
  await mkdir(scenesDir, { recursive: true });
};

const readRequestBody = async (req) => {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodySize) {
      const error = new Error("Request body too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  if (size === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Invalid JSON request body");
    error.statusCode = 400;
    throw error;
  }
};

const normalizeSceneDocument = (scene, requestedName) => {
  if (!scene || typeof scene !== "object" || Array.isArray(scene)) {
    const error = new Error("Scene payload must be an object");
    error.statusCode = 400;
    throw error;
  }

  const normalizedName =
    typeof requestedName === "string" && requestedName.trim()
      ? requestedName.trim()
      : typeof scene.appState?.name === "string" && scene.appState.name.trim()
        ? scene.appState.name.trim()
        : "Untitled";

  return {
    ...scene,
    appState: {
      ...(scene.appState || {}),
      name: normalizedName,
    },
  };
};

const loadSceneDocument = async (id) => {
  if (!isSafeId(id)) {
    const error = new Error("Invalid scene id");
    error.statusCode = 400;
    throw error;
  }

  const filePath = getScenePath(id);

  let raw;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      const notFoundError = new Error("Scene not found");
      notFoundError.statusCode = 404;
      throw notFoundError;
    }
    throw error;
  }

  let scene;
  try {
    scene = JSON.parse(raw);
  } catch {
    const parseError = new Error(`Scene file "${id}" is not valid JSON`);
    parseError.statusCode = 500;
    throw parseError;
  }

  const fileStats = await stat(filePath);
  const name =
    typeof scene?.appState?.name === "string" && scene.appState.name.trim()
      ? scene.appState.name.trim()
      : prettifyId(id);

  return {
    filePath,
    scene,
    meta: {
      id,
      name,
      size: fileStats.size,
      updatedAt: fileStats.mtime.toISOString(),
    },
  };
};

const getUniqueSceneId = async (name, currentId = null) => {
  const baseId = slugify(name);
  let nextId = baseId;
  let counter = 2;

  while (true) {
    if (nextId === currentId) {
      return nextId;
    }

    try {
      await stat(getScenePath(nextId));
      nextId = `${baseId}-${counter++}`;
    } catch (error) {
      if (error.code === "ENOENT") {
        return nextId;
      }
      throw error;
    }
  }
};

const writeScene = async ({ currentId = null, name, scene }) => {
  const normalizedScene = normalizeSceneDocument(scene, name);
  const sceneId = await getUniqueSceneId(
    normalizedScene.appState.name,
    currentId,
  );
  const targetPath = getScenePath(sceneId);
  const tempPath = `${targetPath}.tmp`;
  const serialized = JSON.stringify(normalizedScene, null, 2);

  await writeFile(tempPath, serialized, "utf8");
  await rename(tempPath, targetPath);

  if (currentId && currentId !== sceneId) {
    await rm(getScenePath(currentId), { force: true });
  }

  return formatSceneResponse(await loadSceneDocument(sceneId));
};

const listScenes = async () => {
  await ensureSceneDirectory();
  const entries = await readdir(scenesDir, { withFileTypes: true });

  const scenes = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".excalidraw"))
      .map((entry) =>
        loadSceneDocument(entry.name.replace(/\.excalidraw$/, "")),
      ),
  );

  return scenes
    .map(({ meta }) => meta)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
};

const serveStatic = async (res, url) => {
  const pathname = decodeURIComponent(url.pathname);
  const requestedPath =
    pathname === "/"
      ? path.join(staticDir, "index.html")
      : path.join(staticDir, pathname.replace(/^\/+/, ""));
  const normalizedPath = path.normalize(requestedPath);
  const normalizedStaticDir = path.normalize(staticDir);

  if (
    normalizedPath !== normalizedStaticDir &&
    !normalizedPath.startsWith(`${normalizedStaticDir}${path.sep}`)
  ) {
    sendError(res, 403, "Forbidden");
    return;
  }

  const tryPaths = [normalizedPath];
  if (!path.extname(normalizedPath)) {
    tryPaths.push(path.join(staticDir, "index.html"));
  }

  for (const candidatePath of tryPaths) {
    try {
      const fileStats = await stat(candidatePath);
      if (!fileStats.isFile()) {
        continue;
      }

      const body = await readFile(candidatePath);
      res.writeHead(200, {
        "Cache-Control": candidatePath.endsWith("index.html")
          ? "no-cache"
          : "public, max-age=31536000, immutable",
        "Content-Length": body.length,
        "Content-Type":
          mimeTypes[path.extname(candidatePath)] || "application/octet-stream",
      });
      res.end(body);
      return;
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  sendError(res, 404, "Not found");
};

const handleApiRequest = async (req, res, url) => {
  const pathname = url.pathname;

  if (pathname === "/api/auth" || pathname.startsWith("/api/auth/")) {
    await authHandler(req, res);
    return true;
  }

  if (pathname.startsWith("/api/scenes")) {
    await requireSession(req);
  }

  const sceneIdMatch = pathname.match(/^\/api\/scenes\/([a-z0-9-]+)$/);

  if (req.method === "GET" && pathname === "/api/scenes") {
    sendJson(res, 200, { scenes: await listScenes() });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/scenes") {
    const body = await readRequestBody(req);
    const savedScene = await writeScene({
      name: body.name,
      scene: body.scene,
    });
    sendJson(res, 201, savedScene);
    return true;
  }

  if (!sceneIdMatch) {
    return false;
  }

  const [, sceneId] = sceneIdMatch;

  if (req.method === "GET") {
    sendJson(res, 200, formatSceneResponse(await loadSceneDocument(sceneId)));
    return true;
  }

  if (req.method === "PUT") {
    const body = await readRequestBody(req);
    const savedScene = await writeScene({
      currentId: sceneId,
      name: body.name,
      scene: body.scene,
    });
    sendJson(res, 200, savedScene);
    return true;
  }

  if (req.method === "DELETE") {
    await loadSceneDocument(sceneId);
    await rm(getScenePath(sceneId), { force: true });
    sendJson(res, 200, { ok: true });
    return true;
  }

  sendError(res, 405, "Method not allowed");
  return true;
};

await ensureSceneDirectory();
await ensureAuthReady();

const server = createServer(async (req, res) => {
  const url = new URL(
    req.url || "/",
    `http://${req.headers.host || "localhost"}`,
  );

  try {
    if (url.pathname.startsWith("/api/")) {
      const handled = await handleApiRequest(req, res, url);
      if (!handled) {
        sendError(res, 404, "Not found");
      }
      return;
    }

    await serveStatic(res, url);
  } catch (error) {
    const statusCode =
      typeof error?.statusCode === "number" ? error.statusCode : 500;
    const message = statusCode >= 500 ? "Internal server error" : error.message;

    if (statusCode >= 500) {
      process.stderr.write(`${error?.stack || String(error)}\n`);
    }

    sendError(res, statusCode, message);
  }
});

server.listen(port, host, () => {
  process.stdout.write(
    `${[
      `Excalidraw self-hosted server listening on http://${host}:${port}`,
      `Static files: ${staticDir}`,
      `Scene storage: ${scenesDir}`,
      `Auth DB: ${env.authDbPath}`,
      `Allowed emails: ${env.allowedEmails.join(", ")}`,
    ].join("\n")}\n`,
  );
});

export type ServerSceneMeta = {
  id: string;
  name: string;
  size: number;
  updatedAt: string;
  imageUrl: string | null;
};

export type ServerSceneDocument = {
  scene: Record<string, unknown>;
  meta: ServerSceneMeta;
};

export type ServerSceneImagePayload = {
  dataURL: string;
  mimeType: "image/png";
};

const fetchJson = async <T>(input: RequestInfo, init?: RequestInit) => {
  const response = await fetch(input, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | T
    | null;

  if (!response.ok) {
    const errorMessage =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Request failed with status ${response.status}`;

    throw new Error(errorMessage);
  }

  return payload as T;
};

export const listServerScenes = async () => {
  const payload = await fetchJson<{ scenes: ServerSceneMeta[] }>("/api/scenes");
  return payload.scenes;
};

export const getServerScene = async (id: string) =>
  fetchJson<ServerSceneDocument>(`/api/scenes/${id}`);

export const createServerScene = async (
  name: string,
  scene: Record<string, unknown>,
  image?: ServerSceneImagePayload | null,
) =>
  fetchJson<ServerSceneDocument>("/api/scenes", {
    method: "POST",
    body: JSON.stringify({ name, scene, image }),
  });

export const updateServerScene = async (
  id: string,
  name: string,
  scene: Record<string, unknown>,
  image?: ServerSceneImagePayload | null,
) =>
  fetchJson<ServerSceneDocument>(`/api/scenes/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name, scene, image }),
  });

export const deleteServerScene = async (id: string) =>
  fetchJson<{ ok: true }>(`/api/scenes/${id}`, {
    method: "DELETE",
  });

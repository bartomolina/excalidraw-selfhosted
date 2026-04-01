import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { TextField } from "@excalidraw/excalidraw/components/TextField";
import {
  LoadIcon,
  file,
  save,
  saveAs,
} from "@excalidraw/excalidraw/components/icons";
import { useCallback, useEffect, useMemo, useState } from "react";

import { deleteServerScene, listServerScenes } from "../data/serverScenes";

import "./ServerScenesDialog.scss";

import type { ServerSceneMeta } from "../data/serverScenes";

type ServerSceneSaveMode = "save" | "saveAs";

export const ServerScenesDialog = ({
  isOpen,
  currentScene,
  isDirty,
  suggestedName,
  onClose,
  onOpenScene,
  onSaveScene,
  onSceneDeleted,
  onError,
}: {
  isOpen: boolean;
  currentScene: ServerSceneMeta | null;
  isDirty: boolean;
  suggestedName: string;
  onClose: () => void;
  onOpenScene: (sceneId: string) => Promise<void>;
  onSaveScene: (opts: {
    mode: ServerSceneSaveMode;
    name?: string;
  }) => Promise<ServerSceneMeta>;
  onSceneDeleted: (sceneId: string) => Promise<void>;
  onError: (message: string) => void;
}) => {
  const [scenes, setScenes] = useState<ServerSceneMeta[]>([]);
  const [saveName, setSaveName] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const displaySuggestedName = useMemo(() => {
    return suggestedName.trim() || currentScene?.name || "Untitled";
  }, [currentScene?.name, suggestedName]);

  const refreshScenes = useCallback(async () => {
    setIsRefreshing(true);
    try {
      setScenes(await listServerScenes());
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSaveName(currentScene?.name || displaySuggestedName);
    refreshScenes().catch((error: Error) => {
      onError(error.message);
    });
  }, [
    isOpen,
    currentScene?.id,
    currentScene?.name,
    displaySuggestedName,
    onError,
    refreshScenes,
  ]);

  const runAction = async (actionKey: string, action: () => Promise<void>) => {
    setBusyAction(actionKey);
    try {
      await action();
    } catch (error: any) {
      onError(error.message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleSave = async (mode: ServerSceneSaveMode) => {
    await runAction(mode, async () => {
      const savedScene = await onSaveScene({
        mode,
        name: mode === "saveAs" ? saveName : undefined,
      });
      setSaveName(savedScene.name);
      await refreshScenes();
      onClose();
    });
  };

  const handleDelete = async (scene: ServerSceneMeta) => {
    if (!window.confirm(`Delete "${scene.name}" from the server?`)) {
      return;
    }

    await runAction(`delete:${scene.id}`, async () => {
      await deleteServerScene(scene.id);
      await onSceneDeleted(scene.id);
      await refreshScenes();
    });
  };

  const formatUpdatedAt = (value: string) =>
    new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog
      size="regular"
      onCloseRequest={onClose}
      title="Server scenes"
      className="ServerScenesDialog"
    >
      <div className="ServerScenesDialog__body">
        <div className="ServerScenesDialog__summary">
          <div className="ServerScenesDialog__summaryLabel">
            {currentScene ? "Current server file" : "Current scene"}
          </div>
          <div className="ServerScenesDialog__summaryName">
            {currentScene?.name || "Unsaved local scene"}
          </div>
          <div className="ServerScenesDialog__summaryMeta">
            {currentScene
              ? isDirty
                ? "Unsaved changes"
                : "In sync with server"
              : "Not saved on the server yet"}
          </div>
        </div>

        <div className="ServerScenesDialog__actions">
          <FilledButton
            label="Save"
            icon={save}
            size="large"
            onClick={() => handleSave("save")}
            disabled={!!busyAction}
          />
          <TextField
            label="Save as"
            value={saveName}
            onChange={setSaveName}
            fullWidth
          />
          <FilledButton
            label="Save as new"
            icon={saveAs}
            size="large"
            onClick={() => handleSave("saveAs")}
            disabled={!saveName.trim() || !!busyAction}
          />
          <FilledButton
            label="Refresh"
            variant="outlined"
            size="large"
            onClick={() => runAction("refresh", refreshScenes)}
            disabled={!!busyAction}
          />
        </div>

        <div className="ServerScenesDialog__listHeader">
          <div>Saved scenes</div>
          <div>{isRefreshing ? "Refreshing..." : `${scenes.length} items`}</div>
        </div>

        <div className="ServerScenesDialog__list">
          {scenes.length === 0 && !isRefreshing ? (
            <div className="ServerScenesDialog__empty">
              No scenes saved on the server yet.
            </div>
          ) : (
            scenes.map((scene) => {
              const isCurrent = currentScene?.id === scene.id;
              const isBusy = busyAction === `open:${scene.id}`;

              return (
                <div
                  key={scene.id}
                  className="ServerScenesDialog__scene"
                  data-current={isCurrent || undefined}
                >
                  {scene.imageUrl ? (
                    <a
                      className="ServerScenesDialog__scenePreview"
                      href={scene.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open image preview for ${scene.name}`}
                    >
                      <img
                        src={scene.imageUrl}
                        alt={`Preview of ${scene.name}`}
                        loading="lazy"
                      />
                    </a>
                  ) : (
                    <div
                      className="ServerScenesDialog__scenePreview ServerScenesDialog__scenePreview--empty"
                      aria-hidden
                    />
                  )}
                  <div className="ServerScenesDialog__sceneInfo">
                    <div className="ServerScenesDialog__sceneName">
                      {scene.name}
                    </div>
                    <div className="ServerScenesDialog__sceneMeta">
                      <span>{formatUpdatedAt(scene.updatedAt)}</span>
                      <span>
                        {Math.max(1, Math.round(scene.size / 1024))} KB
                      </span>
                      {isCurrent && <span>Current</span>}
                      {scene.imageUrl ? (
                        <a
                          href={scene.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Image
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className="ServerScenesDialog__sceneActions">
                    <FilledButton
                      label="Open"
                      variant="outlined"
                      icon={LoadIcon}
                      onClick={() =>
                        runAction(`open:${scene.id}`, async () => {
                          await onOpenScene(scene.id);
                          onClose();
                        })
                      }
                      disabled={!!busyAction && !isBusy}
                    />
                    <FilledButton
                      label="Delete"
                      variant="outlined"
                      color="danger"
                      onClick={() => handleDelete(scene)}
                      disabled={!!busyAction}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="ServerScenesDialog__footer">
          <div className="ServerScenesDialog__footerHint">
            Files are stored on the server as <code>.excalidraw</code> and PNG
            preview files.
          </div>
          <div className="ServerScenesDialog__footerIcons" aria-hidden>
            <span>{file}</span>
          </div>
        </div>
      </div>
    </Dialog>
  );
};

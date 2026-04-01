import React from "react";

import type { ServerSceneMeta } from "../data/serverScenes";

import "./ServerSceneTopBar.scss";

export const ServerSceneTopBar: React.FC<{
  currentScene: ServerSceneMeta | null;
  isDirty: boolean;
}> = ({ currentScene, isDirty }) => {
  const statusLabel = currentScene
    ? isDirty
      ? "Unsaved changes"
      : "Saved to server"
    : "Local draft";
  const statusTone = currentScene ? (isDirty ? "dirty" : "saved") : "local";

  return (
    <div
      className={`ServerSceneTopBar ServerSceneTopBar--${statusTone}`}
      title={currentScene ? `${currentScene.name} — ${statusLabel}` : statusLabel}
      aria-label={statusLabel}
    >
      <span className="ServerSceneTopBar__dot" />
      <span className="ServerSceneTopBar__label">{statusLabel}</span>
    </div>
  );
};

ServerSceneTopBar.displayName = "ServerSceneTopBar";

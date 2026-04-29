'use client';

/**
 * ExcalidrawWrapper
 * -----------------
 * Client-only wrapper around @excalidraw/excalidraw.
 * Must be imported via `dynamic(..., { ssr: false })` in the parent page.
 *
 * Tablet-optimised: touch events pass through, Portuguese locale set.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Excalidraw } = require('@excalidraw/excalidraw');

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (elements: readonly any[], appState: any) => void;
}

export default function ExcalidrawWrapper({ initialData, onChange }: Props) {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Excalidraw
        initialData={
          initialData
            ? {
                elements: initialData.elements ?? [],
                appState: {
                  ...(initialData.appState ?? {}),
                  collaborators: new Map(),
                },
              }
            : undefined
        }
        onChange={onChange}
        gridModeEnabled={false}
        zenModeEnabled={false}
        viewModeEnabled={false}
        detectScroll={false}
        handleKeyboardGlobally={false}
        langCode="pt-BR"
        UIOptions={{
          canvasActions: {
            saveAsImage: true,
            saveToActiveFile: false,
            loadScene: true,
            export: { saveFileToDisk: true },
            clearCanvas: true,
          },
        }}
      />
    </div>
  );
}

// src/utils/shareImage.ts
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { toPng } from "html-to-image";
import { Media } from "@capacitor-community/media";

export type ExportOptions = {
  width: number;
  height: number;
  backgroundColor?: string | null;
};

function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.split(",")[1] || "";
}

async function waitForImages(node: HTMLElement): Promise<void> {
  const imgs = Array.from(node.querySelectorAll("img")) as HTMLImageElement[];
  await Promise.all(
    imgs.map((img) => {
      if (!img.src) return Promise.resolve();
      const waitLoad = () =>
        new Promise<void>((resolve) => {
          const done = () => {
            img.removeEventListener("load", done);
            img.removeEventListener("error", done);
            resolve();
          };
          img.addEventListener("load", done);
          img.addEventListener("error", done);
        });
      const needsLoad = !img.complete || img.naturalWidth === 0;
      const decodePromise = typeof img.decode === "function" ? img.decode().catch(() => undefined) : Promise.resolve();
      return Promise.all([needsLoad ? waitLoad() : Promise.resolve(), decodePromise]).then(() => undefined);
    })
  );
}

export async function exportNodeToPng(node: HTMLElement, options: ExportOptions): Promise<string> {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (document.fonts?.ready) await document.fonts.ready;
  await waitForImages(node);
  return toPng(node, {
    cacheBust: true,
    width: options.width,
    height: options.height,
    backgroundColor: options.backgroundColor ?? undefined,
    style: {
      transform: "scale(1)",
      transformOrigin: "top left",
      width: `${options.width}px`,
      height: `${options.height}px`,
      backgroundColor: options.backgroundColor ?? "transparent",
    },
  });
}

export function downloadPng(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function sharePng(dataUrl: string, filename: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    downloadPng(dataUrl, filename);
    return;
  }

  const base64 = dataUrlToBase64(dataUrl);
  const write = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache,
  });

  await Share.share({
    title: "TrainQ Workout",
    text: "Mein Training",
    files: [write.uri],
  });
}

export async function savePngToPhotos(dataUrl: string, filename: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    downloadPng(dataUrl, filename);
    return;
  }

  try {
    const albums = await Media.getAlbums();
    const existing = albums.albums.find((a) => a.name === "TrainQ");
    let albumIdentifier = existing?.identifier;
    if (!albumIdentifier) {
      await Media.createAlbum({ name: "TrainQ" });
      const nextAlbums = await Media.getAlbums();
      albumIdentifier = nextAlbums.albums.find((a) => a.name === "TrainQ")?.identifier;
    }

    await Media.savePhoto({
      path: dataUrl,
      albumIdentifier,
      fileName: filename.replace(/\.png$/i, ""),
    });
  } catch {
    await sharePng(dataUrl, filename);
  }
}

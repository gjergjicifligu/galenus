import sharp from "sharp";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import probe from "ffprobe-static";
import { PDFDocument, PDFDict, PDFArray, PDFRawStream } from "pdf-lib";
import { readFile } from "node:fs/promises";
const execute = promisify(execFile);
export async function boundedForm(request: Request, maximum: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalidMedia");
  let size = 0;
  const chunks: Buffer[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximum) {
      await reader.cancel();
      throw new Error("fileTooLarge");
    }
    chunks.push(Buffer.from(value));
  }
  return new Response(Buffer.concat(chunks) as unknown as BodyInit, {
    headers: { "Content-Type": request.headers.get("content-type") || "" },
  }).formData();
}
export function detectMedia(bytes: Buffer): string {
  if (bytes.subarray(0, 5).toString("ascii") === "%PDF-")
    return "application/pdf";
  if (bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])))
    return "image/jpeg";
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  if (
    bytes.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163])) &&
    bytes.subarray(0, 4096).includes(Buffer.from("webm"))
  )
    return "video/webm";
  // ISO BMFF permits padding boxes before the file type box.
  for (let offset = 0; offset + 12 <= bytes.length && offset < 65536;) {
    const length = bytes.readUInt32BE(offset),
      type = bytes.toString("ascii", offset + 4, offset + 8);
    if (type === "ftyp") return "video/mp4";
    if (!["free", "skip", "wide"].includes(type) || length < 8) break;
    offset += length;
  }
  return "";
}
export async function validateMedia(file: string, mime: string) {
  if (mime === "application/pdf") {
    const bytes = await readFile(file);
    if (bytes.length > 20 * 1024 * 1024) throw new Error("invalidMedia");
    const document = await PDFDocument.load(bytes, {
      throwOnInvalidObject: true,
    });
    if (!document.getPageCount() || document.getPageCount() > 2000)
      throw new Error("invalidMedia");
    const prohibited = new Set([
      "A",
      "URI",
      "JS",
      "JavaScript",
      "AA",
      "OpenAction",
      "Launch",
      "EmbeddedFiles",
      "EF",
      "RichMedia",
      "XFA",
      "AcroForm",
      "SubmitForm",
      "ImportData",
      "GoToR",
      "GoToE",
    ]);
    const seen = new Set<unknown>();
    function inspect(value: unknown, depth = 0) {
      if (depth > 50) throw new Error("invalidMedia");
      if (seen.has(value)) return;
      seen.add(value);
      if (value instanceof PDFDict)
        for (const [key, child] of value.entries()) {
          if (
            prohibited.has(key.decodeText()) ||
            prohibited.has(String(child).replace(/^\//, ""))
          )
            throw new Error("invalidMedia");
          inspect(child, depth + 1);
        }
      if (value instanceof PDFRawStream) inspect(value.dict, depth + 1);
      if (value instanceof PDFArray)
        for (const child of value.asArray()) inspect(child, depth + 1);
    }
    for (const [, object] of document.context.enumerateIndirectObjects())
      inspect(object);
    return;
  }
  if (mime.startsWith("image/")) {
    const image = sharp(file, {
      failOn: "warning",
      limitInputPixels: 40_000_000,
    });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) throw new Error("invalidMedia");
    await image.stats();
    return;
  }
  const { stdout } = await execute(
    probe.path,
    [
      "-v",
      "error",
      "-protocol_whitelist",
      "file",
      "-show_entries",
      "format=format_name:stream=codec_type",
      "-of",
      "json",
      file,
    ],
    { timeout: 15000, maxBuffer: 65536, windowsHide: true },
  );
  const result = JSON.parse(stdout);
  if (
    !result.streams?.some(
      (s: { codec_type: string }) => s.codec_type === "video",
    ) ||
    !(mime === "video/mp4"
      ? result.format?.format_name?.includes("mp4")
      : result.format?.format_name?.includes("webm"))
  )
    throw new Error("invalidMedia");
}

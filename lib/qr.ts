import QRCode from "qrcode";

/** Inline SVG string for a QR code. Server-only. */
export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

/** base64-encoded PNG for a QR code. Server-only (the seed uses it to fake a
 *  wallet QR image). */
export async function qrPngBase64(text: string): Promise<string> {
  const buf = await QRCode.toBuffer(text, {
    margin: 1,
    width: 512,
    errorCorrectionLevel: "M",
  });
  return buf.toString("base64");
}

import QRCode from "qrcode";

/** Inline SVG string for a QR code. Server-only. */
export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

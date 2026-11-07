/**
 * QR rendering and image decoding helpers.
 * @module core/qr
 */

/**
 * Build the app URL that opens a question's solution.
 * @param {string} questionId
 * @returns {string}
 */
export function questionSolutionUrl(questionId) {
  const url = new URL(globalThis.location.href);
  url.search = '';
  url.hash = '/q/' + encodeURIComponent(questionId);
  return url.href;
}

/**
 * Build a QR code as an accessible SVG element.
 * @param {string} value
 * @param {string} label
 * @returns {SVGElement}
 */
export function renderQr(value, label) {
  if (typeof globalThis.qrcode !== 'function') {
    throw new Error('QR encoder is unavailable');
  }
  const qr = globalThis.qrcode(0, 'M');
  qr.addData(value);
  qr.make();
  const wrapper = document.createElement('span');
  wrapper.innerHTML = qr.createSvgTag(3, 0);
  const svg = wrapper.firstElementChild;
  if (!(svg instanceof SVGElement)) throw new Error('QR encoder returned invalid markup');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);
  return svg;
}

/**
 * Decode the first QR code in an image file.
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function decodeQrFile(file) {
  if (!('BarcodeDetector' in globalThis)) {
    throw new Error('QR scanning is not supported by this browser');
  }
  const detector = new globalThis.BarcodeDetector({ formats: ['qr_code'] });
  const bitmap = await createImageBitmap(file);
  try {
    const codes = await detector.detect(bitmap);
    const value = codes[0]?.rawValue;
    if (!value) throw new Error('No QR code found in image');
    return value;
  } finally {
    bitmap.close();
  }
}

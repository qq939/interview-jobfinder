import { readFileSync } from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const data = new Uint8Array(readFileSync('uploads/______________________________2025_11_4.pdf'));
const pdf = await getDocument({ data }).promise;
let text = '';

for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i);
  const content = await page.getTextContent();
  text += content.items.map(item => item.str).join(' ') + '\n';
}

console.log(text);

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyWebsiteTextStyle,
  getWebsiteTextAlignment,
  getWebsiteTextStyleAt,
  parseWebsiteRichText,
  serializeWebsiteRichText,
  setWebsiteTextAlignment,
  updateWebsiteRichTextText,
  websiteRichTextToPlainText,
} from '../lib/website-rich-text-format.ts';

test('selection formatting affects only selected text and preserves the visible copy', () => {
  const formatted = applyWebsiteTextStyle('Shop by store', 8, 13, { color: '#ff2233', size: 24, font: 'Helvetica', bold: true });
  assert.equal(websiteRichTextToPlainText(formatted), 'Shop by store');
  assert.match(formatted, /\[style font="Helvetica" size="24" color="#ff2233" bold="1"\]store\[\/style\]/);
  assert.equal(websiteRichTextToPlainText(formatted.slice(0, formatted.indexOf('[style'))), 'Shop by ');
});

test('editing plain copy keeps formatting on unchanged fragments', () => {
  const formatted = applyWebsiteTextStyle('Hello world', 6, 11, { italic: true });
  const edited = updateWebsiteRichTextText(formatted, 'Hello world!');
  assert.equal(websiteRichTextToPlainText(edited), 'Hello world!');
  assert.match(edited, /\[style italic="1"\]world\[\/style\]/);
});

test('font and size changes replace earlier values on the selected text', () => {
  const initial = applyWebsiteTextStyle('Hello world', 6, 11, { font: 'Arial', size: 12, color: '#ff2233', bold: true });
  const updated = applyWebsiteTextStyle(initial, 6, 11, { font: 'Georgia', size: 32 });
  assert.equal(websiteRichTextToPlainText(updated), 'Hello world');
  assert.deepEqual(getWebsiteTextStyleAt(updated, 6), { font: 'Georgia', size: 32, color: '#ff2233', bold: true });
  assert.deepEqual(getWebsiteTextStyleAt(updated, 0), {});
  assert.match(updated, /\[style font="Georgia" size="32" color="#ff2233" bold="1"\]world\[\/style\]/);
});

test('a new font or size applies across mixed existing styles without changing unselected text', () => {
  const first = applyWebsiteTextStyle('Hello world', 0, 5, { font: 'Arial', size: 12 });
  const mixed = applyWebsiteTextStyle(first, 6, 11, { font: 'Helvetica', size: 18 });
  const updated = applyWebsiteTextStyle(mixed, 0, 11, { font: 'Georgia', size: 28 });
  assert.equal(websiteRichTextToPlainText(updated), 'Hello world');
  assert.deepEqual(getWebsiteTextStyleAt(updated, 0), { font: 'Georgia', size: 28 });
  assert.deepEqual(getWebsiteTextStyleAt(updated, 8), { font: 'Georgia', size: 28 });
});

test('the color picker replaces only the selected color and preserves font, size and bold', () => {
  const initial = applyWebsiteTextStyle('Shop now', 0, 4, { font: 'Georgia', size: 32, color: '#ff2233', bold: true });
  const recolored = applyWebsiteTextStyle(initial, 0, 4, { color: '#00aa44' });
  assert.deepEqual(getWebsiteTextStyleAt(recolored, 0), { font: 'Georgia', size: 32, color: '#00aa44', bold: true });
  assert.deepEqual(getWebsiteTextStyleAt(recolored, 5), {});
  assert.equal(websiteRichTextToPlainText(recolored), 'Shop now');
});

test('the bold control toggles on and off without changing selected color or size', () => {
  const initial = applyWebsiteTextStyle('Shop now', 0, 4, { size: 20, color: '#1554d1', bold: true });
  const regular = applyWebsiteTextStyle(initial, 0, 4, { bold: false });
  assert.deepEqual(getWebsiteTextStyleAt(regular, 0), { size: 20, color: '#1554d1', bold: false });
  const bold = applyWebsiteTextStyle(regular, 0, 4, { bold: true });
  assert.deepEqual(getWebsiteTextStyleAt(bold, 0), { size: 20, color: '#1554d1', bold: true });
  assert.deepEqual(getWebsiteTextStyleAt(bold, 5), {});
});

test('field alignment is retained while inline formatting changes', () => {
  const centered = setWebsiteTextAlignment('A centered heading', 'center');
  assert.equal(getWebsiteTextAlignment(centered), 'center');
  const formatted = applyWebsiteTextStyle(centered, 2, 10, { underline: true });
  assert.equal(getWebsiteTextAlignment(formatted), 'center');
  assert.equal(websiteRichTextToPlainText(formatted), 'A centered heading');
  assert.match(formatted, /^\[align=center\]/);
});

test('the formatter allows only safe fonts and colors when parsing saved styles', () => {
  const nodes = parseWebsiteRichText('[style font="Arial" color="#abcdef" size="22" bold="1"]Safe[/style][style font="url(javascript:alert(1))" color="red"]text[/style]');
  const serialized = serializeWebsiteRichText(nodes);
  assert.match(serialized, /font="Arial"/);
  assert.doesNotMatch(serialized, /javascript|color="red"/);
  assert.equal(websiteRichTextToPlainText(serialized), 'Safetext');
});

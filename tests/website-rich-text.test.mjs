import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyWebsiteTextStyle,
  getWebsiteTextAlignment,
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

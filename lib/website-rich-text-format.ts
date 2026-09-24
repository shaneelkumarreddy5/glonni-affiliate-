export const WEBSITE_TEXT_FONTS = ['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Trebuchet MS', 'system-ui'] as const;
export type WebsiteTextFont = typeof WEBSITE_TEXT_FONTS[number];
export type WebsiteTextAlignment = 'left' | 'center' | 'right' | 'justify';
export type WebsiteInlineTextStyle = { font?: WebsiteTextFont; size?: number; color?: string; bold?: boolean; italic?: boolean; underline?: boolean };
export type WebsiteRichTextNode =
  | { type: 'text'; value: string }
  | { type: 'style'; style: WebsiteInlineTextStyle; children: WebsiteRichTextNode[] }
  | { type: 'align'; alignment: WebsiteTextAlignment; children: WebsiteRichTextNode[] };

type OpenNode = { node: Exclude<WebsiteRichTextNode, { type: 'text' }>; closeToken: string; marker?: boolean };
const tokenPattern = /\[style\s+[^\]]*\]|\[\/style\]|\[align=(?:left|center|right|justify)\]|\[\/align\]|\[color=#[0-9a-fA-F]{6}\]|\[\/color\]|\*\*|__|\*/g;

function decodeText(value: string) {
  return value.replace(/&amp;|&#91;|&#93;/g, (entity) => entity === '&amp;' ? '&' : entity === '&#91;' ? '[' : ']');
}

function encodeText(value: string) {
  return value.replace(/&/g, '&amp;').replace(/\[/g, '&#91;').replace(/\]/g, '&#93;');
}

function parseStyleAttributes(value: string): WebsiteInlineTextStyle {
  const style: WebsiteInlineTextStyle = {};
  const attributes = /([a-z]+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = attributes.exec(value))) {
    const [, key, raw] = match;
    if (key === 'font' && WEBSITE_TEXT_FONTS.includes(raw as WebsiteTextFont)) style.font = raw as WebsiteTextFont;
    else if (key === 'size' && /^\d{1,3}$/.test(raw)) style.size = Math.max(8, Math.min(96, Number(raw)));
    else if (key === 'color' && /^#[0-9a-fA-F]{6}$/.test(raw)) style.color = raw;
    else if (key === 'bold' && (raw === '0' || raw === '1')) style.bold = raw === '1';
    else if (key === 'italic' && (raw === '0' || raw === '1')) style.italic = raw === '1';
    else if (key === 'underline' && (raw === '0' || raw === '1')) style.underline = raw === '1';
  }
  return style;
}

export function parseWebsiteRichText(value: string): WebsiteRichTextNode[] {
  const root: WebsiteRichTextNode[] = [];
  const stack: { children: WebsiteRichTextNode[]; open?: OpenNode }[] = [{ children: root }];
  const pushText = (text: string) => {
    if (text) stack[stack.length - 1].children.push({ type: 'text', value: decodeText(text) });
  };
  const open = (node: OpenNode['node'], closeToken: string, marker = false) => {
    const children: WebsiteRichTextNode[] = [];
    const wrapped = { ...node, children } as WebsiteRichTextNode;
    stack[stack.length - 1].children.push(wrapped);
    stack.push({ children, open: { node, closeToken, marker } });
  };
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = tokenPattern.exec(value))) {
    pushText(value.slice(cursor, match.index));
    const token = match[0];
    const top = stack[stack.length - 1].open;
    if (token === '**' || token === '__' || token === '*') {
      if (top?.marker && top.closeToken === token) stack.pop();
      else open({ type: 'style', style: token === '**' ? { bold: true } : token === '__' ? { underline: true } : { italic: true }, children: [] }, token, true);
    } else if (token === '[/style]' || token === '[/color]' || token === '[/align]') {
      if (top?.closeToken === token) stack.pop();
      else pushText(token);
    } else if (token.startsWith('[style')) {
      open({ type: 'style', style: parseStyleAttributes(token.slice(6, -1)), children: [] }, '[/style]');
    } else if (token.startsWith('[color=')) {
      open({ type: 'style', style: { color: token.slice(7, -1) }, children: [] }, '[/color]');
    } else {
      const alignment = token.slice(7, -1) as WebsiteTextAlignment;
      open({ type: 'align', alignment, children: [] }, '[/align]');
    }
    cursor = tokenPattern.lastIndex;
  }
  pushText(value.slice(cursor));
  return root;
}

function childrenOf(node: WebsiteRichTextNode) {
  return node.type === 'text' ? [] : node.children;
}

function textLength(nodes: WebsiteRichTextNode[]): number {
  return nodes.reduce((total, node) => total + (node.type === 'text' ? node.value.length : textLength(node.children)), 0);
}

function plainText(nodes: WebsiteRichTextNode[]): string {
  return nodes.map((node) => node.type === 'text' ? node.value : plainText(node.children)).join('');
}

export function websiteRichTextToPlainText(value: string) {
  return plainText(parseWebsiteRichText(value));
}

function styleAttributes(style: WebsiteInlineTextStyle) {
  const attributes: string[] = [];
  if (style.font && WEBSITE_TEXT_FONTS.includes(style.font)) attributes.push(`font="${style.font}"`);
  if (Number.isFinite(style.size)) attributes.push(`size="${Math.max(8, Math.min(96, Math.round(style.size!)))}"`);
  if (style.color && /^#[0-9a-fA-F]{6}$/.test(style.color)) attributes.push(`color="${style.color}"`);
  if (style.bold !== undefined) attributes.push(`bold="${style.bold ? 1 : 0}"`);
  if (style.italic !== undefined) attributes.push(`italic="${style.italic ? 1 : 0}"`);
  if (style.underline !== undefined) attributes.push(`underline="${style.underline ? 1 : 0}"`);
  return attributes.join(' ');
}

export function serializeWebsiteRichText(nodes: WebsiteRichTextNode[]): string {
  return nodes.map((node) => {
    if (node.type === 'text') return encodeText(node.value);
    const children = serializeWebsiteRichText(node.children);
    if (node.type === 'align') return `[align=${node.alignment}]${children}[/align]`;
    const attributes = styleAttributes(node.style);
    return attributes ? `[style ${attributes}]${children}[/style]` : children;
  }).join('');
}

function cloneWithChildren(node: Exclude<WebsiteRichTextNode, { type: 'text' }>, children: WebsiteRichTextNode[]): WebsiteRichTextNode | null {
  return textLength(children) ? { ...node, children } : null;
}

function splitNodesAt(nodes: WebsiteRichTextNode[], offset: number): [WebsiteRichTextNode[], WebsiteRichTextNode[]] {
  const left: WebsiteRichTextNode[] = [];
  const right: WebsiteRichTextNode[] = [];
  let consumed = 0;
  for (const node of nodes) {
    const length = node.type === 'text' ? node.value.length : textLength(node.children);
    if (consumed >= offset) right.push(node);
    else if (consumed + length <= offset) left.push(node);
    else if (node.type === 'text') {
      const split = Math.max(0, offset - consumed);
      if (split) left.push({ type: 'text', value: node.value.slice(0, split) });
      if (split < length) right.push({ type: 'text', value: node.value.slice(split) });
    } else {
      const [first, second] = splitNodesAt(node.children, offset - consumed);
      const firstNode = cloneWithChildren(node, first);
      const secondNode = cloneWithChildren(node, second);
      if (firstNode) left.push(firstNode);
      if (secondNode) right.push(secondNode);
    }
    consumed += length;
  }
  return [left, right];
}

function withoutRootAlignment(nodes: WebsiteRichTextNode[]) {
  if (nodes.length === 1 && nodes[0].type === 'align') return { alignment: nodes[0].alignment, children: [...nodes[0].children] };
  return { alignment: 'left' as const, children: nodes };
}

function withRootAlignment(nodes: WebsiteRichTextNode[], alignment: WebsiteTextAlignment) {
  return alignment === 'left' ? nodes : [{ type: 'align' as const, alignment, children: nodes }];
}

export function getWebsiteTextAlignment(value: string): WebsiteTextAlignment {
  const nodes = parseWebsiteRichText(value);
  return nodes.length === 1 && nodes[0].type === 'align' ? nodes[0].alignment : 'left';
}

export function setWebsiteTextAlignment(value: string, alignment: WebsiteTextAlignment) {
  const parsed = withoutRootAlignment(parseWebsiteRichText(value));
  return serializeWebsiteRichText(withRootAlignment(parsed.children, alignment));
}

export function getWebsiteTextStyleAt(value: string, offset: number): WebsiteInlineTextStyle {
  const nodes = parseWebsiteRichText(value);
  const length = textLength(nodes);
  const target = Math.max(0, Math.min(Math.max(0, length - 1), offset));
  let cursor = 0;
  let found: WebsiteInlineTextStyle = {};
  const visit = (children: WebsiteRichTextNode[], inherited: WebsiteInlineTextStyle) => {
    for (const node of children) {
      const length = node.type === 'text' ? node.value.length : textLength(node.children);
      if (node.type === 'text') {
        if (target >= cursor && target < cursor + length) { found = inherited; return true; }
        cursor += length;
      } else {
        const next = node.type === 'style' ? { ...inherited, ...node.style } : inherited;
        if (visit(node.children, next)) return true;
      }
    }
    return false;
  };
  visit(nodes, {});
  return found;
}

export function applyWebsiteTextStyle(value: string, start: number, end: number, patch: WebsiteInlineTextStyle) {
  const parsed = withoutRootAlignment(parseWebsiteRichText(value));
  const visibleLength = textLength(parsed.children);
  const from = Math.max(0, Math.min(visibleLength, start));
  const to = Math.max(from, Math.min(visibleLength, end));
  if (from === to) return value;
  const [throughEnd, after] = splitNodesAt(parsed.children, to);
  const [before, selected] = splitNodesAt(throughEnd, from);
  const formatted: WebsiteRichTextNode[] = [...before, { type: 'style', style: patch, children: selected }, ...after];
  return serializeWebsiteRichText(withRootAlignment(formatted, parsed.alignment));
}

export function updateWebsiteRichTextText(value: string, nextText: string) {
  const parsed = withoutRootAlignment(parseWebsiteRichText(value));
  const previousText = plainText(parsed.children);
  if (previousText === nextText) return value;
  let prefix = 0;
  while (prefix < previousText.length && prefix < nextText.length && previousText[prefix] === nextText[prefix]) prefix++;
  let suffix = 0;
  while (suffix < previousText.length - prefix && suffix < nextText.length - prefix && previousText[previousText.length - suffix - 1] === nextText[nextText.length - suffix - 1]) suffix++;
  const [throughChange, after] = splitNodesAt(parsed.children, previousText.length - suffix);
  const [before] = splitNodesAt(throughChange, prefix);
  const inserted = nextText.slice(prefix, nextText.length - suffix);
  const updated: WebsiteRichTextNode[] = [...before, ...(inserted ? [{ type: 'text' as const, value: inserted }] : []), ...after];
  return serializeWebsiteRichText(withRootAlignment(updated, parsed.alignment));
}

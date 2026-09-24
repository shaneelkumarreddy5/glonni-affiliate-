import type { CSSProperties, ReactNode } from 'react';
import { parseWebsiteRichText, type WebsiteRichTextNode } from './website-rich-text-format';

function renderNodes(nodes: WebsiteRichTextNode[], parentKey: string): ReactNode[] {
  const output: ReactNode[] = [];
  nodes.forEach((node, index) => {
    const key = `${parentKey}-${index}`;
    if (node.type === 'text') {
      node.value.split('\n').forEach((line, lineIndex) => {
        if (lineIndex) output.push(<br key={`${key}-br-${lineIndex}`}/>);
        if (line) output.push(line);
      });
    } else if (node.type === 'align') {
      output.push(<span key={key} style={{ display: 'block', textAlign: node.alignment }}>{renderNodes(node.children, key)}</span>);
    } else {
      const style: CSSProperties = {};
      if (node.style.font) style.fontFamily = node.style.font;
      if (node.style.size) style.fontSize = `${node.style.size}px`;
      if (node.style.color) style.color = node.style.color;
      if (node.style.bold !== undefined) style.fontWeight = node.style.bold ? 700 : 400;
      if (node.style.italic !== undefined) style.fontStyle = node.style.italic ? 'italic' : 'normal';
      if (node.style.underline !== undefined) style.textDecoration = node.style.underline ? 'underline' : 'none';
      output.push(<span key={key} style={style}>{renderNodes(node.children, key)}</span>);
    }
  });
  return output;
}

/** Render only the explicitly supported, sanitized formatting language used by the website editor. */
export function renderWebsiteRichText(value: string): ReactNode[] {
  return renderNodes(parseWebsiteRichText(value), 'rich');
}

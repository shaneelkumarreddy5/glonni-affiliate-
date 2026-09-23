import type { ReactNode } from 'react';

/** Render only the small, explicitly supported formatting language used by the website editor. */
export function renderWebsiteRichText(value: string): ReactNode[] {
  const pattern = /\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|\*([\s\S]+?)\*|\[color=(#[0-9a-fA-F]{6})\]([\s\S]+?)\[\/color\]/g;
  const result: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  const pushText = (text: string, key: string) => {
    text.split('\n').forEach((line, index) => {
      if (index) result.push(<br key={`${key}-br-${index}`}/>);
      if (line) result.push(<span key={`${key}-text-${index}`}>{line}</span>);
    });
  };
  while ((match = pattern.exec(value))) {
    if (match.index > cursor) pushText(value.slice(cursor, match.index), `plain-${cursor}`);
    if (match[1]) result.push(<strong key={`bold-${match.index}`}>{match[1]}</strong>);
    else if (match[2]) result.push(<u key={`underline-${match.index}`}>{match[2]}</u>);
    else if (match[3]) result.push(<em key={`italic-${match.index}`}>{match[3]}</em>);
    else if (match[4] && match[5]) result.push(<span key={`color-${match.index}`} style={{ color: match[4] }}>{match[5]}</span>);
    cursor = pattern.lastIndex;
  }
  if (cursor < value.length) pushText(value.slice(cursor), `plain-${cursor}`);
  return result;
}

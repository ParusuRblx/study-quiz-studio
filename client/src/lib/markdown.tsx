import type { ReactNode } from "react";

const safeHref = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
};

function inlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\([^\s)]+\))/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const token = match[0];
    if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("~~")) {
      nodes.push(<del key={key++}>{token.slice(2, -2)}</del>);
    } else if (token.startsWith("`")) {
      nodes.push(<code key={key++} className="rounded bg-black/25 px-1.5 py-0.5 text-[0.9em]">{token.slice(1, -1)}</code>);
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
      const href = link ? safeHref(link[2]) : null;
      nodes.push(href && link ? <a key={key++} href={href} target="_blank" rel="noreferrer" className="text-sky-300 underline underline-offset-2">{link[1]}</a> : token);
    }
    cursor = match.index + token.length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

export function MarkdownText({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(<p key={key++}>{paragraph.flatMap((line, index) => index ? [<br key={`${key}-${index}`} />, ...inlineMarkdown(line)] : inlineMarkdown(line))}</p>);
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    blocks.push(<ul key={key++} className="list-disc space-y-1 pl-5">{list.map((item) => <li key={`${key}-${item}`}>{inlineMarkdown(item)}</li>)}</ul>);
    list = [];
  };

  lines.forEach((line) => {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const item = line.match(/^\s*[-*+]\s+(.+)$/);
    if (!line.trim()) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      const Tag = heading[1].length === 1 ? "h2" : heading[1].length === 2 ? "h3" : "h4";
      blocks.push(<Tag key={key++} className="font-semibold">{inlineMarkdown(heading[2])}</Tag>);
    } else if (item) {
      flushParagraph();
      list.push(item[1]);
    } else {
      flushList();
      paragraph.push(line);
    }
  });
  flushParagraph();
  flushList();

  return <div className={`space-y-3 ${className}`}>{blocks}</div>;
}

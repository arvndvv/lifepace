import { Fragment, useMemo } from 'react';
import type { ReactNode } from 'react';

interface MarkdownContentProps {
  content: string | undefined;
  className?: string;
}

type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'strong'; value: string }
  | { type: 'em'; value: string }
  | { type: 'code'; value: string }
  | { type: 'link'; label: string; href: string };

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^\s)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    const fragment = match[0];
    if (fragment.startsWith('**') && fragment.endsWith('**')) {
      tokens.push({ type: 'strong', value: fragment.slice(2, -2) });
    } else if (fragment.startsWith('*') && fragment.endsWith('*')) {
      tokens.push({ type: 'em', value: fragment.slice(1, -1) });
    } else if (fragment.startsWith('`') && fragment.endsWith('`')) {
      tokens.push({ type: 'code', value: fragment.slice(1, -1) });
    } else if (fragment.startsWith('[') && fragment.includes('](') && fragment.endsWith(')')) {
      const closingLabel = fragment.indexOf('](');
      const label = fragment.slice(1, closingLabel);
      const href = fragment.slice(closingLabel + 2, -1);
      tokens.push({ type: 'link', label, href });
    } else {
      tokens.push({ type: 'text', value: fragment });
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return tokens;
}

function InlineRenderer({ tokens }: { tokens: InlineToken[] }) {
  return (
    <>
      {tokens.map((token, index) => {
        if (token.type === 'text') {
          return <Fragment key={index}>{token.value}</Fragment>;
        }
        if (token.type === 'strong') {
          return (
            <strong key={index} className="font-semibold text-slate-200">
              {token.value}
            </strong>
          );
        }
        if (token.type === 'em') {
          return (
            <em key={index} className="italic text-slate-200">
              {token.value}
            </em>
          );
        }
        if (token.type === 'code') {
          return (
            <code
              key={index}
              className="rounded bg-slate-800 px-1.5 py-0.5 text-[13px] text-slate-200"
            >
              {token.value}
            </code>
          );
        }
        return (
          <a
            key={index}
            href={token.href}
            target="_blank"
            rel="noreferrer"
            className="text-[color:var(--accent-300)] hover:underline"
          >
            {token.label}
          </a>
        );
      })}
    </>
  );
}

function renderMarkdownBlocks(markdown: string) {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const elements: ReactNode[] = [];
  let i = 0;

  const flushList = (items: string[], ordered: boolean) => {
    if (items.length === 0) {
      return;
    }
    const Component = ordered ? 'ol' : 'ul';
    elements.push(
      <Component key={`list-${elements.length}`} className="ml-5 space-y-1 marker:text-slate-400">
        {items.map((line, index) => (
          <li key={index} className="text-sm text-slate-200">
            <InlineRenderer tokens={parseInline(line)} />
          </li>
        ))}
      </Component>
    );
  };

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) {
        i += 1; // skip closing
      }
      elements.push(
        <pre
          key={`code-${elements.length}`}
          className="overflow-auto rounded-xl bg-slate-950/70 p-3 text-xs text-slate-200"
        >
          <code data-language={language}>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const Heading = (`h${Math.min(level + 2, 6)}` as keyof JSX.IntrinsicElements);
      elements.push(
        <Heading key={`heading-${elements.length}`} className="font-semibold text-slate-100">
          <InlineRenderer tokens={parseInline(text)} />
        </Heading>
      );
      i += 1;
      continue;
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        listItems.push(lines[i].slice(2));
        i += 1;
      }
      flushList(listItems, false);
      continue;
    }

    const orderedMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      flushList(items, true);
      continue;
    }

    if (line.startsWith('>')) {
      const quoteLines: string[] = [line.replace(/^>\s?/, '')];
      i += 1;
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      elements.push(
        <blockquote
          key={`quote-${elements.length}`}
          className="border-l-2 border-slate-700 pl-4 text-sm text-slate-300"
        >
          {quoteLines.map((quoteLine, index) => (
            <p key={index} className="mb-2 last:mb-0">
              <InlineRenderer tokens={parseInline(quoteLine)} />
            </p>
          ))}
        </blockquote>
      );
      continue;
    }

    // Paragraph
    const paragraphLines: string[] = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !lines[i].match(/^(#{1,6})\s+/) && !lines[i].startsWith('```') && !lines[i].startsWith('- ') && !lines[i].startsWith('* ') && !/^\d+\.\s+/.test(lines[i]) && !lines[i].startsWith('>')) {
      paragraphLines.push(lines[i]);
      i += 1;
    }
    const paragraph = paragraphLines.join(' ');
    elements.push(
      <p key={`paragraph-${elements.length}`} className="text-sm leading-relaxed text-slate-200">
        <InlineRenderer tokens={parseInline(paragraph)} />
      </p>
    );
  }

  return elements.length > 0 ? elements : null;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const rendered = useMemo(() => {
    if (!content || !content.trim()) {
      return null;
    }
    return renderMarkdownBlocks(content.trim());
  }, [content]);

  if (!rendered) {
    return null;
  }

  return <div className={className ?? 'space-y-3'}>{rendered}</div>;
}

export function MarkdownPlaceholder({ message }: { message: string }) {
  return <p className="text-sm text-slate-500">{message}</p>;
}

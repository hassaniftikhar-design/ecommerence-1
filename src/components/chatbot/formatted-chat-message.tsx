import React from 'react';

interface FormattedChatMessageProps {
  content: string;
  isAssistant?: boolean;
}

/**
 * Parses inline markdown: **bold**, *italic*, and `code`
 */
function parseInlineMarkdown(text: string, isAssistant: boolean): React.ReactNode[] {
  // Regex to match **bold**, *italic*, `code`
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const inner = part.slice(2, -2);
      return (
        <strong
          key={index}
          className={isAssistant ? 'font-semibold text-slate-900' : 'font-bold text-white'}
        >
          {inner}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      const inner = part.slice(1, -1);
      return (
        <code
          key={index}
          className={
            isAssistant
              ? 'rounded bg-slate-100 px-1 py-0.5 font-mono text-xs text-blue-700'
              : 'rounded bg-blue-700 px-1 py-0.5 font-mono text-xs text-blue-100'
          }
        >
          {inner}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      const inner = part.slice(1, -1);
      return <em key={index}>{inner}</em>;
    }
    return part;
  });
}

export function FormattedChatMessage({ content, isAssistant = true }: FormattedChatMessageProps) {
  if (!content) return null;

  const lines = content.split('\n');

  return (
    <div className="space-y-1.5 leading-relaxed">
      {lines.map((line, lineIndex) => {
        const trimmed = line.trim();

        // Empty line spacer
        if (!trimmed) {
          return <div key={lineIndex} className="h-1" />;
        }

        // Sub-details / inner lines:
        // Either indented with spaces/tab (e.g. "  - Customer:", "  Date:")
        // OR starts with a dash without bold markup (e.g. "- Customer:")
        const isIndented = /^(\s{2,}|\t)/.test(line);
        const isSubDash = /^-\s+/.test(trimmed) && !trimmed.startsWith('- **');

        if (isIndented || isSubDash) {
          const subContent = line.replace(/^\s*[-•*]?\s*/, '');
          return (
            <div
              key={lineIndex}
              className={`pl-5 text-xs sm:text-[13px] ${
                isAssistant ? 'text-slate-600' : 'text-blue-100'
              }`}
            >
              {parseInlineMarkdown(subContent, isAssistant)}
            </div>
          );
        }

        // Main top-level bullet point lines: starting with • or * or - **
        if (/^[•*]\s+/.test(trimmed) || /^-\s+\*\*/.test(trimmed)) {
          const bulletContent = trimmed.replace(/^[•*]\s+/, '').replace(/^-\s+/, '');
          return (
            <div key={lineIndex} className="flex items-start gap-2 pl-0.5">
              <span
                className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${
                  isAssistant ? 'bg-blue-600' : 'bg-white'
                }`}
              />
              <span className="flex-1 min-w-0">
                {parseInlineMarkdown(bulletContent, isAssistant)}
              </span>
            </div>
          );
        }

        // Numbered list items: e.g. "1. "
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          const [, num, numContent] = numMatch;
          return (
            <div key={lineIndex} className="flex items-start gap-1.5 pl-0.5">
              <span
                className={`font-semibold text-xs min-w-4 shrink-0 mt-0.5 ${
                  isAssistant ? 'text-blue-600' : 'text-blue-200'
                }`}
              >
                {num}.
              </span>
              <span className="flex-1 min-w-0">
                {parseInlineMarkdown(numContent || '', isAssistant)}
              </span>
            </div>
          );
        }

        // Section header lines: starting with ### or ##
        if (/^#{1,3}\s+/.test(trimmed)) {
          const headerContent = trimmed.replace(/^#{1,3}\s+/, '');
          return (
            <div
              key={lineIndex}
              className={`font-bold text-sm pt-1 ${
                isAssistant ? 'text-slate-900' : 'text-white'
              }`}
            >
              {parseInlineMarkdown(headerContent, isAssistant)}
            </div>
          );
        }

        // Regular paragraph / text line
        return (
          <p key={lineIndex} className="break-words">
            {parseInlineMarkdown(line, isAssistant)}
          </p>
        );
      })}
    </div>
  );
}

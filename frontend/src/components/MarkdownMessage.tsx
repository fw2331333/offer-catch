import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  content: string;
  className?: string;
}

const proseClass =
  "prose prose-pretext max-w-none prose-headings:scroll-mt-20 prose-a:font-medium prose-pre:shadow-inner";

export default function MarkdownMessage({ content, className = "" }: Props) {
  return (
    <div className={`${proseClass} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 underline decoration-brand-300/60 underline-offset-2 hover:text-brand-700"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-left font-semibold text-gray-800">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-gray-100 px-3 py-2 text-gray-700">{children}</td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-brand-200 bg-brand-50/40 pl-4 py-1 not-italic text-gray-700">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-6 border-gray-200" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

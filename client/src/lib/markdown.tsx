import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`whitespace-pre-wrap [&_a]:text-sky-300 [&_a]:underline [&_a]:underline-offset-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-zinc-950 [&_pre]:p-4 [&_pre]:text-sm [&_code]:font-mono [&_li]:my-1 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

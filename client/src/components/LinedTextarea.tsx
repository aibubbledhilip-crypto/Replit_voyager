import { useRef, forwardRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface LinedTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
}

const LINE_HEIGHT = 21;

const LinedTextarea = forwardRef<HTMLTextAreaElement, LinedTextareaProps>(
  ({ value = "", className, style, onScroll, ...props }, forwardedRef) => {
    const gutterRef = useRef<HTMLDivElement>(null);

    const mergedRef = useCallback(
      (node: HTMLTextAreaElement | null) => {
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef)
          (forwardedRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
      },
      [forwardedRef]
    );

    const lineCount = Math.max(value.split("\n").length, 1);
    const gutterWidth = lineCount >= 1000 ? "3.5rem" : lineCount >= 100 ? "3rem" : lineCount >= 10 ? "2.5rem" : "2rem";

    const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
      if (gutterRef.current) {
        gutterRef.current.scrollTop = e.currentTarget.scrollTop;
      }
      onScroll?.(e);
    };

    return (
      <div className={cn("flex border border-input rounded-md overflow-hidden bg-background focus-within:ring-1 focus-within:ring-ring", className)}>
        <div
          ref={gutterRef}
          aria-hidden="true"
          className="flex-shrink-0 select-none overflow-hidden bg-muted/40 border-r border-border pt-2 pb-2"
          style={{ width: gutterWidth }}
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div
              key={i}
              className="text-xs text-muted-foreground font-mono text-right pr-2"
              style={{ lineHeight: `${LINE_HEIGHT}px`, height: LINE_HEIGHT }}
            >
              {i + 1}
            </div>
          ))}
        </div>
        <textarea
          ref={mergedRef}
          value={value}
          onScroll={handleScroll}
          style={{ lineHeight: `${LINE_HEIGHT}px`, ...style }}
          className="flex-1 resize-none bg-transparent px-3 py-2 text-sm font-mono focus:outline-none"
          {...props}
        />
      </div>
    );
  }
);

LinedTextarea.displayName = "LinedTextarea";
export default LinedTextarea;

interface ReadingForestBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

const ReadingForestBackground = ({ children, className = "" }: ReadingForestBackgroundProps) => (
  <div className={`reading-forest relative isolate overflow-hidden ${className}`}>
    <div className="forest-glow forest-glow-one" aria-hidden="true" />
    <div className="forest-glow forest-glow-two" aria-hidden="true" />
    <div className="forest-leaf forest-leaf-one" aria-hidden="true">✦</div>
    <div className="forest-leaf forest-leaf-two" aria-hidden="true">✦</div>
    <div className="relative z-10">{children}</div>
  </div>
);

export default ReadingForestBackground;
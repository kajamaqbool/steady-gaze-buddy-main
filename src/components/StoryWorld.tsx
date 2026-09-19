import type { ReactNode } from "react";

interface StoryWorldProps {
  children: ReactNode;
  className?: string;
}

const StoryWorld = ({ children, className = "" }: StoryWorldProps) => (
  <div className={`story-world ${className}`}>
    <div className="story-world-sky" aria-hidden="true">
      <span className="story-star story-star-one">✦</span>
      <span className="story-star story-star-two">✦</span>
      <span className="story-star story-star-three">·</span>
      <span className="story-firefly story-firefly-one" />
      <span className="story-firefly story-firefly-two" />
      <span className="story-firefly story-firefly-three" />
      <span className="story-path" />
    </div>
    <div className="relative z-10 min-h-full">{children}</div>
  </div>
);

export default StoryWorld;
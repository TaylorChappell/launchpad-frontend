export function PageBubbles({ count = 12 }: { count?: number }) {
  return <div className="page-bubbles" aria-hidden="true">
    {Array.from({ length: count }, (_, index) => <i key={index}/>) }
  </div>;
}

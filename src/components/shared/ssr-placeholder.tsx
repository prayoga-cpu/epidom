/**
 * SSR Placeholder Component
 *
 * A reusable placeholder for client-side components during SSR.
 * Prevents hydration mismatch by showing a minimal placeholder
 * until the component is mounted on the client.
 *
 * @example
 * ```tsx
 * if (!mounted) {
 *   return <SSRPlaceholder height="500px" className="bg-gray-50" />;
 * }
 * ```
 *
 * @component
 */

interface SSRPlaceholderProps {
  /** Height of the placeholder (CSS value) */
  height: string;
  /** Optional additional className for the section wrapper */
  className?: string;
}

export function SSRPlaceholder({ height, className = "" }: SSRPlaceholderProps) {
  return (
    <section className={`relative overflow-hidden ${className}`}>
      <div style={{ height }} />
    </section>
  );
}

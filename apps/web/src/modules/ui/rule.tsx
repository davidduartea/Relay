/** El trazo índigo que separa un título de lo que viene debajo. */
export function Rule({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`bg-blue block h-0.5 w-6 ${className}`} />;
}

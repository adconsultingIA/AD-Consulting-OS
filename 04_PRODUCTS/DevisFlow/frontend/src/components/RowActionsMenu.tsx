import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type RowActionsMenuProps = {
  children: ReactNode;
  label?: string;
};

export default function RowActionsMenu({
  children,
  label = "Plus d’actions",
}: RowActionsMenuProps) {
  const [open, setOpen] = useState(false);

  const containerRef =
    useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(
      event: MouseEvent
    ) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown
    );

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="row-actions-menu"
    >
      <button
        type="button"
        className="row-actions-menu-trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        onClick={() =>
          setOpen((current) => !current)
        }
      >
        <span aria-hidden="true">•••</span>
      </button>

      {open && (
        <div
          className="row-actions-menu-popover"
          role="menu"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

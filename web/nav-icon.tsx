/** Identical geometry for outline/fill variants; selection never swaps silhouettes. */
export function NavIcon({
  name,
  selected = false,
}: {
  name: "inventory" | "offers" | "sales" | "account";
  selected?: boolean;
}) {
  const detail = selected ? "nav-cutout" : undefined;
  const shapes = {
    inventory: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="4" />
        <path className={detail} fill="none" d="M8 8h8M8 12h8M8 16h4" />
      </>
    ),
    offers: (
      <>
        <path d="M14 4H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-7" />
        <path
          className={selected ? "nav-pencil-fill" : undefined}
          d="m12 12 1-4 6-6 3 3-6 6-4 1Z"
        />
        <path className={detail} fill="none" d="m16 5 3 3" />
      </>
    ),
    sales: (
      <>
        <rect x="4" y="11" width="4" height="10" rx="1" />
        <rect x="10" y="7" width="4" height="14" rx="1" />
        <rect x="16" y="3" width="4" height="18" rx="1" />
      </>
    ),
    account: (
      <>
        <circle cx="12" cy="12" r="9.5" />
        <circle
          className={selected ? "nav-person-cutout" : undefined}
          cx="12"
          cy="9"
          r="3"
        />
        <path
          className={selected ? "nav-person-cutout" : undefined}
          d="M5.3 18.6c.8-3 3.2-4.6 6.7-4.6s5.9 1.6 6.7 4.6A9.4 9.4 0 0 1 12 21.5a9.4 9.4 0 0 1-6.7-2.9Z"
        />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={selected ? "nav-icon is-selected" : "nav-icon"}
      fill={selected ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {shapes[name]}
    </svg>
  );
}

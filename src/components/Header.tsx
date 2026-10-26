import type { ReactNode } from "react";

/** Page title with breadcrumb, optional subtitle and an action area on the right. */
export function Header({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="heading">
      <div>
        <div className="breadcrumb">Systemprüfung · Entgeltersatzleistungen (DTA EEL)</div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

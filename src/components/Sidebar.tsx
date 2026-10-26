import React from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, FileText, FlaskConical, CheckCircle2, Library, Network } from "lucide-react";

export function Sidebar() {
  const links = [
    ["/", "Overview", LayoutDashboard],
    ["/requirements", "Requirements & rules", FileText],
    ["/tests", "Test cases", FlaskConical],
    ["/validation", "Validation & report", CheckCircle2],
    ["/library", "Specification library", Library],
    ["/graph", "Ontology & knowledge graph", Network],
  ] as const;
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brandmark">R</span>
        <div>
          <strong>Review Assistant</strong>
          <small>System review · EEL</small>
        </div>
      </div>
      <nav>
        {links.map(([path, label, Icon], i) => (
          <React.Fragment key={path}>
            {i === 4 && <div className="navlabel">KNOWLEDGE</div>}
            <NavLink
              end={path === "/"}
              to={path}
              className={({ isActive }) =>
                "navlink " + (isActive ? "active" : "")
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          </React.Fragment>
        ))}
      </nav>
      <div className="account">
        <span className="avatar">SE</span>
        <div>
          System examiner<small>ITSG</small>
        </div>
      </div>
    </aside>
  );
}

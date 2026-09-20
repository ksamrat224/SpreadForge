"use client";
import { IconChevronDown } from "@tabler/icons-react";
import { useCluster, CLUSTERS } from "./cluster-context";
import type { ClusterMoniker } from "../lib/solana-client";
export function ClusterSelect() {
  const { cluster, setCluster } = useCluster();
  return (
    <label className="cluster-select">
      <span className="status-dot" />
      <select
        aria-label="Solana cluster"
        value={cluster}
        onChange={(e) => setCluster(e.target.value as ClusterMoniker)}
      >
        {CLUSTERS.map((c) => (
          <option key={c} value={c}>
            {c[0].toUpperCase() + c.slice(1)}
          </option>
        ))}
      </select>
      <IconChevronDown size={12} />
    </label>
  );
}

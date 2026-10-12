"use client";
import { useEffect } from "react";
import { IconFlask, IconServer } from "@tabler/icons-react";
import { useCluster } from "./cluster-context";
import type { ClusterMoniker } from "../lib/solana-client";
import { ThemedSelect } from "./themed-select";

// The header only offers the networks the app is built to run against.
const SELECTABLE_CLUSTERS: Array<{
  value: ClusterMoniker;
  label: string;
  Icon: typeof IconFlask;
}> = [
  { value: "devnet", label: "Devnet", Icon: IconFlask },
  { value: "testnet", label: "Testnet", Icon: IconServer },
];

export function ClusterSelect() {
  const { cluster, setCluster } = useCluster();
  const selectable = SELECTABLE_CLUSTERS.some((item) => item.value === cluster);
  // A cluster saved before the list was narrowed falls back to devnet, so the
  // header never shows one network while the app is on another.
  useEffect(() => {
    if (!selectable) setCluster("devnet");
  }, [selectable, setCluster]);
  return (
    <ThemedSelect
      className="cluster-select"
      label="Solana cluster"
      value={selectable ? cluster : "devnet"}
      onChange={(value) => setCluster(value as ClusterMoniker)}
      options={SELECTABLE_CLUSTERS.map(({ value, label, Icon }) => ({
        value,
        label,
        icon: <Icon size={14} />,
      }))}
      prefix={<span className="status-dot" />}
    />
  );
}

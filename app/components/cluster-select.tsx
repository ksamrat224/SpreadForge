"use client";
import { IconCode, IconFlask, IconServer, IconWorld } from "@tabler/icons-react";
import { useCluster, CLUSTERS } from "./cluster-context";
import type { ClusterMoniker } from "../lib/solana-client";
import { ThemedSelect } from "./themed-select";
export function ClusterSelect() {
  const { cluster, setCluster } = useCluster();
  return (
    <ThemedSelect
      className="cluster-select"
      label="Solana cluster"
      value={cluster}
      onChange={(value) => setCluster(value as ClusterMoniker)}
      options={CLUSTERS.map((clusterName) => {
        const ClusterIcon = {
          localnet: IconCode,
          devnet: IconFlask,
          testnet: IconServer,
          mainnet: IconWorld,
        }[clusterName];
        return {
          value: clusterName,
          label: clusterName[0].toUpperCase() + clusterName.slice(1),
          icon: <ClusterIcon size={14} />,
        };
      })}
      prefix={<span className="status-dot" />}
    />
  );
}

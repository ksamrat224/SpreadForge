"use client";

import { IconCheck, IconSettings } from "@tabler/icons-react";
import { CHALLENGE_META } from "../lib/simulation/challenges";
import { SCENARIOS, type ScenarioId } from "../lib/simulation";
import { Modal } from "./terminal-ui";

export function RankedChallengeDrawer({
  selected,
  onSelect,
  onClose,
}: {
  selected: ScenarioId;
  onSelect: (id: ScenarioId) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="Choose your challenge" onClose={onClose} drawer>
      <p className="eyebrow">Learn in 3 steps</p>
      <div className="guide-steps">
        {[
          ["Configure", "Set quote and risk parameters."],
          ["Approve", "Sign one devnet start transaction."],
          ["Debrief", "Review your settled on-chain score."],
        ].map(([name, description], index) => (
          <div key={name}>
            <b>0{index + 1}</b>
            <strong>{name}</strong>
            <p>{description}</p>
          </div>
        ))}
      </div>
      <p className="eyebrow">Your next market</p>
      {(["stable-market", "whale-sell", "flash-crash"] as ScenarioId[]).map(
        (id) => (
          <button
            key={id}
            className={`challenge-card ${selected === id ? "selected" : ""}`}
            onClick={() => {
              onSelect(id);
              onClose();
            }}
          >
            <span className={`tag ${CHALLENGE_META[id].tone}`}>
              {CHALLENGE_META[id].level.toUpperCase()}
            </span>
            {selected === id && <IconCheck size={17} />}
            <h3>{SCENARIOS[id].name}</h3>
            <p>{CHALLENGE_META[id].description}</p>
            <div className="card-meta">
              <span>60 ON-CHAIN TICKS</span>
              <span>{CHALLENGE_META[id].volatility} VOLATILITY</span>
            </div>
          </button>
        )
      )}
      <button
        className="btn sandbox"
        onClick={() => {
          onSelect("stable-market");
          onClose();
        }}
      >
        <IconSettings size={15} /> Configure a strategy
      </button>
      <p className="control-hint">
        A run needs a connected wallet and devnet SOL for account rent and fees.
      </p>
    </Modal>
  );
}

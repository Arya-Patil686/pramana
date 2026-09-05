"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusChip } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/*
   The cross-border notice.

   This drafts and stops. Transmission is not wired to a button here and must
   not be: a notice that names a state pollution control board is a document
   with consequences, and the decision to send it belongs to an officer with
   signing authority, not to a model that wrote it or a page that rendered it.
   The dispatch control below records that decision and says plainly that this
   prototype records rather than transmits.
*/

interface AlertPayload {
  alert: {
    subject: string;
    body: string;
    smsText: string;
    recipients: { role: string; jurisdiction: string }[];
    escalationLevel: "routine" | "priority" | "immediate";
  };
  dispatched: boolean;
  dispatchNote: string;
  provenance: { mode: string; model: string; latencyMs: number; fellBackBecause: string | null };
}

export function AlertDraft() {
  const [data, setData] = useState<AlertPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [acknowledged, setAcknowledged] = useState(false);

  /* Initial `loading` is true, so the effect never has to set it. */
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-5/6" />
      </div>
    );
  }
  if (!data) return null;

  const { alert } = data;

  return (
    <div className="grid gap-px bg-border-subtle lg:grid-cols-12">
      <div className="bg-bg-base p-6 lg:col-span-8 lg:p-8">
        <div className="flex items-center justify-between gap-4">
          <span className="label-technical">Draft notice</span>
          <StatusChip
            tone={alert.escalationLevel === "immediate" ? "hazard" : "verify"}
            pulse={alert.escalationLevel === "immediate"}
          >
            {alert.escalationLevel}
          </StatusChip>
        </div>

        <h3 className="mt-5 font-display text-md leading-snug text-text-primary">
          {alert.subject}
        </h3>

        <div className="mt-5 space-y-4 border-l-2 border-border-default pl-5">
          {alert.body.split("\n\n").map((para) => (
            <p key={para.slice(0, 40)} className="text-sm leading-relaxed text-text-secondary">
              {para}
            </p>
          ))}
        </div>

        <div className="mt-7">
          <div className="flex items-baseline justify-between">
            <span className="label-technical">SMS variant</span>
            <span className="readout text-2xs text-text-quaternary">
              {alert.smsText.length}/160
            </span>
          </div>
          <div className="hash-block mt-2 !text-sm !text-text-primary">{alert.smsText}</div>
        </div>
      </div>

      <div className="bg-bg-base p-6 lg:col-span-4 lg:p-8">
        <div className="label-technical">Recipients</div>
        <ul className="mt-3 divide-y divide-border-subtle border-y border-border-subtle">
          {alert.recipients.map((r) => (
            <li key={`${r.role}-${r.jurisdiction}`} className="py-3">
              <div className="text-sm text-text-primary">{r.role}</div>
              <div className="mt-0.5 text-2xs text-text-tertiary">{r.jurisdiction}</div>
            </li>
          ))}
        </ul>

        <div className="panel bezel mt-7 p-4">
          <div className="label-technical">Dispatch</div>
          <p className="mt-2.5 text-2xs leading-relaxed text-text-tertiary">
            {data.dispatchNote}
          </p>
          <button
            type="button"
            onClick={() => setAcknowledged(true)}
            disabled={acknowledged}
            className={cn(
              "mt-4 w-full border px-4 py-2.5 text-sm transition-colors",
              acknowledged
                ? "cursor-default border-accent-clear-dim text-accent-clear"
                : "border-accent-hazard-dim text-accent-hazard hover:bg-accent-hazard/10"
            )}
          >
            {acknowledged ? "Recorded for signature" : "Mark ready for signature"}
          </button>
          <p className="mt-3 text-2xs leading-relaxed text-text-quaternary">
            This prototype records the decision. It does not transmit. Wiring a
            live gateway to this control is a deployment step that belongs to the
            issuing board, with its own audit trail.
          </p>
        </div>

        <dl className="mt-6 divide-y divide-border-subtle border-y border-border-subtle">
          <div className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="label-technical">Drafted by</dt>
            <dd className="readout text-2xs text-text-secondary">
              {data.provenance.mode === "live"
                ? `${data.provenance.model} · ${data.provenance.latencyMs} ms`
                : `${data.provenance.model} · recorded`}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

"use client";

// If the customer lands here with a Flutterwave transaction_id in the
// URL, ping the verify endpoint once so they see the confirmed status
// without waiting on the async webhook. Then clean up the URL and
// refresh the server-rendered order state.

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function OrderVerifyOnReturn({ orderNumber }: { orderNumber: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    const txId = searchParams.get("transaction_id");
    const status = searchParams.get("status");
    if (!txId || ran.current) return;
    ran.current = true;

    if (status === "cancelled") {
      router.replace(`/order/${orderNumber}`);
      return;
    }

    // Kicking off the async verification fetch triggered by a URL param is
    // the sanctioned "subscribe to an external event at mount" pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChecking(true);
    fetch(`/api/orders/${orderNumber}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId: txId }),
    })
      .finally(() => {
        setChecking(false);
        router.replace(`/order/${orderNumber}`);
        router.refresh();
      });
  }, [searchParams, orderNumber, router]);

  if (!checking) return null;

  return (
    <div
      role="status"
      className="mb-6 rounded-lg border border-blue/30 bg-blue/5 px-4 py-3 text-sm text-navy"
    >
      Confirming your payment…
    </div>
  );
}

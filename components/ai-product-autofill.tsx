"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, LoaderCircle, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { applyAiProductProposal } from "@/app/admin/products/actions";

const activityHeaders = () => ({
  "x-glonni-session-id": document.cookie.split("; ").find((item) => item.startsWith("glonni_session_id="))?.split("=")[1] ?? "",
  "x-glonni-device-id": document.cookie.split("; ").find((item) => item.startsWith("glonni_device_id="))?.split("=")[1] ?? "",
});

export function AiProductAutofill({ productId, initialTitle }: { productId?: string; initialTitle: string }) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle === "Untitled product" ? "" : initialTitle);
  const [proposal, setProposal] = useState<any>(null);
  const [error, setError] = useState("");
  const [fetching, setFetching] = useState(false);
  const [applying, startApplying] = useTransition();
  async function fetchProduct() {
    if (title.trim().length < 3) { setError("Enter a clear product name first."); return; }
    setFetching(true); setError(""); setProposal(null);
    const { data, error: invokeError } = await createClient().functions.invoke("ai-product-enrichment", { body: { query: title.trim() }, headers: activityHeaders() });
    if (invokeError || data?.error) setError(data?.error ?? "AI product research could not be completed. Please try again.");
    else setProposal(data.proposal);
    setFetching(false);
  }
  function applyProposal() {
    startApplying(async () => {
      try {
        const result = await applyAiProductProposal(proposal, productId);
        router.replace(`/admin/products?view=manual&draft=${result.productId}&step=basic&success=${encodeURIComponent("AI details applied. Review and edit any section before publishing.")}`);
        router.refresh();
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to apply AI details."); }
    });
  }
  const sectionCount = proposal ? [proposal.title, proposal.primary_image_url || proposal.gallery_images?.length, proposal.variations?.length, proposal.specifications?.length, Object.values(proposal.product_information ?? {}).some(Boolean), proposal.offer_candidates?.length].filter(Boolean).length : 0;
  return (
    <div className="ai-product-field wide">
      <label htmlFor="manual-product-title">Product name <strong>Required</strong></label>
      <div className="ai-product-input-row">
        <input id="manual-product-title" name="title" required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Apple iPhone 16 128GB" />
        <button type="button" onClick={fetchProduct} disabled={fetching || title.trim().length < 3}>
          {fetching ? <LoaderCircle className="spin" /> : <Sparkles />} {fetching ? "Researching…" : "Fetch with AI"}
        </button>
      </div>
      <small>AI researches the exact product and prepares editable details. Nothing is published automatically.</small>
      {error && <p className="ai-product-error">{error}</p>}
      {proposal && (
        <article className="ai-product-result">
          <div className="ai-product-result-icon">{proposal.primary_image_url ? <img src={proposal.primary_image_url} alt="" /> : <Sparkles />}</div>
          <div>
            <span><CheckCircle2 /> Research complete · {Math.round(proposal.confidence ?? 0)}% confidence</span>
            <h3>{proposal.title}</h3>
            <p>{proposal.brand || "Brand needs review"}{proposal.model_code ? ` · ${proposal.model_code}` : ""}</p>
            <small>Prepared information across {sectionCount} sections. Missing details remain editable and optional details do not block your draft.</small>
            {proposal.sources?.length > 0 && <details><summary>View {proposal.sources.length} research sources</summary>{proposal.sources.map((source: any) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.title}<ExternalLink /></a>)}</details>}
          </div>
          <button type="button" className="apply-ai-product" onClick={applyProposal} disabled={applying}>{applying ? <LoaderCircle className="spin" /> : <Sparkles />}{applying ? "Applying…" : "Apply AI details"}</button>
        </article>
      )}
    </div>
  );
}

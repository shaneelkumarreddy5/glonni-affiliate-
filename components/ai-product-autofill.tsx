"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ExternalLink, LoaderCircle, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { applyAiProductProposal } from "@/app/admin/products/actions";

async function functionErrorMessage(error: any) {
  const response = error?.context;
  if (response && typeof response.clone === "function") {
    try {
      const body = await response.clone().json();
      if (typeof body?.error === "string" && body.error.trim()) return body.error.trim();
    } catch {
      try {
        const text = await response.clone().text();
        if (text.trim()) return text.trim().slice(0, 500);
      } catch {}
    }
  }
  return typeof error?.message === "string" && error.message.trim()
    ? error.message
    : "AI product research could not be completed. Please try again.";
}

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
    const { data, error: invokeError } = await createClient().functions.invoke("ai-product-enrichment", { body: { query: title.trim(), productId } });
    if (invokeError || data?.error) setError(data?.error ?? await functionErrorMessage(invokeError));
    else setProposal(data.proposal);
    setFetching(false);
  }
  const verified = proposal?.verification_status === "verified";
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
        <button type="button" data-live-control="true" onClick={fetchProduct} disabled={fetching || title.trim().length < 3}>
          {fetching ? <LoaderCircle className="spin" /> : <Sparkles />} {fetching ? "Researching…" : "Fetch with AI"}
        </button>
      </div>
      <small>Enter only the product name. AI checks connected stores and brands, reuses saved product details, and prepares verified store offers for review.</small>
      {error && <p className="ai-product-error">{error}</p>}
      {proposal && (
        <article className="ai-product-result enriched">
          <div className="ai-product-result-icon">{proposal.primary_image_url ? <img src={proposal.primary_image_url} alt="" /> : verified ? <Sparkles /> : <AlertTriangle />}</div>
          <div>
            <span>{verified ? <CheckCircle2 /> : <AlertTriangle />} {verified ? "Verified on connected sources" : "Not verified"} · {Math.round(proposal.confidence ?? 0)}% confidence</span>
            <h3>{proposal.title}</h3>
            <p>{proposal.brand || "Brand needs review"}{proposal.model_code ? ` · ${proposal.model_code}` : ""}</p>
            <small>{proposal.verification_message || (proposal.fetch_mode === "offers_only" ? "Saved product details were reused; only connected-store offers were checked." : `Prepared verified information across ${sectionCount} sections.`)}</small>
            <div className="ai-quality-grid">{Object.entries(proposal.section_confidence??{}).map(([key,value])=><span key={key}><small>{key.replaceAll('_',' ')}</small><b>{Math.round(Number(value)||0)}%</b></span>)}</div>
            {(proposal.missing_fields?.length>0||proposal.conflicts?.length>0||proposal.duplicate_candidates?.length>0)&&<div className="ai-enrichment-warnings">{proposal.missing_fields?.length>0&&<p><b>Missing:</b> {proposal.missing_fields.join(', ')}</p>}{proposal.conflicts?.length>0&&<p><b>Conflicts:</b> {proposal.conflicts.length} source disagreement{proposal.conflicts.length===1?'':'s'} require review.</p>}{proposal.duplicate_candidates?.length>0&&<p><b>Possible duplicates:</b> {proposal.duplicate_candidates.map((item:any)=>`${item.title} (${item.similarity}%)`).join(', ')}</p>}</div>}
            {proposal.offer_candidates?.length > 0 && <details open><summary>Connected store results</summary><div className="ai-store-results">{proposal.offer_candidates.map((offer:any)=><div key={offer.store_name}><b>{offer.store_name}</b><span>{String(offer.match_status||"unable_to_verify").replaceAll("_"," ")}</span>{offer.variant&&<small>{offer.variant}</small>}{offer.current_price!=null&&<strong>₹{Number(offer.current_price).toLocaleString("en-IN")}</strong>}{offer.bank_offer&&<small>{offer.bank_offer}</small>}{offer.coupon_code&&<small>Coupon: {offer.coupon_code}</small>}{offer.product_url&&<a href={offer.product_url} target="_blank" rel="noreferrer">Open listing <ExternalLink /></a>}</div>)}</div></details>}
            {proposal.sources?.length > 0 && <details><summary>View {proposal.sources.length} connected sources checked</summary>{proposal.sources.map((source: any) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.title}<ExternalLink /></a>)}</details>}
          </div>
          {verified ? <button type="button" className="apply-ai-product" onClick={applyProposal} disabled={applying}>{applying ? <LoaderCircle className="spin" /> : <Sparkles />}{applying ? "Applying…" : proposal.fetch_mode === "offers_only" ? "Apply store offers" : "Apply AI details"}</button> : <p className="ai-product-error">Nothing can be applied because the exact product was not found on a connected source.</p>}
        </article>
      )}
    </div>
  );
}

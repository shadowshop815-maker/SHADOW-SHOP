import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api";
import type { StoreData } from "../types";

export function Newsletter({ settings }: { settings?: StoreData }) { 
  const [email, setEmail] = useState(""); 
  
  const mutation = useMutation({
    mutationFn: () => api("/newsletter", { method: "POST", body: JSON.stringify({ email }) }),
    onSuccess: () => setEmail("")
  }); 
  
  return (
    <section className="newsletter">
      <span className="eyebrow">PRIVATE ACCESS</span>
      <h2>{settings?.branding.newsletterHeading || "Enter the inner circle"}</h2>
      <p>{settings?.branding.newsletterText}</p>
      <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }}>
        <label className="sr-only" htmlFor="newsletter-email">Email address</label>
        <input 
          id="newsletter-email" 
          type="email" 
          required 
          placeholder="Email address" 
          value={email} 
          onChange={e => setEmail(e.target.value)}
        />
        <button disabled={mutation.isPending}>{mutation.isPending ? "Joining…" : "Join now"}</button>
      </form>
      {mutation.isSuccess && <small className="success-text">You’re on the list.</small>}
      {mutation.error && <small className="error-text">{mutation.error.message}</small>}
    </section>
  ); 
}

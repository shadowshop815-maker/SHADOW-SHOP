import { useQuery } from "@tanstack/react-query";
import { api } from "../../api";
import type { StoreData } from "../../types";

export function Policies() { 
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<StoreData>("/settings")
  }); 
  
  return (
    <section className="section page prose">
      <span className="eyebrow">STORE INFORMATION</span>
      <h1>Policies</h1>
      
      <h2>Returns</h2>
      <p>{data?.store.returnPolicy || "The store administrator has not published a return policy yet."}</p>
      
      <h2>Cancellation</h2>
      <p>{data?.store.cancellationPolicy || "The store administrator has not published a cancellation policy yet."}</p>

      <h2>Privacy</h2>
      <p>{data?.store.privacyPolicy || "The store administrator has not published a privacy policy yet."}</p>
      
      <h2>Terms</h2>
      <p>{data?.store.terms || "The store administrator has not published terms yet."}</p>
    </section>
  ); 
}

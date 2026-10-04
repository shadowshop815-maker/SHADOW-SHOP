import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { api } from "../../api";
import { useConfirm } from "../../features/confirm/ConfirmContext";
import { PageHead, Loading, ErrorState, Field } from "../../components/ui";

type Security = { otpExpiryMinutes: number; otpMaxAttempts: number; otpResendCooldownSeconds: number; requireEmailVerification: boolean };

export function SecurityPage() {
  const client = useQueryClient();
  const confirm = useConfirm();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["security"],
    queryFn: () => api<Security>("/admin/security")
  });
  
  const [form, setForm] = useState<Security | null>(null);
  
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);
  
  const mutation = useMutation({
    mutationFn: () => api("/admin/security", { method: "PATCH", body: JSON.stringify(form) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["security"] })
  });
  
  if (isLoading || !form) return <Loading />;
  if (error) return <ErrorState error={error} />;
  
  return (
    <>
      <PageHead eyebrow="SYSTEM" title="Authentication & OTP" description="Security limits apply immediately to new OTP requests." />
      <form className="card settings-form narrow" onSubmit={async e => {
        e.preventDefault();
        if (await confirm("Changing OTP limits affects all customers. Continue?", "Update security settings")) {
          mutation.mutate();
        }
      }}>
        <div className="security-note">
          <ShieldAlert />
          <div>
            <b>Production delivery is credential-driven</b>
            <p>OTP values are never returned by the API. They print only in the backend terminal during development; production requires configured SMTP or SMS credentials.</p>
          </div>
        </div>
        
        <Field label="OTP expiry (minutes, 1–30)" type="number" value={String(form.otpExpiryMinutes)} onChange={v => setForm({ ...form, otpExpiryMinutes: Number(v) })} />
        <Field label="Maximum attempts (1–10)" type="number" value={String(form.otpMaxAttempts)} onChange={v => setForm({ ...form, otpMaxAttempts: Number(v) })} />
        <Field label="Resend cooldown (seconds, 15–3600)" type="number" value={String(form.otpResendCooldownSeconds)} onChange={v => setForm({ ...form, otpResendCooldownSeconds: Number(v) })} />
        
        <label className="check">
          <input type="checkbox" checked={form.requireEmailVerification} onChange={e => setForm({ ...form, requireEmailVerification: e.target.checked })} />
          Require email verification before checkout (enforcement ready)
        </label>
        
        {mutation.isSuccess && <p className="success">Security settings saved.</p>}
        {mutation.error && <p className="form-error">{mutation.error.message}</p>}
        
        <button className="primary">Save security settings</button>
      </form>
    </>
  );
}

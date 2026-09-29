import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { MailCheck, RefreshCw, ShieldCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/reveal";
import { db } from "@/integrations/backend/client";
import { toast } from "sonner";

export const Route = createFileRoute("/verify-email")({
  ssr: false,
  head: () => ({ title: "Verify Email — PUB Bus Track" }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const navigate = useNavigate();
  const initialEmail = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("email") || "" : "";
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await db.auth.verifyEmailCode({ email, code });
      if (result.error) throw result.error;
      toast.success("Email verified successfully!");
      navigate({ to: "/dashboard" });
    } catch (error: any) {
      toast.error(error.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!email) return toast.error("Enter your email first");
    setResending(true);
    try {
      const result = await db.auth.resendVerificationCode(email);
      if (result.error) throw result.error;
      toast.success(result.message || "A new code was sent");
      if (result.development_code) toast.info(`Development code: ${result.development_code}`);
    } catch (error: any) {
      toast.error(error.message || "Could not resend code");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout>
      <Reveal>
        <div className="mx-auto w-full max-w-[500px]">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
              <MailCheck className="h-8 w-8" />
            </div>
            <h1 className="font-display text-4xl font-extrabold text-ink">Verify Your Email</h1>
            <p className="mt-2 font-medium text-ink/60">We sent a 6-digit verification code to your email address.</p>
          </div>

          <div className="rounded-[2.5rem] bg-white p-8 shadow-2xl ring-1 ring-black/5 sm:p-10">
            <form className="space-y-5" onSubmit={verify}>
              <div className="space-y-2">
                <Label htmlFor="verify-email">Email Address</Label>
                <Input id="verify-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-2xl" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="verify-code">6-Digit Code</Label>
                <Input id="verify-code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" className="h-14 rounded-2xl text-center text-2xl font-black tracking-[0.4em]" required />
              </div>
              <Button type="submit" disabled={loading || code.length !== 6} className="w-full rounded-2xl py-7 font-display text-lg font-bold">
                <ShieldCheck className="mr-2 h-5 w-5" />
                {loading ? "Verifying..." : "Verify Email"}
              </Button>
            </form>

            <Button type="button" variant="outline" onClick={resend} disabled={resending} className="mt-4 w-full rounded-2xl py-6 font-bold">
              <RefreshCw className={`mr-2 h-4 w-4 ${resending ? "animate-spin" : ""}`} />
              {resending ? "Sending..." : "Resend Code"}
            </Button>

            <p className="mt-6 text-center text-sm font-medium text-ink/60">
              Already verified? <Link to="/login" className="font-bold text-primary hover:underline">Login</Link>
            </p>
          </div>
        </div>
      </Reveal>
    </AuthLayout>
  );
}

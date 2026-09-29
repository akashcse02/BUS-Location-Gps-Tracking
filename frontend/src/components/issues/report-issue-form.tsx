import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useMyIssues, type Issue } from "@/lib/issues";

const CATEGORIES = ["Bus delay", "Driver behavior", "Cleanliness", "Route problem", "Other"];

const STATUS_STYLE: Record<Issue["status"], { icon: typeof Clock; className: string }> = {
  pending: { icon: Clock, className: "text-amber-600 bg-amber-50" },
  investigating: { icon: AlertTriangle, className: "text-blue-600 bg-blue-50" },
  resolved: { icon: CheckCircle2, className: "text-emerald-600 bg-emerald-50" },
  closed: { icon: CheckCircle2, className: "text-ink/40 bg-ink/5" },
};

export function ReportIssueForm() {
  const { issues, loading, report } = useMyIssues();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const trimmedDescription = description.trim();
      const payload: { title: string; description?: string; category?: string } = {
        title: title.trim(),
      };
      if (trimmedDescription) payload.description = trimmedDescription;
      if (category) payload.category = category;
      await report(payload);
      toast.success("Issue reported — the admin team will look into it.");
      setTitle("");
      setDescription("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to report issue");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="rounded-[2rem]">
      <CardHeader>
        <CardTitle className="text-lg">Report an Issue</CardTitle>
        <p className="text-sm text-ink/60">Bus delay, driver behavior, route problem — let admin know.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short title (e.g. Bus PUB-04 was 20 min late)"
            required
            className="rounded-2xl"
          />

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  category === c ? "bg-primary text-white" : "bg-ink/5 text-ink/60 hover:bg-ink/10"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add any details that might help (optional)"
            rows={3}
            className="rounded-2xl"
          />

          <Button
            type="submit"
            disabled={saving}
            className="btn-hover-premium rounded-full bg-primary px-6 font-display font-bold"
          >
            {saving ? "Submitting..." : "Submit"}
          </Button>
        </form>

        {!loading && issues.length > 0 && (
          <div className="space-y-2 border-t border-ink/10 pt-4">
            <p className="text-sm font-bold text-ink/70">Your reported issues</p>
            {issues.map((issue) => {
              const style = STATUS_STYLE[issue.status];
              const Icon = style.icon;
              return (
                <div key={issue.id} className="flex items-center justify-between rounded-2xl bg-ink/[0.03] px-4 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-ink">{issue.title}</p>
                    <p className="text-xs text-ink/50">{issue.category}</p>
                  </div>
                  <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold capitalize ${style.className}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {issue.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

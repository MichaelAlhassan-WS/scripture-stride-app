import { Link, createFileRoute } from "@tanstack/react-router";
import { BookOpen, Flame, LineChart, ShieldCheck, UsersRound, NotebookPen } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FaithTrack — Bible Study Accountability for Churches" },
      {
        name: "description",
        content:
          "A private accountability platform for churches and discipleship groups: daily reading plans, a built-in KJV Bible reader, streaks and leader dashboards.",
      },
      { property: "og:title", content: "FaithTrack — Bible Study Accountability for Churches" },
      {
        property: "og:description",
        content:
          "Daily reading plans, KJV reader, streaks and leader dashboards for your Bible study community.",
      },
    ],
  }),
  component: Index,
});

const features = [
  {
    icon: BookOpen,
    title: "Built-in KJV Bible",
    body: "Browse every book, chapter and verse offline. Search, bookmark and highlight as you read.",
  },
  {
    icon: Flame,
    title: "Streaks that stick",
    body: "Current streak, longest streak and monthly chapters keep the habit visible and rewarding.",
  },
  {
    icon: NotebookPen,
    title: "Log study anywhere",
    body: "Studied offline? Record the book, verses, minutes and your reflection in seconds.",
  },
  {
    icon: UsersRound,
    title: "Groups your way",
    body: "Private, anonymous or full group visibility — set per group, so no one feels exposed.",
  },
  {
    icon: LineChart,
    title: "Leader insight",
    body: "Completion rates, missed days and member activity for the groups you shepherd.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    body: "Administrators, group leaders and members each see only what belongs to them.",
  },
];

function Index() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2">
          <span className="bg-hero flex size-9 items-center justify-center rounded-xl text-primary-foreground">
            <BookOpen className="size-4" />
          </span>
          <span className="font-display text-lg text-primary">FaithTrack</span>
        </div>
        <Button asChild variant="outline">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <section className="bg-hero relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent">
            Bible study accountability
          </p>
          <h1 className="text-balance-tight mt-4 max-w-2xl text-4xl leading-tight text-primary-foreground sm:text-6xl">
            Stay faithful in the Word, together.
          </h1>
          <p className="mt-5 max-w-xl text-base text-primary-foreground/80 sm:text-lg">
            FaithTrack is a private platform for churches, discipleship groups and leadership teams
            to keep daily Bible study consistent — and to encourage every member along the way.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-gold text-accent-foreground hover:opacity-90">
              <Link to="/auth">Create your account</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
            >
              <Link to="/auth">I already have an account</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm italic text-primary-foreground/70">
            “Thy word have I hid in mine heart, that I might not sin against thee.” — Psalm 119:11
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl text-foreground sm:text-3xl">Everything a study group needs</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="surface-card p-5">
              <span className="mb-4 inline-flex rounded-xl bg-accent-soft p-2 text-accent-foreground">
                <feature.icon className="size-5" />
              </span>
              <h3 className="text-lg text-foreground">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        FaithTrack — built for the local church.
      </footer>
    </div>
  );
}

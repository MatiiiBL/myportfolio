import { Figure } from "../../components/Figure";
import { Section } from "../../components/Section";
import { Architecture } from "./Architecture";
import { PipelineSim } from "./PipelineSim";
import { CorpusResults, FaultResults, StrategyResults, ThroughputResults } from "./Results";
import { SourceLink } from "../../components/SourceLink";
import { SOURCE } from "./source";
import "../../components/ProjectPage.css";

// The precis page body, inside ProjectLayout (docs/site.md, "Project pages").
export default function Page() {
  return (
    <div className="project-page">
      <Section id="overview" title="Overview">
        <div className="project-prose">
          <p>
            Précis reads thousands of research papers in parallel with LLM agents and turns them
            into verified, structured summaries and a map of the field. A reader agent moves through
            each paper&apos;s sections with tools instead of receiving the whole text. A critic
            checks every claim of the summary against the paper and has to quote its evidence
            verbatim, and summaries with unsupported or contradicted claims are rewritten and
            checked again. The corpus is then clustered into topics, and Précis writes a report and
            a searchable static site.
          </p>
          <p>
            The hard parts surround the model. Thousands of agents share one API with per-minute
            limits on requests, input tokens and output tokens, so every request goes through one
            gateway that admits it under an adaptive concurrency window and token buckets, retries
            failures, caches replies and counts the cost. A run can be killed at any point and
            resumed without paying twice for any answered request, because a reply&apos;s call
            record and its cache entry are written in one SQLite transaction. Every number on this
            page comes from offline runs against a fake API with simulated limits and faults: they
            measure the machinery, not the quality of the summaries, and cost nothing.
          </p>
        </div>
      </Section>

      <Section
        id="pipeline"
        title="The pipeline under load"
        kicker="Interactive"
        navLabel="Pipeline"
      >
        <div className="project-prose">
          <p>
            Below, the pipeline runs against a simulated API. The first setting is the throughput
            benchmark&apos;s: 2,000 papers, and server limits of 4,000 requests, 2 million input
            tokens and 400,000 output tokens per minute. The window doubles from 8 in slow start,
            then the input-token bucket, not the window, sets the pace, without a single 429. Lower
            the ceiling and throughput becomes proportional to concurrency. The other two settings
            are the overload experiment of the runtime document, where the window finds a
            server&apos;s capacity by halving on each 529, and the fault benchmark&apos;s error
            rates. Press SIGKILL at any moment.
          </p>
        </div>
        <PipelineSim />
      </Section>

      <Section id="results" title="Results">
        <div className="project-prose">
          <p>
            All of these were measured offline. Deterministic stand-ins play every model role, while
            the scheduler, agents, gateway and store are the real ones, and time is simulated, so
            each run is reproducible on any machine without an API key. Dollar amounts are what the
            simulated usage would cost at Claude Opus 5.5 prices.
          </p>
        </div>
        <ThroughputResults />
        <div className="project-prose">
          <h3 className="project-subhead">Crash recovery and the real corpus</h3>
          <p>
            A run killed with SIGKILL loses only what was in memory. On restart, stages left running
            go back to pending, finished stages are skipped, and an interrupted stage replays its
            finished turns from the response cache. The one request whose reply the crash lost is
            sent again; no answered request is paid for twice. The ingest side ran against arXiv
            itself, at its polite pace of one request every three seconds.
          </p>
        </div>
        <div className="project-grid">
          <FaultResults />
          <CorpusResults />
        </div>
        <div className="project-prose">
          <h3 className="project-subhead">Reading strategies</h3>
          <p>
            Reading with tools opens about half of each paper and grows with what it reads, not with
            what exists: on papers over 12,000 tokens it used a quarter fewer tokens than sending
            the full text (a median of 12,470 against 16,535), and it was the cheapest of the three
            strategies because half of its tokens are prompt-cache reads. Through the Message
            Batches API the same work costs 52% less ($7.70 against $16.14 for 200 papers), at the
            price of minutes per turn instead of seconds.
          </p>
        </div>
        <StrategyResults />
      </Section>

      <Section id="how" title="How it works">
        <div className="project-how">
          <Figure
            title="From arXiv to a map of the field"
            subtitle="per-paper stages, corpus stages, one gateway"
            caption={
              <>
                Every model request, from the agents and from the corpus stages, goes through the
                one gateway, which records each call and its reply in the store. Source:{" "}
                <SourceLink {...SOURCE} file="docs/design.md" />.
              </>
            }
          >
            <Architecture />
          </Figure>
          <div className="project-decisions">
            <article>
              <h3>Verify with quotes, and check the quotes</h3>
              <p>
                The critic gives each claim, the TL;DR and every finding, a verdict: supported,
                partial, unsupported or contradicted, each with a verbatim quote from the paper. The
                quote is then looked up in the paper, with whitespace, case, typographic quotes and
                dashes normalized, and a &ldquo;supported&rdquo; verdict whose quote is not there is
                downgraded to partial. Before that, a summary whose numbers do not appear in the
                paper is rejected and the reader is told why. Without evidence a verdict is just
                another generation; with it, &ldquo;supported&rdquo; can be checked.
              </p>
            </article>
            <article>
              <h3>One gateway that agents don&apos;t see</h3>
              <p>
                The agents only call <code>create</code>. The gateway admits each request under a
                concurrency window that works like TCP&apos;s: it doubles per round trip in slow
                start, halves on a 429 or 529 once per congestion event, then grows by one. Token
                buckets mirror the API&apos;s per-minute limits, learned from its rate-limit
                headers, so requests wait on the client instead of collecting 429s, and a 429&apos;s
                retry-after pauses every admission. Slow start was added after the throughput
                benchmark showed the additive ramp to be the bottleneck: at a ceiling of 128 it
                lifted throughput from 130.6 to 165.1 papers per minute.
              </p>
            </article>
            <article>
              <h3>Never pay twice, even under SIGKILL</h3>
              <p>
                Every stage result is keyed by a hash of what determines it (model, prompts, tools,
                options and inputs), and every reply is cached under a hash of its request, so a
                rerun skips finished work and an interrupted stage replays its turns for free. The
                reply&apos;s call record and its cache entry used to be two writes; a SIGKILL
                between them left a paid call with no cached reply, which the next run bought again,
                about one run in ten. They are now one SQLite transaction. The benchmarks run on a
                virtual clock that advances only when every task is waiting, so a 2,000-paper run
                takes about 30 seconds and gives the same result for the same seeds.
              </p>
            </article>
          </div>
        </div>
      </Section>

      <Section id="limits" title="Limits">
        <ul className="project-limits">
          <li>
            <strong>Summary quality is not measured yet.</strong> That takes a paid run against the
            API. The evaluation commands (key-point recall without the abstract, claim faithfulness
            with a quote audit, the strategy comparison) are built and tested offline, and a run can
            be capped with <code>--max-cost</code>.
          </li>
          <li>
            <strong>Offline numbers measure machinery, not judgement.</strong> How much a real model
            chooses to read, and how often it is rejected or revised, will differ.
          </li>
          <li>
            <strong>Some PDFs lose structure.</strong> About 8% of papers have no usable HTML, and
            their PDFs, many made with Word, go through a heuristic outline finder; scanned or badly
            encoded PDFs fail the quality gate by design.
          </li>
          <li>
            <strong>Quote checks have gaps.</strong> A quote is accepted if it appears anywhere in
            the paper, not necessarily in the cited section, and the number check cannot see numbers
            written as words.
          </li>
          <li>
            <strong>One machine.</strong> One event loop and one SQLite file: plenty for tens of
            thousands of papers, since the API&apos;s rate limit is the bottleneck, but not a
            distributed system.
          </li>
        </ul>
        <p className="project-source">
          Source: <SourceLink {...SOURCE} file="README.md" anchor="limitations" />; the method and
          every measurement are in <SourceLink {...SOURCE} file="docs/evaluation.md" />.
        </p>
      </Section>
    </div>
  );
}

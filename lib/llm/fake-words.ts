import type { AreaId } from "../domain/areas";
import type { GeneratedWord } from "./types";

/** Demo-mode content, copied from the Claude Design sample data (docs/design/drpk.dc.html). */
export interface FakeWord {
  area: AreaId;
  word: GeneratedWord;
}

export const FAKE_WORDS: FakeWord[] = [
  {
    area: "postgres-databases",
    word: {
      term: "MVCC",
      subtitle: "Multi-version concurrency control",
      topics: [
        {
          title: "Snapshots and tuple visibility",
          questions: [
            {
              prompt: "Under READ COMMITTED and under REPEATABLE READ, when is a transaction's snapshot taken, and what does it contain?",
              rubric: [
                "Per-statement vs per-transaction snapshot",
                "xmin / xmax bounds",
                "The in-progress XID list"
              ],
              modelAnswer: "READ COMMITTED takes a fresh snapshot at the start of every statement; REPEATABLE READ takes one at the first statement and keeps it for the whole transaction. A snapshot records xmin (oldest still-active XID), xmax (first unassigned XID) and the list of XIDs in progress between them."
            },
            {
              prompt: "A row version has a committed xmin and an xmax set by a transaction that is still running. Is it visible to a new snapshot? Why?",
              rubric: [
                "xmax only counts once committed",
                "In-progress XIDs are treated as invisible"
              ],
              modelAnswer: "Yes. The deleting/updating transaction hasn't committed, so from the new snapshot's point of view the change hasn't happened and this version is still the live one."
            }
          ]
        },
        {
          title: "What an UPDATE really writes",
          questions: [
            {
              prompt: "What does an UPDATE physically do to a row in Postgres, in terms of tuple versions and indexes?",
              rubric: [
                "New tuple; old one gets xmax",
                "ctid chain between versions",
                "Index entries and HOT updates"
              ],
              modelAnswer: "It never overwrites. It writes a new tuple version with a new xmin, sets xmax on the old version and links old to new via ctid. Every index normally gets a new entry too, unless the update qualifies as HOT (no indexed column changed and there is room on the same page)."
            }
          ]
        },
        {
          title: "Isolation levels in Postgres",
          questions: [
            {
              prompt: "Postgres REPEATABLE READ is stricter than the SQL standard requires. Which anomaly does it prevent that the standard allows, and which one does it still allow?",
              rubric: [
                "Phantoms prevented by the fixed snapshot",
                "Write skew still possible"
              ],
              modelAnswer: "It prevents phantom reads, because the snapshot is fixed for the whole transaction. It still allows write skew and other serialization anomalies, which only SERIALIZABLE prevents."
            },
            {
              prompt: "Your service retries transactions that fail with serialization_failure. What has to be true about the retried code for that to be safe?",
              rubric: [
                "Retry the whole transaction, not the last statement",
                "No external side effects before commit",
                "Idempotency"
              ],
              modelAnswer: "The whole transaction must be re-run from the start, reads included, and anything with effects outside the database (emails, HTTP calls, queue messages) must happen after commit or be idempotent."
            }
          ]
        },
        {
          title: "VACUUM and dead tuples",
          questions: [
            {
              prompt: "Why can one transaction left idle for hours cause bloat across the whole database?",
              rubric: [
                "The xmin horizon",
                "Dead tuples stay while any snapshot might see them",
                "'idle in transaction' sessions"
              ],
              modelAnswer: "VACUUM can only remove tuple versions that no snapshot could still see. The oldest open transaction holds back the xmin horizon for the whole cluster, so dead tuples everywhere accumulate until it ends."
            }
          ]
        },
        {
          title: "Write skew",
          questions: [
            {
              prompt: "Two on-call doctors each check that someone else is on call, then both sign off. Why doesn't locking the rows you update prevent this?",
              rubric: [
                "Disjoint writes, no conflict",
                "The invariant lives in the read set",
                "FOR UPDATE, materialise the conflict, or SERIALIZABLE"
              ],
              modelAnswer: "Each transaction updates a different row, so there's no write-write conflict. The invariant depends on rows they only read. You need SELECT … FOR UPDATE on the rows read, a constraint that materialises the conflict, or SERIALIZABLE."
            },
            {
              prompt: "How does SERIALIZABLE in Postgres detect this without making readers block writers?",
              rubric: [
                "SIRead locks don't block",
                "rw-antidependencies",
                "Abort on a dangerous structure"
              ],
              modelAnswer: "Serializable Snapshot Isolation tracks read-write dependencies with SIRead predicate locks that never block. When it sees a dangerous structure — two consecutive rw-antidependencies in a potential cycle — it aborts one transaction with serialization_failure."
            }
          ]
        },
        {
          title: "Transaction ID wraparound",
          questions: [
            {
              prompt: "What is XID wraparound, and what does freezing do to prevent it?",
              rubric: [
                "32-bit circular XID space",
                "Frozen tuples are always visible",
                "Anti-wraparound autovacuum"
              ],
              modelAnswer: "XIDs are 32-bit and compared modulo 2³², so after ~2 billion transactions old XIDs would appear to be in the future and rows would vanish. Freezing marks old tuples as visible to everyone, so their XID no longer matters."
            }
          ]
        },
        {
          title: "MVCC vs two-phase locking",
          questions: [
            {
              prompt: "What does MVCC give up compared with strict two-phase locking, and where does that cost show up in operations?",
              rubric: [
                "Readers and writers don't block",
                "Garbage: bloat and VACUUM",
                "Weaker default isolation"
              ],
              modelAnswer: "Readers and writers don't block each other, but you pay in storage and maintenance: old versions pile up and need VACUUM, you get bloat and wraparound risk, and default snapshot isolation allows anomalies strict 2PL wouldn't."
            }
          ]
        }
      ]
    },
  },
  {
    area: "node-runtime",
    word: {
      term: "Backpressure",
      subtitle: "Flow control between fast producers and slow consumers",
      topics: [
        {
          title: "highWaterMark and write()",
          questions: [
            {
              prompt: "What does highWaterMark control on a Writable, and what does write() returning false mean?",
              rubric: [
                "Buffer threshold",
                "Wait for 'drain'"
              ],
              modelAnswer: "It's the buffer threshold; false means the buffer is past it and you should wait for 'drain'."
            }
          ]
        },
        {
          title: "pipe() vs pipeline()",
          questions: [
            {
              prompt: "Why is stream.pipeline preferred over chaining .pipe() calls?",
              rubric: [
                "Error propagation",
                "Cleanup on failure"
              ],
              modelAnswer: "pipeline forwards errors and destroys every stream on failure; .pipe() leaks streams and swallows errors."
            }
          ]
        },
        {
          title: "Backpressure over HTTP",
          questions: [
            {
              prompt: "A client downloads slowly from your Node server. How does backpressure travel back to the file you're reading from?",
              rubric: [
                "TCP window",
                "Socket buffer → paused readable"
              ],
              modelAnswer: "TCP's window fills, the socket's write() returns false, pipeline pauses the file read stream until 'drain'."
            }
          ]
        },
        {
          title: "Unbounded queues",
          questions: [
            {
              prompt: "Why is an in-memory queue without a limit a backpressure bug?",
              rubric: [
                "Hidden overload",
                "Bound → shed or slow"
              ],
              modelAnswer: "It hides overload until memory runs out; a bound forces you to slow, shed or reject upstream."
            }
          ]
        }
      ]
    },
  },
  {
    area: "react-internals",
    word: {
      term: "React reconciliation",
      subtitle: "How React decides what to change in the DOM",
      topics: [
        {
          title: "Keys and identity",
          questions: [
            {
              prompt: "Why does using an array index as a key cause bugs when a list is reordered?",
              rubric: [
                "Keys = identity",
                "State follows the key"
              ],
              modelAnswer: "Keys define identity; index keys attach state to positions, not items."
            }
          ]
        },
        {
          title: "Element type changes",
          questions: [
            {
              prompt: "What happens to a subtree's state when a component's element type changes between renders?",
              rubric: [
                "Different type → remount"
              ],
              modelAnswer: "React unmounts the old subtree and mounts a new one; all state below is lost."
            }
          ]
        },
        {
          title: "Fiber and interruptible work",
          questions: [
            {
              prompt: "What does the Fiber architecture let React do that the old stack reconciler couldn't?",
              rubric: [
                "Units of work",
                "Priorities / lanes"
              ],
              modelAnswer: "Split rendering into units of work that can be paused, prioritised and resumed."
            }
          ]
        },
        {
          title: "Bailouts",
          questions: [
            {
              prompt: "When does React skip rendering a child entirely?",
              rubric: [
                "Referential equality",
                "memo"
              ],
              modelAnswer: "When props, state and context are referentially unchanged, e.g. via memo or the same element object."
            }
          ]
        }
      ]
    },
  },
  {
    area: "graphql-api-design",
    word: {
      term: "Idempotency keys",
      subtitle: "Making retried writes safe",
      topics: [
        {
          title: "Why clients retry",
          questions: [
            {
              prompt: "Why can't a client tell whether a timed-out POST succeeded?",
              rubric: [
                "Lost response ≠ failed request"
              ],
              modelAnswer: "The request may have been processed and only the response lost."
            }
          ]
        },
        {
          title: "Storing the key",
          questions: [
            {
              prompt: "What must the server store alongside an idempotency key, and for how long?",
              rubric: [
                "Fingerprint + response",
                "Retention window"
              ],
              modelAnswer: "The request fingerprint and the final response, for at least the client's retry window."
            }
          ]
        },
        {
          title: "Concurrent duplicates",
          questions: [
            {
              prompt: "Two requests with the same key arrive at the same time. What should happen?",
              rubric: [
                "Atomic claim",
                "409 or wait"
              ],
              modelAnswer: "One acquires the key (e.g. unique insert/lock); the other waits or gets 409 until the first finishes."
            }
          ]
        },
        {
          title: "Idempotency in GraphQL mutations",
          questions: [
            {
              prompt: "Where would you put an idempotency key in a GraphQL mutation, and why not in the query string?",
              rubric: [
                "Input field or header"
              ],
              modelAnswer: "In a mutation input field or header; it's part of the operation's contract, not the transport."
            }
          ]
        }
      ]
    },
  },
  {
    area: "distributed-systems",
    word: {
      term: "Circuit breaker",
      subtitle: "Failing fast when a dependency is unhealthy",
      topics: [
        {
          title: "The three states",
          questions: [
            {
              prompt: "Describe closed, open and half-open, and what moves the breaker between them.",
              rubric: [
                "Thresholds",
                "Half-open trial"
              ],
              modelAnswer: "Closed passes calls; failures over a threshold open it; after a timeout half-open lets trial calls decide."
            }
          ]
        },
        {
          title: "Breakers vs retries",
          questions: [
            {
              prompt: "How can retries without a breaker make an outage worse?",
              rubric: [
                "Retry storm",
                "Load amplification"
              ],
              modelAnswer: "They multiply load on a struggling dependency — a retry storm."
            }
          ]
        },
        {
          title: "Fallbacks",
          questions: [
            {
              prompt: "What makes a good fallback when the breaker is open?",
              rubric: [
                "Cheap",
                "Honest degradation"
              ],
              modelAnswer: "Something cheap and honest: cached data, a degraded feature, or a clear error."
            }
          ]
        },
        {
          title: "Per-dependency scope",
          questions: [
            {
              prompt: "Why scope a breaker per dependency (or per endpoint) instead of globally?",
              rubric: [
                "Blast radius"
              ],
              modelAnswer: "So one bad dependency doesn't cut off healthy ones."
            }
          ]
        }
      ]
    },
  },
];

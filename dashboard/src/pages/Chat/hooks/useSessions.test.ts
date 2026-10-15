import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  overflowsScrollport,
  resetSessionStoreForTests,
  setSearchActive,
  sortSessions,
  toSession,
  useSessions,
  SESSION_PAGE_SIZE,
  SESSION_PREVIEW_LIMIT,
  type Session,
} from "./useSessions";

const listMock = vi.fn();

vi.mock("../../../api/modules/octopThreads", () => ({
  octopThreadsApi: {
    list: (...args: unknown[]) => listMock(...args),
    create: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    rename: vi.fn(),
    rebind: vi.fn(),
  },
  normalizeThreadArtifacts: () => [],
}));

function threadRow(threadId: string, agentExtra?: Partial<{ title: string }>) {
  return {
    thread_id: threadId,
    title: agentExtra?.title ?? null,
    last_active: 1,
    created_at: 1,
    channel_type: "dashboard",
    is_active: false,
    has_messages: true,
    pinned: false,
  };
}

describe("toSession / sortSessions ordering", () => {
  it("sorts empty new chats by created_at above older active ones", () => {
    const olderActive = toSession({
      thread_id: "thr_old",
      title: "old",
      last_active: 100,
      created_at: 10,
      has_messages: true,
    });
    const emptyNew = toSession({
      thread_id: "thr_new",
      title: null,
      last_active: 0,
      created_at: 200,
      has_messages: false,
    });
    expect(
      sortSessions([olderActive, emptyNew]).map((s: Session) => s.id),
    ).toEqual(["thr_new", "thr_old"]);
  });

  it("keeps pinned sessions first", () => {
    const pinned = toSession({
      thread_id: "thr_pin",
      title: "pin",
      last_active: 1,
      created_at: 1,
      pinned: true,
    });
    const recent = toSession({
      thread_id: "thr_recent",
      title: "recent",
      last_active: 999,
      created_at: 999,
    });
    expect(sortSessions([recent, pinned]).map((s) => s.id)).toEqual([
      "thr_pin",
      "thr_recent",
    ]);
  });

  it("maps turn_active and awaiting_user onto the session", () => {
    const session = toSession({
      thread_id: "thr_work",
      title: "busy",
      last_active: 1,
      turn_active: true,
      awaiting_user: true,
    });
    expect(session.turnActive).toBe(true);
    expect(session.awaitingUser).toBe(true);
  });
});

describe("useSessions agent switch", () => {
  beforeEach(() => {
    resetSessionStoreForTests();
    listMock.mockReset();
  });

  afterEach(() => {
    resetSessionStoreForTests();
  });

  it("clears previous-agent threads on the first render of a new agent", async () => {
    listMock.mockImplementation(async (agentId: string) => {
      if (agentId === "agent-a") {
        return [threadRow("thr_from_a")];
      }
      // Keep B's fetch pending so we can observe the sync clear.
      return new Promise(() => {});
    });

    const { result, rerender } = renderHook(
      ({ agentId }: { agentId: string | null }) => useSessions(agentId),
      { initialProps: { agentId: "agent-a" } },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.sessions.map((s) => s.id)).toEqual(["thr_from_a"]);
    });

    rerender({ agentId: "agent-b" });

    // Critical: no one-frame leak of agent-a's thr_* into agent-b.
    expect(result.current.sessions).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(result.current.sessions.some((s) => s.id === "thr_from_a")).toBe(
      false,
    );
  });

  it("ensureThreadInList returns unknown on probe network errors", async () => {
    listMock
      .mockResolvedValueOnce([]) // initial fetch for agent
      .mockRejectedValueOnce(new Error("network down")); // probe

    const { result } = renderHook(() => useSessions("agent-new"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let probe: string | undefined;
    await act(async () => {
      probe = await result.current.ensureThreadInList("thr_foreign");
    });
    expect(probe).toBe("unknown");
  });

  it("ensureThreadInList returns missing when probe confirms absence", async () => {
    listMock.mockResolvedValue([]);

    const { result } = renderHook(() => useSessions("agent-new"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let probe: string | undefined;
    await act(async () => {
      probe = await result.current.ensureThreadInList("thr_foreign");
    });
    expect(probe).toBe("missing");
  });

  it("ensureThreadInList returns found when the thread is already listed", async () => {
    listMock.mockResolvedValue([threadRow("thr_ok")]);

    const { result } = renderHook(() => useSessions("agent-new"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.sessions.map((s) => s.id)).toEqual(["thr_ok"]);
    });

    let probe: string | undefined;
    await act(async () => {
      probe = await result.current.ensureThreadInList("thr_ok");
    });
    expect(probe).toBe("found");
    expect(listMock).toHaveBeenCalledTimes(1);
  });
});

describe("useSessions search widening", () => {
  const AGENT = "agent-search";

  /** Stand-in for a real paginated endpoint: honours the requested limit. */
  function paginateFixture(total: number) {
    listMock.mockImplementation(async (_agentId: string, limit: number) =>
      Array.from({ length: total }, (_, i) =>
        threadRow(`thr_${String(i).padStart(3, "0")}`, {
          title: `session ${i}`,
        }),
      ).slice(0, limit),
    );
  }

  beforeEach(() => {
    resetSessionStoreForTests();
    listMock.mockReset();
  });

  afterEach(() => {
    resetSessionStoreForTests();
  });

  it("reaches sessions past the first page instead of stopping at 50", async () => {
    paginateFixture(120);

    const { result } = renderHook(() => useSessions(AGENT));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // The sidebar starts paginated.
    expect(result.current.sessions.length).toBe(SESSION_PAGE_SIZE);

    await act(async () => {
      setSearchActive(AGENT, true);
      await result.current.fetchAllSessions();
    });

    // A single 50-row request cannot reach row #120, so paging is required.
    expect(listMock.mock.calls.length).toBeGreaterThan(2);
    expect(result.current.sessions.length).toBe(120);
  });

  it("restores the paginated view once the search clears", async () => {
    paginateFixture(120);

    const { result } = renderHook(() => useSessions(AGENT));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      setSearchActive(AGENT, true);
      await result.current.fetchAllSessions();
    });
    expect(result.current.sessions.length).toBe(120);

    // The old code stored the fetched count as the user's loaded limit, so one
    // search left the sidebar stuck at 120 rows with no way back.
    await act(async () => {
      setSearchActive(AGENT, false);
    });
    expect(result.current.sessions.length).toBe(SESSION_PAGE_SIZE);

    // Searching pages to exhaustion sets hasMore=false. Clearing must bring
    // the "load more" affordance back, or the list can never be paged again.
    expect(result.current.hasMore).toBe(true);
  });

  it("reports failure so the search box can offer a retry", async () => {
    listMock.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useSessions(AGENT));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok: boolean | undefined;
    await act(async () => {
      setSearchActive(AGENT, true);
      ok = await result.current.fetchAllSessions();
    });
    expect(ok).toBe(false);
  });
});

describe("session preview cap", () => {
  it("stays quiet at the cap and flags anything past it", () => {
    // The cap is what triggers the "N more" affordance; rows at or below it
    // render in full, so no hint may fire there.
    expect(overflowsScrollport(SESSION_PREVIEW_LIMIT)).toBe(false);
    expect(overflowsScrollport(SESSION_PREVIEW_LIMIT + 1)).toBe(true);
    expect(overflowsScrollport(0)).toBe(false);
  });

  it("keeps the cap well above one scrollport so short lists never hint", () => {
    // A busy agent scrolls inside its own scrollport well before this fires.
    expect(SESSION_PREVIEW_LIMIT).toBeGreaterThan(20);
  });
});

import { useTranslation } from "react-i18next";
import type { RefObject } from "react";
import SessionList from "./SessionList";
import MinimalAgentSessionNav from "./MinimalAgentSessionNav";
import type { Session } from "../hooks/useSessions";
import type { OctopAgent } from "../../../context/AgentContext";
import styles from "../index.module.less";

/** Dispatched when the chat history rail expand control is clicked. */
export const EXPAND_CHAT_RAIL_EVENT = "octop:expand-chat-rail";

interface ChatSidebarPanelProps {
  isMobile: boolean;
  sidebarOpen: boolean;
  sidebarWidth: number;
  isSidebarResizing?: boolean;
  sidebarElRef?: RefObject<HTMLDivElement>;
  agents: OctopAgent[];
  sessions: Session[];
  activeThreadId: string | null;
  resolvedAgentId: string | null | undefined;
  sessionsHasMore: boolean;
  sessionsLoadingMore: boolean;
  onLoadMoreSessions: () => void;
  onFetchAllSessions: () => Promise<boolean>;
  onSelectSession: (sessionId: string, agentId: string) => void;
  onAgentSelect: (agentId: string) => void;
  /** Start a fresh chat from an expert row (classic + minimal). */
  onNewChatWithAgent: (agentId: string) => void;
  onDeleteSession: (
    id: string,
    compact: boolean,
  ) => void | Promise<boolean | void>;
  onRenameSession: (id: string, name: string) => void;
  onPinSession: (id: string, pinned: boolean) => void;
  onForkSession: (id: string, agentId?: string | null) => void;
  forkDisabled?: boolean;
  forkDisabledHint?: string;
  onSidebarOpenChange: (open: boolean) => void;
  onSidebarResizeStart: (e: React.PointerEvent) => void;
  /** Mounted in MainLayout left rail (between app nav and content). */
  layoutRail?: boolean;
  /**
   * Minimal layout: render SessionList only inside the nav "records" pane
   * (no second rail chrome / mobile overlay).
   */
  navEmbedded?: boolean;
}

export default function ChatSidebarPanel({
  isMobile,
  sidebarOpen,
  sidebarWidth,
  isSidebarResizing = false,
  sidebarElRef,
  agents,
  sessions,
  activeThreadId,
  resolvedAgentId,
  sessionsHasMore,
  sessionsLoadingMore,
  onLoadMoreSessions,
  onFetchAllSessions,
  onSelectSession,
  onAgentSelect,
  onNewChatWithAgent,
  onDeleteSession,
  onRenameSession,
  onPinSession,
  onForkSession,
  forkDisabled,
  forkDisabledHint,
  onSidebarOpenChange,
  onSidebarResizeStart,
  layoutRail = false,
  navEmbedded = false,
}: ChatSidebarPanelProps) {
  const { t } = useTranslation();

  const sessionList = navEmbedded ? (
    <MinimalAgentSessionNav
      agents={agents}
      activeId={activeThreadId}
      activeAgentId={resolvedAgentId ?? null}
      activeSessions={sessions}
      onSelect={onSelectSession}
      onAgentSelect={onAgentSelect}
      onNewChat={onNewChatWithAgent}
      onDeleteActive={onDeleteSession}
      onRenameActive={onRenameSession}
      onPinActive={onPinSession}
      onFork={onForkSession}
      activeForkDisabled={forkDisabled}
      activeForkDisabledHint={forkDisabledHint}
    />
  ) : (
    <SessionList
      agents={agents}
      sessions={sessions}
      activeId={activeThreadId}
      activeAgentId={resolvedAgentId ?? null}
      hasMore={sessionsHasMore}
      loadingMore={sessionsLoadingMore}
      onLoadMore={onLoadMoreSessions}
      onFetchAllSessions={onFetchAllSessions}
      onSelect={onSelectSession}
      onAgentSelect={onAgentSelect}
      onNewChat={onNewChatWithAgent}
      onDelete={onDeleteSession}
      onRename={onRenameSession}
      onPin={onPinSession}
      onFork={onForkSession}
      activeForkDisabled={forkDisabled}
      activeForkDisabledHint={forkDisabledHint}
    />
  );

  if (navEmbedded) {
    return (
      <div className={styles.sidebarNavEmbedded} data-testid="chat-nav-records">
        {sessionList}
      </div>
    );
  }

  return (
    <div
      className={`${styles.sidebarWrapper} ${
        layoutRail ? styles.sidebarWrapperLayoutRail : ""
      } ${!isMobile && !sidebarOpen ? styles.sidebarWrapperCollapsed : ""}`}
    >
      {isMobile && sidebarOpen && (
        <div
          className={styles.overlay}
          onClick={() => onSidebarOpenChange(false)}
        />
      )}

      <div
        ref={sidebarElRef}
        className={`${styles.sidebar} ${
          sidebarOpen ? styles.sidebarOpen : ""
        } ${isSidebarResizing ? styles.sidebarResizing : ""}`}
        style={
          !isMobile && sidebarOpen
            ? { width: sidebarWidth, minWidth: sidebarWidth }
            : undefined
        }
      >
        {sessionList}
        {!isMobile && sidebarOpen && (
          <div
            className={`${styles.sidebarResizeHandle} ${
              isSidebarResizing ? styles.sidebarResizeHandleActive : ""
            }`}
            onPointerDown={onSidebarResizeStart}
            role="separator"
            aria-orientation="vertical"
            aria-label={t("chat.resizeSidebar", "调整侧栏宽度")}
          />
        )}
      </div>

      {/*
        No edge button here on purpose. The rail and the conversation meet with
        no gutter: a chip straddling the rail boundary would cover the session
        search box when the nav rail is collapsed, or the app-nav logo when it
        is expanded. The conversation title bar carries the toggle instead
        (``chatTitleSidebarToggle``) — it has room, and it is where Codex /
        DeepSeek put it.
      */}
    </div>
  );
}

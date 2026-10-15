import { useTranslation } from "react-i18next";
import { isTeamAgent } from "../../../utils/teamAgent";
import styles from "../index.module.less";

interface TeamChatBadgeProps {
  agent?: { kind?: string } | null;
  show?: boolean;
  /**
   * Abbreviate to a single glyph. Sidebar rows have ~100px to share between the
   * agent name and every badge; "团队" plus its padding spends ~30px there and
   * pushes the name floor down. Wider surfaces (title bar, welcome line) keep
   * the full label.
   */
  short?: boolean;
}

/**
 * Marks a sidebar row / title / welcome line as a team group chat.
 *
 * Text only: an icon beside the label cost ~13px of a sidebar row that is
 * already tight enough to squeeze the badge down to a single character.
 */
export default function TeamChatBadge({ agent, show, short }: TeamChatBadgeProps) {
  const { t } = useTranslation();
  if (!(show ?? isTeamAgent(agent))) return null;
  const label = t("chat.teamBadge");
  return (
    <span className={styles.teamChatBadge} aria-label={label} title={label}>
      {short ? label.slice(0, 1) : label}
    </span>
  );
}

export type PermissionItem = { code: string; label: string };

export type PermissionGroup = {
  key: string;
  title: string;
  /** In display order: View first, then Manage, then anything else. */
  actions: { code: string; action: string; label: string }[];
};

const ACTION_ORDER = ["view", "manage"];

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/[_-]+/g, " ");
}

/**
 * Turns a flat list of permissions ("leads.view", "leads.manage", "activity.view") into one row per area, so the
 * admin can read "Leads: View, Manage" instead of a wall of checkboxes. Areas keep the order they first appear in.
 */
export function groupPermissions(items: PermissionItem[]): PermissionGroup[] {
  const groups = new Map<string, PermissionGroup>();
  for (const item of items) {
    const [area, ...rest] = item.code.split(".");
    const action = rest.join(".") || "access";
    let group = groups.get(area);
    if (!group) {
      group = { key: area, title: titleCase(area), actions: [] };
      groups.set(area, group);
    }
    group.actions.push({ code: item.code, action, label: titleCase(action) });
  }
  for (const group of groups.values()) {
    group.actions.sort((a, b) => {
      const ai = ACTION_ORDER.indexOf(a.action);
      const bi = ACTION_ORDER.indexOf(b.action);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }
  return [...groups.values()];
}

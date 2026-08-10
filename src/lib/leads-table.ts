export interface Lead {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  website: string | null;
  linkedin: string | null;
  appLink: string | null;
  email: string | null;
  phone: string | null;
  companyType: string;
  likelyToAttend: string;
}

/** Real, externally-sourced data — never trust it as safe markup. */
export function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

/** "SOLUTION_PROVIDER" -> "Solution Provider" — the raw enum value is never shown as-is. */
export function formatCompanyType(companyType: string): string {
  return companyType
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function contactDetailIcons(lead: Lead): string {
  const parts: string[] = [];
  if (lead.email) {
    parts.push(
      `<a href="mailto:${escapeHtml(lead.email)}" class="block hover:text-navy" title="${escapeHtml(lead.email)}">✉ ${escapeHtml(lead.email)}</a>`,
    );
  }
  if (lead.phone) {
    parts.push(`<span>☎ ${escapeHtml(lead.phone)}</span>`);
  }
  if (lead.linkedin) {
    parts.push(
      `<a href="${escapeHtml(lead.linkedin)}" target="_blank" rel="noopener noreferrer" class="block text-navy hover:text-navy-mid">LinkedIn ↗</a>`,
    );
  }
  if (lead.website) {
    parts.push(
      `<a href="${escapeHtml(lead.website)}" target="_blank" rel="noopener noreferrer" class="block text-navy hover:text-navy-mid">Website ↗</a>`,
    );
  }
  if (lead.appLink) {
    parts.push(
      `<a href="${escapeHtml(lead.appLink)}" target="_blank" rel="noopener noreferrer" class="block text-navy hover:text-navy-mid">App ↗</a>`,
    );
  }
  return parts.length
    ? `<div class="flex flex-col gap-0.5 text-[12px] text-ink-soft">${parts.join("")}</div>`
    : `<span class="text-[12px] text-ink-faint">—</span>`;
}

/** Same row markup used by both the directory table and Lead Finder's results table. */
export function leadRowHtml(lead: Lead): string {
  return `
    <tr class="border-b border-line last:border-b-0">
      <td class="px-4 py-3">
        <div class="flex items-center gap-2.5">
          <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lime-tint text-[11px] font-bold text-navy">${escapeHtml(initials(lead.name))}</span>
          <div>
            <p class="text-[14px] font-semibold text-ink">${escapeHtml(lead.name)}</p>
            ${lead.title ? `<p class="text-[12px] text-ink-faint">${escapeHtml(lead.title)}</p>` : ""}
          </div>
        </div>
      </td>
      <td class="px-4 py-3 text-[13px] text-ink-soft">${lead.company ? escapeHtml(lead.company) : "—"}</td>
      <td class="px-4 py-3">${contactDetailIcons(lead)}</td>
      <td class="px-4 py-3">
        <span class="whitespace-nowrap rounded-full bg-lime-tint px-2.5 py-1 text-[12px] font-medium text-navy">${escapeHtml(lead.likelyToAttend)}</span>
      </td>
      <td class="px-4 py-3">
        <span class="whitespace-nowrap rounded-full bg-bg-soft px-2.5 py-1 text-[12px] font-medium text-ink-soft">${escapeHtml(formatCompanyType(lead.companyType))}</span>
      </td>
    </tr>`;
}

export function renderLeadRows(
  tbody: HTMLTableSectionElement,
  leads: Lead[],
  emptyMessage = "No leads match these filters.",
): void {
  if (leads.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-[13px] text-ink-faint">${emptyMessage}</td></tr>`;
    return;
  }
  tbody.innerHTML = leads.map(leadRowHtml).join("");
}

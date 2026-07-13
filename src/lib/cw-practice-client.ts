import {
  isSessionOnAir,
  upcomingCwSessions,
  type CwActivityId,
  type CwSession,
} from "./cw-practice.ts";

type ZoneChoice = "local" | "utc";

const STORAGE_KEY = "cw-practice-time-zone";

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);

  if (!found) {
    throw new Error(`Missing CW Practice Schedule element: ${id}`);
  }

  return found as T;
}

function selectedTimeZone(choice: ZoneChoice): string {
  if (choice === "utc") {
    return "UTC";
  }

  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function zoneChoiceFromStorage(): ZoneChoice {
  const stored = localStorage.getItem(STORAGE_KEY);

  return stored === "utc" ? "utc" : "local";
}

function formatTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

function dateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(date);

  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)?.value ?? "")
    .join("-");
}

function dayLabel(date: Date, now: Date, timeZone: string): string {
  const today = dateKey(now, timeZone);
  const tomorrow = dateKey(new Date(now.getTime() + 24 * 60 * 60 * 1000), timeZone);
  const target = dateKey(date, timeZone);

  if (target === today) {
    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hourCycle: "h23",
        timeZone,
      }).format(date),
    );

    return hour >= 18 ? "Tonight" : "Today";
  }

  if (target === tomorrow) {
    return "Tomorrow";
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone,
  }).format(date);
}

function formatLongDateTime(date: Date, now: Date, timeZone: string): string {
  return `${dayLabel(date, now, timeZone)} · ${formatTime(date, timeZone)}`;
}

function formatZoneLabel(timeZone: string, now: Date): string {
  const formatter = new Intl.DateTimeFormat(undefined, {
    timeZone,
    timeZoneName: "short",
  });
  const abbreviation = formatter
    .formatToParts(now)
    .find((part) => part.type === "timeZoneName")?.value;

  if (timeZone === "UTC") {
    return "UTC · fixed event time";
  }

  return `${timeZone.replaceAll("_", " ")} · ${abbreviation ?? "local time"}`;
}

function durationParts(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60_000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes}m`);
  }

  return parts.slice(0, 2).join(" ");
}

function activityLabel(session: CwSession): string {
  return `${session.activity.abbreviation} · ${session.activity.name}`;
}

function setActivity(element: HTMLElement, activityId: CwActivityId): void {
  element.dataset.activity = activityId;
  element.setAttribute("aria-label", `Open ${activityId.toUpperCase()} exchange walkthrough`);
}

function agendaMarkup(sessions: CwSession[], now: Date, timeZone: string): string {
  return sessions
    .map(
      (session) => `
        <li>
          <button type="button" data-activity="${session.activity.id}" aria-label="Open ${session.activity.abbreviation} exchange walkthrough">
            <span class="cw-clock-agenda-date">${dayLabel(session.start, now, timeZone)}</span>
            <span class="cw-clock-agenda-activity">${session.activity.abbreviation}</span>
            <span class="cw-clock-agenda-name">${session.activity.name}</span>
            <time datetime="${session.start.toISOString()}">${formatTime(session.start, timeZone)}</time>
            <span class="cw-clock-agenda-duration">60 min</span>
          </button>
        </li>
      `,
    )
    .join("");
}

export function initCwPracticeClock(): void {
  const tool = document.getElementById("cw-practice-clock");

  if (!tool) {
    return;
  }

  const primary = element<HTMLButtonElement>("cw-clock-primary");
  const secondary = element<HTMLButtonElement>("cw-clock-next");
  const primaryKicker = element("cw-clock-primary-kicker");
  const primaryActivity = element("cw-clock-primary-activity");
  const primaryTime = element("cw-clock-primary-time");
  const primaryCountdown = element("cw-clock-primary-countdown");
  const progress = element("cw-clock-progress");
  const progressFill = element("cw-clock-progress-fill");
  const secondaryActivity = element("cw-clock-next-activity");
  const secondaryTime = element("cw-clock-next-time");
  const agenda = element<HTMLOListElement>("cw-clock-agenda-list");
  const zoneLabel = element("cw-clock-zone");
  let zoneChoice = zoneChoiceFromStorage();

  function render(): void {
    const now = new Date();
    const timeZone = selectedTimeZone(zoneChoice);
    const sessions = upcomingCwSessions(now, 10);
    const first = sessions[0];
    const second = sessions[1];
    const onAir = isSessionOnAir(first, now);

    zoneLabel.textContent = formatZoneLabel(timeZone, now);
    primaryKicker.textContent = onAir ? "On air now" : "Next up";
    primaryActivity.textContent = activityLabel(first);
    setActivity(primary, first.activity.id);

    if (onAir) {
      const elapsed = now.getTime() - first.start.getTime();
      const remaining = first.end.getTime() - now.getTime();

      primaryTime.textContent = `until ${formatTime(first.end, timeZone)}`;
      primaryCountdown.textContent = `${durationParts(elapsed)} elapsed · ${durationParts(remaining)} left`;
      progress.hidden = false;
      progressFill.style.width = `${Math.min(100, (elapsed / (60 * 60 * 1000)) * 100)}%`;
    } else {
      primaryTime.textContent = formatLongDateTime(first.start, now, timeZone);
      primaryCountdown.textContent = `starts in ${durationParts(first.start.getTime() - now.getTime())}`;
      progress.hidden = true;
      progressFill.style.width = "0";
    }

    secondaryActivity.textContent = activityLabel(second);
    secondaryTime.textContent = formatLongDateTime(second.start, now, timeZone);
    setActivity(secondary, second.activity.id);
    agenda.innerHTML = agendaMarkup(sessions.slice(2, 9), now, timeZone);
  }

  const zoneButtons = Array.from(
    tool.querySelectorAll<HTMLButtonElement>("[data-zone]"),
  );

  function updateZoneButtons(): void {
    for (const button of zoneButtons) {
      button.setAttribute("aria-checked", String(button.dataset.zone === zoneChoice));
    }
  }

  for (const button of zoneButtons) {
    button.addEventListener("click", () => {
      zoneChoice = button.dataset.zone as ZoneChoice;
      localStorage.setItem(STORAGE_KEY, zoneChoice);
      updateZoneButtons();
      render();
    });
  }

  document.addEventListener("click", (event) => {
    const trigger = (event.target as HTMLElement).closest<HTMLElement>("[data-activity]");

    if (!trigger) {
      return;
    }

    const dialog = document.getElementById(
      `cw-dialog-${trigger.dataset.activity}`,
    ) as HTMLDialogElement | null;

    dialog?.showModal();
  });

  for (const dialog of document.querySelectorAll<HTMLDialogElement>(".cw-clock-dialog")) {
    dialog.querySelector<HTMLButtonElement>(".cw-clock-dialog-close")?.addEventListener("click", () => {
      dialog.close();
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        dialog.close();
      }
    });
  }

  const copyButton = element<HTMLButtonElement>("cw-clock-copy-feed");
  const copyStatus = element("cw-clock-copy-status");
  const calendarUrl = new URL(
    copyButton.dataset.calendarPath ?? "/radio/cw-practice/calendar.ics",
    window.location.href,
  );
  const webcalUrl = `webcal://${calendarUrl.host}${calendarUrl.pathname}${calendarUrl.search}`;

  for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-calendar-subscribe]")) {
    link.href = webcalUrl;
  }

  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(calendarUrl.toString());
      copyStatus.textContent = "Copied";
    } catch {
      copyStatus.textContent = "Copy failed; open the feed link instead.";
    }
  });

  updateZoneButtons();
  render();
  window.setInterval(render, 30_000);
}

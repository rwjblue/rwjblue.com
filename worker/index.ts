import {
  buildCwCalendar,
  CW_CALENDAR_PATH,
  CW_CALENDAR_SEQUENCE,
  CW_CALENDAR_VERSION,
} from "../src/lib/cw-practice.ts";
import {
  PUBLICATION_SCHEDULE_PATH,
  type PublicationSchedule,
} from "../src/lib/note-publication.ts";

interface WorkerEnv extends Env {
  PUBLICATION_DEPLOY_HOOK_URL?: string;
}

export function shouldTriggerPublicationBuild(
  schedule: PublicationSchedule,
  scheduledTime: number,
): boolean {
  if (schedule.version !== 1 || schedule.nextPublishAt === null) {
    return false;
  }

  const nextPublishAt = Date.parse(schedule.nextPublishAt);
  if (Number.isNaN(nextPublishAt)) {
    throw new Error("Publication schedule contains an invalid nextPublishAt");
  }

  return nextPublishAt <= scheduledTime;
}

async function scheduledPublicationCheck(
  scheduledTime: number,
  env: WorkerEnv,
): Promise<void> {
  if (!env.PUBLICATION_DEPLOY_HOOK_URL) {
    console.warn("Scheduled publication skipped: deploy hook is not configured");
    return;
  }

  const scheduleResponse = await env.ASSETS.fetch(
    new Request(`https://static-assets.internal${PUBLICATION_SCHEDULE_PATH}`),
  );

  if (!scheduleResponse.ok) {
    throw new Error(
      `Unable to read publication schedule (${scheduleResponse.status})`,
    );
  }

  const schedule = await scheduleResponse.json<PublicationSchedule>();
  if (!shouldTriggerPublicationBuild(schedule, scheduledTime)) {
    return;
  }

  const buildResponse = await fetch(env.PUBLICATION_DEPLOY_HOOK_URL, {
    method: "POST",
  });

  if (!buildResponse.ok) {
    throw new Error(
      `Unable to trigger publication build (${buildResponse.status})`,
    );
  }
}

export function calendarResponse(request: Request): Response {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD" },
    });
  }

  const requestUrl = new URL(request.url);
  const calendarEtag = `"cw-practice-${CW_CALENDAR_VERSION}-${CW_CALENDAR_SEQUENCE}-${requestUrl.host}"`;
  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=300, s-maxage=3600",
    "Content-Disposition": 'inline; filename="cw-practice-schedule.ics"',
    "Content-Type": "text/calendar; charset=utf-8",
    ETag: calendarEtag,
    "Last-Modified": new Date(`${CW_CALENDAR_VERSION}T00:00:00.000Z`).toUTCString(),
    "X-Content-Type-Options": "nosniff",
  });

  if (request.headers.get("If-None-Match") === calendarEtag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(request.method === "HEAD" ? null : buildCwCalendar(requestUrl.origin), {
    headers,
  });
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === CW_CALENDAR_PATH) {
      return calendarResponse(request);
    }

    return env.ASSETS.fetch(request);
  },
  async scheduled(controller, env): Promise<void> {
    await scheduledPublicationCheck(controller.scheduledTime, env);
  },
} satisfies ExportedHandler<WorkerEnv>;

# Blotato API – the parts this project uses

Source: https://help.blotato.com/api (full export: https://help.blotato.com/llms-full.txt).
Base URL: `https://backend.blotato.com/v2`. Auth header on every call: `blotato-api-key: <key>`.
`api.blotato.com` does not exist – do not use it.

## Identity

| Call | Purpose |
|---|---|
| `GET /users/me` | Verify key. Returns `id`, `subscriptionStatus`, `subscriptionPlan`. |
| `GET /users/me/accounts?platform=instagram` | `items[].id` is the `accountId` used when publishing. |

## Media (local files → public URL)

`POST /media/uploads` `{ "filename": "reel.mp4" }` → `{ presignedUrl, publicUrl }`
Then `PUT <presignedUrl>` with header `Content-Type: video/mp4` and the raw bytes.
Use `publicUrl` in `mediaUrls`. The presigned URL expires quickly, upload immediately.
Rate limit 120/min. Upload cap: 400 MB on Starter.

Legacy: `POST /media { "url": "<public url>" }` re-hosts a public URL (30/min).

## Publish

`POST /posts` (30/min)

```json
{
  "post": {
    "accountId": "69683",
    "content": { "text": "caption", "mediaUrls": ["https://..."], "platform": "instagram" },
    "target": {
      "targetType": "instagram",
      "mediaType": "reel",
      "shareToFeed": true,
      "coverImageUrl": "https://... (optional, ≤8MB)",
      "firstComment": "optional, ≤2200 chars"
    }
  },
  "scheduledTime": "2026-09-10T18:30:00+00:00"
}
```

* `scheduledTime` is a ROOT-level sibling of `post`, ISO 8601 with offset. Omit it to publish immediately.
* Response `201 { postSubmissionId, scheduledTime? }`.
* `content.platform` must equal `target.targetType`.

## Status

`GET /posts/:postSubmissionId` (60/min) → `status` ∈ `in-progress | scheduled | published | failed`,
plus `publicUrl` (published), `errorMessage` (failed), `scheduledTime` (scheduled).
Poll every 2 s while `in-progress`. Do not retry `failed`.

## Scheduled queue (Blotato side)

| Call | Purpose |
|---|---|
| `GET /schedules?limit=50&cursor=` | Future scheduled posts: `items[].id` (schedule id), `scheduledAt`, `draft` (same shape as `post`). |
| `PATCH /schedules/:id` `{ "patch": { "scheduledTime": "...", "draft": {...} } }` | Reschedule / edit. Time must be in the future. |
| `DELETE /schedules/:id` | Cancel a scheduled post. |
| `GET /posts?since=&until=&status=scheduled&platform=instagram` | History window (default ±7 days). `items[].id` is the schedule id for scheduled items. |

The create call returns a `postSubmissionId`, not a schedule id. To find the schedule id, list
`/schedules` and match `scheduledAt` + `draft.content.mediaUrls[0]`.

## Instagram media rules

* MP4 (H.264) or MOV, ≤300 MB, 3 s – 15 min for reels.
* Export 1080×1920 (9:16) at ≤25 Mbps to skip Blotato's re-encode. Reels longer than 120 s are not re-encoded, so they must already comply.
* Caption ≤2200 chars. Cover image ≤8 MB JPG/PNG.

## Common failures

* "Failed to read media metadata" – URL not public, or host has bot protection. Presigned upload avoids this.
* "Unsupported media format (.mov)" – re-encode to H.264 MP4.
* "Media conversion failed" – wrong aspect ratio; use 9:16 for reels.

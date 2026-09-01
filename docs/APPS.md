# Connecting the apps

The agent triggers one n8n workflow, **Guest Ops**, on your own n8n instance
(`https://<your-instance>.app.n8n.cloud/workflow/<id>`). Every guest-agent
decision (maintenance, escalation) hits its webhook and logs to the `guest-ops-log`
table. Four app nodes fan out from that log: Slack, Gmail, Airtable, and Google Calendar.
On the reference instance all four are connected and enabled, and one escalation writes to
all four in a single run. On a fresh fork they ship disabled, each waiting on one thing:
a credential only you can connect (it is an OAuth sign-in, so it cannot be done from a
headless session).

Each is a 2-minute, one-time connect in n8n's UI, using accounts you already have.

| Node | What it does | To turn on |
|------|--------------|-----------|
| **Alert operator (Slack)** | Posts every escalation and maintenance issue to your ops channel, so the operator sees it in real time. | Open the node, connect your Slack credential, pick the channel, enable. |
| **Email owner (Gmail)** | Emails the owner (or the guest) a copy of the event. | Connect Gmail, set the recipient, enable. |
| **Ops record (Airtable)** | Writes a row to your Airtable base: a queryable guest/ops CRM. | Connect Airtable, pick base + table, map the fields below, enable. |
| **Schedule fix (Calendar)** | Creates a calendar event to schedule a maintenance visit. | Connect Google Calendar, pick a calendar, enable. |

The fields arriving at every node (use these in the app's field mapping):

- `{{ $json.kind }}` is `maintenance` or `escalation`
- `{{ $json.booking_id }}`
- `{{ $json.summary }}`
- `{{ $json.severity }}` is the urgency or severity
- `{{ $json.logged_at }}`

The Slack and Gmail nodes already have their message text filled with those fields; you
only connect the credential and pick the target. Airtable and Calendar need you to point
at a base/calendar, then map the fields.

Once a node is enabled, re-run `npm run demo` in the agent and watch the event land in
that app. If you connect the credentials and tell me the channel/base/calendar, I will set
the target fields over the API so you do not touch node config at all.

# Back-Admin Monitoring & Recovery Runbook

## Scope
This runbook covers Bookhub instance observability for back-admin:
- OTP-based back-admin authentication (`@datasphir.com` only)
- Instance health snapshots and service status
- Load-over-time graph data from persisted metrics
- Recovery actions when services degrade

## What Is Collected
A scheduled monitor job stores snapshots in `instance_metrics`:
- Service health status (`healthy` / `unhealthy`)
- HTTP status code and latency
- Runtime load averages (`1m`, `5m`, `15m`)
- Runtime memory usage
- Timestamped records for trend charts and log-style event review

## Monitoring Cadence
- Job name: `instance-health-monitor`
- Schedule: every minute (`*/1 * * * *` by default)
- Retention: 14 days (configurable by `INSTANCE_METRIC_RETENTION_DAYS`)

## Back-Admin Flows
1. Enter Datasphir email.
2. Receive OTP email.
3. Verify OTP to create a short-lived back-admin session.
4. Choose:
   - **Manage Instance Activity** (existing user/session/sign-in controls)
   - **Instance Health Check and Logs** (status, load history, logs)

## Recovery Procedure
1. Open **Instance Health Check and Logs** and identify unhealthy services.
2. Confirm impact from latency/error trend in recent metrics.
3. Restart impacted container(s):
   - `sudo docker ps`
   - `sudo docker restart <container_name>`
4. Re-check health after 1-2 monitor cycles.
5. If still unhealthy, inspect container logs and downstream dependencies.
6. Escalate with timestamp + affected service + latest status/error message.

## Recommended Alerting
- Alert when any service remains unhealthy for 3+ consecutive checks.
- Alert when load average remains above baseline threshold for 10+ minutes.
- Alert when memory usage trend exceeds safe capacity baseline.

## Notes
- This setup provides in-app observability data for operators.
- Infrastructure-level observability (Prometheus/Grafana/Loki) can be layered on top later.

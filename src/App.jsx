import { useMemo, useState } from "react";

const DEFAULT_API_BASE =
  "http://127.0.0.1:5001/betterup-hr-mcp/us-central1/mcpApi";
const DEFAULT_WEBHOOK_URL =
  "http://localhost:5678/webhook-test/fbcc0baa-4037-4c00-a5c1-a4992251ea31";

const EMPTY_HIRE = {
  employeeId: "",
  firstName: "",
  lastName: "",
  email: "",
  department: "",
  role: "",
  managerEmail: "",
  location: "US"
};

export default function App() {
  const [activeView, setActiveView] = useState("lookup");
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE);
  const [employeeId, setEmployeeId] = useState("");
  const [logs, setLogs] = useState([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState("");

  const [webhookUrl, setWebhookUrl] = useState(DEFAULT_WEBHOOK_URL);
  const [hireForm, setHireForm] = useState(EMPTY_HIRE);
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [submissionResult, setSubmissionResult] = useState(null);

  const summary = useMemo(() => {
    return logs.reduce(
      (accumulator, log) => {
        accumulator.total += 1;
        accumulator[log.status] = (accumulator[log.status] || 0) + 1;
        return accumulator;
      },
      { total: 0, success: 0, failure: 0 }
    );
  }, [logs]);

  async function handleLookupSubmit(event) {
    event.preventDefault();

    const normalizedEmployeeId = employeeId.trim();
    const normalizedApiBase = apiBase.trim().replace(/\/$/, "");

    if (!normalizedEmployeeId) {
      setLookupError("Enter an employee ID to load audit activity.");
      setLogs([]);
      return;
    }

    setLookupLoading(true);
    setLookupError("");

    try {
      const url = new URL(`${normalizedApiBase}/audit/tool-invocations`);
      url.searchParams.set("employeeId", normalizedEmployeeId);

      const response = await fetch(url.toString(), {
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        const fallbackMessage = `Request failed with status ${response.status}`;
        const text = await response.text();
        throw new Error(text || fallbackMessage);
      }

      const data = await response.json();
      const items = Array.isArray(data.items) ? data.items : [];

      items.sort((left, right) => {
        const leftTime = new Date(left.timestamp || 0).getTime();
        const rightTime = new Date(right.timestamp || 0).getTime();
        return rightTime - leftTime;
      });

      setLogs(items);
      setLastLoadedAt(new Date().toLocaleString());
    } catch (requestError) {
      setLogs([]);
      setLastLoadedAt("");
      setLookupError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load audit logs."
      );
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleNewSubmit(event) {
    event.preventDefault();

    const normalizedWebhookUrl = webhookUrl.trim();
    const payload = {
      employeeId: hireForm.employeeId.trim(),
      firstName: hireForm.firstName.trim(),
      lastName: hireForm.lastName.trim(),
      email: hireForm.email.trim(),
      department: hireForm.department.trim(),
      role: hireForm.role.trim(),
      managerEmail: hireForm.managerEmail.trim(),
      location: hireForm.location.trim()
    };

    const missingField = Object.entries(payload).find(([, value]) => !value);
    if (missingField) {
      setSubmissionError(`Fill in ${missingField[0]} before submitting.`);
      setSubmissionResult(null);
      return;
    }

    setSubmissionLoading(true);
    setSubmissionError("");
    setSubmissionResult(null);

    try {
      const response = await fetch(normalizedWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload)
      });

      const body = await parseResponseBody(response);

      if (!response.ok) {
        throw new Error(
          typeof body === "string" && body
            ? body
            : `Request failed with status ${response.status}`
        );
      }

      setSubmissionResult({
        sentAt: new Date().toLocaleString(),
        payload,
        response: body
      });

      setEmployeeId(payload.employeeId);
    } catch (requestError) {
      setSubmissionError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to submit the onboarding request."
      );
    } finally {
      setSubmissionLoading(false);
    }
  }

  function updateHireField(field, value) {
    setHireForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  return (
    <div className="shell">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">HR Control Room</p>
          <h1>MCP Audit Status Dashboard</h1>
          <p className="lede">
            Inspect employee onboarding activity across Okta, Google Workspace,
            Slack, Jira, and Freshservice, or trigger a new onboarding run
            through n8n.
          </p>
        </div>

        <div className="hero-metrics">
          <MetricCard label="Events" value={summary.total} accent="sun" />
          <MetricCard label="Success" value={summary.success} accent="mint" />
          <MetricCard label="Failure" value={summary.failure} accent="ink" />
        </div>
      </header>

      <main className="dashboard">
        <aside className="panel sidebar-panel">
          <div className="panel-heading">
            <p className="eyebrow">Navigation</p>
            <h2>Workspace</h2>
          </div>

          <div className="sidebar-nav">
            <button
              type="button"
              className={activeView === "lookup" ? "nav-tab active" : "nav-tab"}
              onClick={() => setActiveView("lookup")}
            >
              Lookup
            </button>
            <button
              type="button"
              className={activeView === "new" ? "nav-tab active" : "nav-tab"}
              onClick={() => setActiveView("new")}
            >
              New
            </button>
          </div>

          {activeView === "lookup" ? (
            <form className="query-form" onSubmit={handleLookupSubmit}>
              <label>
                API base URL
                <input
                  type="url"
                  value={apiBase}
                  onChange={(event) => setApiBase(event.target.value)}
                  placeholder={DEFAULT_API_BASE}
                />
              </label>

              <label>
                Employee ID
                <input
                  type="text"
                  value={employeeId}
                  onChange={(event) => setEmployeeId(event.target.value)}
                  placeholder="EMP-10234"
                />
              </label>

              <button type="submit" disabled={lookupLoading}>
                {lookupLoading ? "Loading..." : "Load Audit Logs"}
              </button>
            </form>
          ) : (
            <form className="query-form" onSubmit={handleNewSubmit}>
              <label>
                n8n webhook URL
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(event) => setWebhookUrl(event.target.value)}
                  placeholder={DEFAULT_WEBHOOK_URL}
                />
              </label>

              <div className="stacked-fields">
                <label>
                  Employee ID
                  <input
                    type="text"
                    value={hireForm.employeeId}
                    onChange={(event) =>
                      updateHireField("employeeId", event.target.value)
                    }
                    placeholder="EMP-10234"
                  />
                </label>

                <label>
                  First name
                  <input
                    type="text"
                    value={hireForm.firstName}
                    onChange={(event) =>
                      updateHireField("firstName", event.target.value)
                    }
                    placeholder="Jordan"
                  />
                </label>

                <label>
                  Last name
                  <input
                    type="text"
                    value={hireForm.lastName}
                    onChange={(event) =>
                      updateHireField("lastName", event.target.value)
                    }
                    placeholder="Lee"
                  />
                </label>

                <label>
                  Email
                  <input
                    type="email"
                    value={hireForm.email}
                    onChange={(event) =>
                      updateHireField("email", event.target.value)
                    }
                    placeholder="jordan.lee@helioshr.com"
                  />
                </label>

                <label>
                  Department
                  <input
                    type="text"
                    value={hireForm.department}
                    onChange={(event) =>
                      updateHireField("department", event.target.value)
                    }
                    placeholder="Engineering"
                  />
                </label>

                <label>
                  Role
                  <input
                    type="text"
                    value={hireForm.role}
                    onChange={(event) =>
                      updateHireField("role", event.target.value)
                    }
                    placeholder="Frontend Engineer"
                  />
                </label>

                <label>
                  Manager email
                  <input
                    type="email"
                    value={hireForm.managerEmail}
                    onChange={(event) =>
                      updateHireField("managerEmail", event.target.value)
                    }
                    placeholder="manager@helioshr.com"
                  />
                </label>

                <label>
                  Location
                  <input
                    type="text"
                    value={hireForm.location}
                    onChange={(event) =>
                      updateHireField("location", event.target.value)
                    }
                    placeholder="US"
                  />
                </label>
              </div>

              <button type="submit" disabled={submissionLoading}>
                {submissionLoading ? "Posting..." : "Trigger New Hire Workflow"}
              </button>
            </form>
          )}

          <div className="panel-notes">
            {activeView === "lookup" ? (
              <>
                <p>
                  Default target: <code>{DEFAULT_API_BASE}</code>
                </p>
                <p>
                  Query sent to:
                  <code> /audit/tool-invocations?employeeId=&lt;id&gt;</code>
                </p>
              </>
            ) : (
              <>
                <p>
                  Default webhook: <code>{DEFAULT_WEBHOOK_URL}</code>
                </p>
                <p>
                  The form posts the employee object directly to the n8n test
                  webhook.
                </p>
              </>
            )}
          </div>
        </aside>

        <section className="panel results-panel">
          {activeView === "lookup" ? (
            <>
              <div className="panel-heading">
                <p className="eyebrow">Results</p>
                <h2>Activity Timeline</h2>
              </div>

              {lookupError ? <div className="feedback error">{lookupError}</div> : null}
              {lastLoadedAt ? (
                <div className="feedback meta">Last refreshed {lastLoadedAt}</div>
              ) : null}

              {logs.length === 0 && !lookupLoading && !lookupError ? (
                <EmptyState />
              ) : null}

              <div className="log-grid">
                {logs.map((log, index) => (
                  <article
                    className="log-card"
                    key={`${log.toolName}-${log.timestamp}-${index}`}
                  >
                    <div className="log-card-header">
                      <div>
                        <p className="log-tool">{log.toolName || "unknown_tool"}</p>
                        <p className="log-meta">
                          {formatDate(log.timestamp)} · {log.actor || "unknown actor"}
                        </p>
                      </div>
                      <span className={`status-pill ${log.status || "unknown"}`}>
                        {log.status || "unknown"}
                      </span>
                    </div>

                    <dl className="detail-list">
                      <div>
                        <dt>Employee</dt>
                        <dd>{log.employeeId || "n/a"}</dd>
                      </div>
                      <div>
                        <dt>Execution</dt>
                        <dd>{log.executionId || "n/a"}</dd>
                      </div>
                    </dl>

                    <div className="payload-block">
                      <p>Details</p>
                      <pre>{formatJson(log.details)}</pre>
                    </div>

                    {log.error ? (
                      <div className="payload-block error-block">
                        <p>Error</p>
                        <pre>{formatJson(log.error)}</pre>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="panel-heading">
                <p className="eyebrow">New</p>
                <h2>Workflow Dispatch</h2>
              </div>

              {submissionError ? (
                <div className="feedback error">{submissionError}</div>
              ) : null}

              {!submissionResult && !submissionLoading && !submissionError ? (
                <div className="empty-state">
                  <h3>Ready to create a new hire request</h3>
                  <p>
                    Complete the employee details in the sidebar and post the
                    payload to the n8n webhook.
                  </p>
                </div>
              ) : null}

              {submissionResult ? (
                <div className="submission-stack">
                  <div className="feedback meta">
                    Posted successfully at {submissionResult.sentAt}
                  </div>

                  <div className="payload-block">
                    <p>Payload sent</p>
                    <pre>{formatJson(submissionResult.payload)}</pre>
                  </div>

                  <div className="payload-block">
                    <p>Webhook response</p>
                    <pre>{formatJson(submissionResult.response)}</pre>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function MetricCard({ label, value, accent }) {
  return (
    <div className={`metric-card ${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <h3>No audit logs loaded</h3>
      <p>Enter an employee ID to pull the latest MCP activity for that user.</p>
    </div>
  );
}

function formatDate(value) {
  if (!value) {
    return "Unknown time";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown time" : date.toLocaleString();
}

function formatJson(value) {
  return JSON.stringify(value || {}, null, 2);
}

async function parseResponseBody(response) {
  const text = await response.text();

  if (!text) {
    return {
      status: response.status,
      message: "No response body returned."
    };
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

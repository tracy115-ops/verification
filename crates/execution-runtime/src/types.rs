use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FrameworkProfile {
    pub id: String,
    pub name: String,
    pub adapter: String,
    pub python_command: String,
    pub framework_source: String,
    pub instructions: String,
    pub target_url: String,
    pub timeout_seconds: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TestMapping {
    pub test_name: String,
    pub case_ids: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ImplementationBundle {
    pub script: String,
    pub tests: Vec<TestMapping>,
    pub questions: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ExecutionPayload {
    pub session_id: String,
    pub run_id: String,
    pub execution_id: String,
    pub profile: FrameworkProfile,
    pub implementation: ImplementationBundle,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ExecutionPlan {
    pub digest: String,
    pub script_sha256: String,
    pub framework_sha256: String,
    pub python_version: String,
    pub test_names: Vec<String>,
    pub payload: ExecutionPayload,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TestResult {
    pub test_name: String,
    pub status: String,
    pub details: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EvidenceBundle {
    pub execution_id: String,
    pub plan_digest: String,
    pub results: Vec<TestResult>,
    pub requests: Vec<serde_json::Value>,
    pub raw_evidence_sha256: String,
    pub result_sha256: String,
    pub workspace_id: String,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ExecutionEvent {
    Activity { name: String },
    Heartbeat,
}

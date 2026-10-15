# Current Host deployment

The [deployment receipt](alpha-compat-deployment.json) records the final artifact digest, installed file verification and current Host identity. Version 0.1.2 was installed into profile web and dsh-web restarted on port 3080 with Supervisor 0.1.6.

Twenty focused tests, strict checking, build and package checks passed. Real deepseek-v4.1-flash requests completed through CodeBuddy and OpenCode Go. The running daily catalog refreshed with no error: 86 Zen models and 37 Go models at the recorded observation time. Availability depends on the account and current upstream catalog.

Validation reused cached dependencies and existing build approvals in a dedicated test home; it does not prove a fresh registry/store installation. The final artifact differs from the model-tested candidate only in prose, and its runtime bytes were compared. npm publication was not performed. Credentials and prior daily Session directories remain intact.

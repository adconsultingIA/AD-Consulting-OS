CREATE TABLE IF NOT EXISTS copilot_action_proposals (
    id VARCHAR PRIMARY KEY NOT NULL,
    organization_id VARCHAR NOT NULL,
    user_id VARCHAR NOT NULL,
    action_code VARCHAR(100) NOT NULL,
    payload JSON NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME NULL,
    result_entity_type VARCHAR(50) NULL,
    result_entity_id VARCHAR NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_copilot_action_proposals_id
    ON copilot_action_proposals (id);

CREATE INDEX IF NOT EXISTS ix_copilot_action_proposals_organization_id
    ON copilot_action_proposals (organization_id);

CREATE INDEX IF NOT EXISTS ix_copilot_action_proposals_user_id
    ON copilot_action_proposals (user_id);

CREATE INDEX IF NOT EXISTS ix_copilot_action_proposals_action_code
    ON copilot_action_proposals (action_code);

CREATE INDEX IF NOT EXISTS ix_copilot_action_proposals_status
    ON copilot_action_proposals (status);

CREATE INDEX IF NOT EXISTS ix_copilot_action_proposals_expires_at
    ON copilot_action_proposals (expires_at);

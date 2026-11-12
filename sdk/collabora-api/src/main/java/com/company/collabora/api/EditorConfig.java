package com.company.collabora.api;

import java.util.Objects;

public final class EditorConfig {
    private final String applicationId;
    public EditorConfig(String applicationId) { this.applicationId = Objects.requireNonNull(applicationId, "applicationId"); }
    public String getApplicationId() { return applicationId; }
}

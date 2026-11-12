package com.company.collabora.api;

public interface CollaboraEditor {
    void initialize(EditorConfig config, EditorCallback callback);
    void openDocument(String documentPath, EditorCallback callback);
    void createDocument(DocumentType type, EditorCallback callback);
    void saveDocument(EditorCallback callback);
    void closeDocument(EditorCallback callback);
    void destroy();
}

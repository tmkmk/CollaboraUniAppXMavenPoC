package com.company.collabora.demo;

import com.company.collabora.api.CollaboraEditor;
import com.company.collabora.api.DocumentType;
import com.company.collabora.api.EditorCallback;
import com.company.collabora.api.EditorConfig;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;

public final class ApiDemo {
    private ApiDemo() {}

    public static void main(String[] args) {
        List<String> calls = new ArrayList<>();
        EditorCallback callback = new EditorCallback() {
            @Override public void onSuccess() { calls.add("success"); }
            @Override public void onError(com.company.collabora.api.EditorError error) {
                throw new AssertionError(error.getCode() + ": " + error.getMessage());
            }
        };

        CollaboraEditor editor = (CollaboraEditor) Proxy.newProxyInstance(
                CollaboraEditor.class.getClassLoader(),
                new Class<?>[] { CollaboraEditor.class },
                (proxy, method, methodArgs) -> {
                    calls.add(method.getName());
                    if ("initialize".equals(method.getName())
                            || "openDocument".equals(method.getName())
                            || "createDocument".equals(method.getName())
                            || "saveDocument".equals(method.getName())
                            || "closeDocument".equals(method.getName())) {
                        ((EditorCallback) methodArgs[methodArgs.length - 1]).onSuccess();
                    }
                    return null;
                });

        editor.initialize(new EditorConfig("com.company.demo"), callback);
        editor.openDocument("/tmp/sample.docx", callback);
        editor.createDocument(DocumentType.DOCX, callback);
        editor.saveDocument(callback);
        editor.closeDocument(callback);
        editor.destroy();

        long callbacks = calls.stream().filter(call -> "success".equals(call)).count();
        if (callbacks != 5 || !calls.contains("destroy")) {
            throw new AssertionError("Unexpected API calls: " + calls);
        }
        System.out.println("API Maven dependency and contract invocation verified: " + calls);
    }
}

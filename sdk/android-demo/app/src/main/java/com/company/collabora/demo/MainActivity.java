package com.company.collabora.demo;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.TextView;
import android.widget.Toast;

public final class MainActivity extends Activity {
    private static final int REQUEST_OPEN_WORD_DOCUMENT = 1;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        TextView result = new TextView(this);
        result.setText("Open Word document (.doc / .docx)");
        setContentView(result);
        result.setOnClickListener(view -> openWordPicker());
        openWordPicker();
    }

    private void openWordPicker() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] {
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        });
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        try {
            startActivityForResult(intent, REQUEST_OPEN_WORD_DOCUMENT);
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, "No system file picker is available", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQUEST_OPEN_WORD_DOCUMENT || resultCode != RESULT_OK || data == null) return;

        Uri document = data.getData();
        if (document == null || !isWordDocument(document)) {
            Toast.makeText(this, "Only .doc and .docx files are supported", Toast.LENGTH_LONG).show();
            return;
        }

        Intent editIntent = new Intent(Intent.ACTION_VIEW);
        editIntent.setClassName(this, "org.libreoffice.androidlib.LOActivity");
        editIntent.setDataAndType(document, getContentResolver().getType(document));
        editIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        startActivity(editIntent);
    }

    private boolean isWordDocument(Uri document) {
        String name = document.getLastPathSegment();
        if (name != null) {
            int dot = name.lastIndexOf('.');
            String extension = dot < 0 ? "" : name.substring(dot + 1);
            if ("doc".equalsIgnoreCase(extension) || "docx".equalsIgnoreCase(extension)) return true;
        }
        String mimeType = getContentResolver().getType(document);
        return "application/msword".equals(mimeType)
                || "application/vnd.openxmlformats-officedocument.wordprocessingml.document".equals(mimeType);
    }
}

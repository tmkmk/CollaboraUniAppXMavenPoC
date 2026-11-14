from pathlib import Path
import difflib

original = Path('sdk/collabora-engine/word-only-build.gradle.orig').read_text(encoding='utf-8-sig')
updated = original
updated = updated.replace('''    from("${coExampleDocument}") {
        rename ".*", "example.odt"
    }
''', '''    if (project.findProperty("wordOnly") != "true") {
        from("${coExampleDocument}") {
            rename ".*", "example.odt"
        }
    }
''')
updated = updated.replace("includes = ['registry/**', 'filter/**', 'gallery/**', 'palette/**', 'theme_definitions/collabora/**']", "includes = ['registry/**', 'filter/**', 'gallery/**', 'palette/**', 'theme_definitions/collabora/**']\n        if (project.findProperty('wordOnly') == 'true') {\n            exclude 'gallery/**'\n        }")
updated = updated.replace('''    from "${rootProject.getRootDir()}/templates/untitled.odp",
            "${rootProject.getRootDir()}/templates/untitled.ods",
            "${rootProject.getRootDir()}/templates/untitled.odt",
            "${rootProject.getRootDir()}/templates/untitled.pptx",
            "${rootProject.getRootDir()}/templates/untitled.xlsx",
            "${rootProject.getRootDir()}/templates/untitled.docx"
''', '''    if (project.findProperty("wordOnly") == "true") {
        from "${rootProject.getRootDir()}/templates/untitled.docx"
    } else {
        from "${rootProject.getRootDir()}/templates/untitled.odp",
                "${rootProject.getRootDir()}/templates/untitled.ods",
                "${rootProject.getRootDir()}/templates/untitled.odt",
                "${rootProject.getRootDir()}/templates/untitled.pptx",
                "${rootProject.getRootDir()}/templates/untitled.xlsx",
                "${rootProject.getRootDir()}/templates/untitled.docx"
    }
''')
updated = updated.replace('''        }.result.get()
    }
}

tasks.register('generateCoolReleaseAssets')''', '''        }.result.get()
        if (project.findProperty('wordOnly') == 'true') {
            delete fileTree('src/debug/assets/dist') { include 'videobackgrounds/**', 'templates/files/presentation/**', 'templates/files/spreadsheet/**' }
        }
    }
}

tasks.register('generateCoolReleaseAssets')''')
updated = updated.replace('''        }.result.get()
    }
}

afterEvaluate''', '''        }.result.get()
        if (project.findProperty('wordOnly') == 'true') {
            delete fileTree('src/release/assets/dist') { include 'videobackgrounds/**', 'templates/files/presentation/**', 'templates/files/spreadsheet/**' }
        }
    }
}

afterEvaluate''')
assert updated != original
Path('sdk/collabora-engine/build.gradle.word').write_text(updated, encoding='utf-8')
patch = difflib.unified_diff(original.splitlines(True), updated.splitlines(True), fromfile='a/android/lib/build.gradle', tofile='b/android/lib/build.gradle')
Path('sdk/collabora-engine/word-only-assets.patch').write_text(''.join(patch), encoding='utf-8')

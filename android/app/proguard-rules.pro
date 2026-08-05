# Capacitor ProGuard rules
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class * extends com.getcapacitor.Plugin { *; }


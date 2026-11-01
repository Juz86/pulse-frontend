# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# WebRTC's native JNI bridge resolves Java classes, methods and callbacks by
# their original names. The upstream AAR does not currently ship consumer keep
# rules, so release minification must preserve both bridge packages. In
# particular, JNI_OnLoad loads org.jni_zero.JniInit before WebRTC starts.
-keep class org.webrtc.** { *; }
-keep class org.jni_zero.** { *; }
-keepattributes RuntimeVisibleAnnotations,RuntimeInvisibleAnnotations,AnnotationDefault,Signature,InnerClasses,EnclosingMethod
-dontwarn org.webrtc.**
-dontwarn org.jni_zero.**

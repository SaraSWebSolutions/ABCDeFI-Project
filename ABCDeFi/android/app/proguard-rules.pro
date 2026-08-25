# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# JNA library fixes for Android
-keep class com.sun.jna.** { *; }
-keep class com.sun.jna.internal.** { *; }
-dontwarn java.awt.**
-dontwarn javax.swing.**
-dontwarn sun.awt.**
-dontwarn com.sun.jna.Native
-dontwarn com.sun.jna.Platform

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep JNA callback classes
-keep class * implements com.sun.jna.Callback { *; }

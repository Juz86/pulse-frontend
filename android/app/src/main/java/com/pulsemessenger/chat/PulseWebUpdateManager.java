package com.pulsemessenger.chat;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.util.Base64;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Downloads only a signed Pulse web bundle and lets Capacitor host it locally.
 * This deliberately never changes native code, plugins or the app origin.
 */
final class PulseWebUpdateManager {
    private static final String UPDATE_PREFS = "PulseNativeWebUpdates";
    private static final String STAGED_PATH = "stagedPath";
    private static final String STAGED_VERSION = "stagedVersion";
    private static final String PENDING_PATH = "pendingPath";
    private static final String PENDING_VERSION = "pendingVersion";
    private static final String PREVIOUS_PATH = "previousPath";
    private static final String ACTIVE_VERSION = "activeVersion";
    private static final String CAP_PREFS = "CapWebViewSettings";
    private static final String CAP_SERVER_PATH = "serverBasePath";
    private static final String UPDATE_DIR = "pulse-native-updates";
    private static final int MAX_BUNDLE_BYTES = 25 * 1024 * 1024;
    private static final long MAX_UNPACKED_BYTES = 80L * 1024 * 1024;

    private PulseWebUpdateManager() {}

    static boolean isEnabled() {
        return !BuildConfig.PULSE_E2EE_INTERNAL_PLAY_TEST
            && BuildConfig.PULSE_NATIVE_UPDATE_PUBLIC_KEY != null
            && !BuildConfig.PULSE_NATIVE_UPDATE_PUBLIC_KEY.trim().isEmpty();
    }

    static synchronized void prepareForAppStart(Context context) {
        if (BuildConfig.PULSE_E2EE_INTERNAL_PLAY_TEST) {
            resetToBundledAssets(context);
            return;
        }
        if (!isEnabled()) return;
        SharedPreferences prefs = prefs(context);
        String pendingPath = prefs.getString(PENDING_PATH, "");
        if (!pendingPath.isEmpty()) {
            // The previous candidate never acknowledged a healthy app start.
            setCapacitorPath(context, prefs.getString(PREVIOUS_PATH, ""));
            prefs.edit().remove(PENDING_PATH).remove(PENDING_VERSION).remove(PREVIOUS_PATH).apply();
        }

        String stagedPath = prefs.getString(STAGED_PATH, "");
        if (stagedPath.isEmpty() || !new File(stagedPath, "index.html").isFile()) return;
        String previousPath = getCapacitorPath(context);
        prefs.edit()
            .putString(PENDING_PATH, stagedPath)
            .putString(PENDING_VERSION, prefs.getString(STAGED_VERSION, ""))
            .putString(PREVIOUS_PATH, previousPath == null ? "" : previousPath)
            .remove(STAGED_PATH)
            .remove(STAGED_VERSION)
            .apply();
        setCapacitorPath(context, stagedPath);
    }

    private static void resetToBundledAssets(Context context) {
        setCapacitorPath(context, "");
        prefs(context).edit().clear().apply();
        deleteTree(new File(context.getFilesDir(), UPDATE_DIR));
    }

    static synchronized void markHealthy(Context context) {
        SharedPreferences prefs = prefs(context);
        String pendingVersion = prefs.getString(PENDING_VERSION, "");
        if (!pendingVersion.isEmpty()) {
            prefs.edit().putString(ACTIVE_VERSION, pendingVersion).apply();
        }
        prefs.edit().remove(PENDING_PATH).remove(PENDING_VERSION).remove(PREVIOUS_PATH).apply();
    }

    static synchronized Result stageLatest(Context context) throws Exception {
        if (!isEnabled()) return Result.disabled();
        JSONObject manifest = new JSONObject(readText(secureConnection(BuildConfig.PULSE_NATIVE_UPDATE_MANIFEST_URL), 32 * 1024));
        String version = manifest.optString("version", "");
        String bundleUrl = manifest.optString("bundleUrl", "");
        String sha256 = manifest.optString("sha256", "").toLowerCase();
        String signature = manifest.optString("signature", "");
        long bundleSize = manifest.optLong("bundleSize", -1);
        if (manifest.optInt("schemaVersion", 0) != 1 || !version.matches("[A-Za-z0-9][A-Za-z0-9._-]{0,79}")
            || !sha256.matches("[0-9a-f]{64}") || bundleSize < 1 || bundleSize > MAX_BUNDLE_BYTES) {
            throw new SecurityException("Ongeldig update-manifest");
        }
        assertPulseUrl(bundleUrl);
        String payload = String.join("\n", "pulse-native-update-v1", version, bundleUrl, sha256, String.valueOf(bundleSize));
        if (!verifySignature(payload.getBytes(StandardCharsets.UTF_8), signature)) {
            throw new SecurityException("Handtekening van update-manifest is ongeldig");
        }
        SharedPreferences prefs = prefs(context);
        if (version.equals(prefs.getString(ACTIVE_VERSION, "")) || version.equals(prefs.getString(STAGED_VERSION, ""))) {
            return Result.current(version);
        }

        File root = new File(context.getFilesDir(), UPDATE_DIR);
        if (!root.exists() && !root.mkdirs()) throw new IllegalStateException("Kan update-map niet maken");
        File zipFile = new File(root, version + ".zip");
        downloadBundle(bundleUrl, zipFile, bundleSize, sha256);
        File target = new File(root, version);
        File temporary = new File(root, version + ".tmp");
        deleteTree(temporary);
        try {
            unpack(zipFile, temporary);
            if (!new File(temporary, "index.html").isFile()) throw new SecurityException("Update bevat geen index.html");
            deleteTree(target);
            if (!temporary.renameTo(target)) throw new IllegalStateException("Kan update niet atomair activeren");
            prefs.edit().putString(STAGED_PATH, target.getCanonicalPath()).putString(STAGED_VERSION, version).apply();
            return Result.staged(version);
        } finally {
            deleteTree(temporary);
            if (zipFile.exists()) zipFile.delete();
        }
    }

    private static void downloadBundle(String bundleUrl, File destination, long expectedSize, String expectedHash) throws Exception {
        HttpURLConnection connection = secureConnection(bundleUrl);
        try (InputStream input = new BufferedInputStream(connection.getInputStream()); FileOutputStream output = new FileOutputStream(destination)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[8192];
            long total = 0;
            int read;
            while ((read = input.read(buffer)) != -1) {
                total += read;
                if (total > MAX_BUNDLE_BYTES || total > expectedSize) throw new SecurityException("Updatebestand is te groot");
                digest.update(buffer, 0, read);
                output.write(buffer, 0, read);
            }
            if (total != expectedSize || !toHex(digest.digest()).equals(expectedHash)) throw new SecurityException("Updatebestand komt niet overeen met manifest");
        } finally {
            connection.disconnect();
        }
    }

    private static void unpack(File zipFile, File target) throws Exception {
        String root = target.getCanonicalPath() + File.separator;
        long total = 0;
        try (ZipInputStream zip = new ZipInputStream(new BufferedInputStream(new FileInputStream(zipFile)))) {
            ZipEntry entry;
            byte[] buffer = new byte[8192];
            while ((entry = zip.getNextEntry()) != null) {
                File output = new File(target, entry.getName());
                if (!output.getCanonicalPath().startsWith(root)) throw new SecurityException("Ongeldig pad in updatebestand");
                if (entry.isDirectory()) {
                    if (!output.mkdirs() && !output.isDirectory()) throw new IllegalStateException("Kan update-map niet uitpakken");
                    continue;
                }
                File parent = output.getParentFile();
                if (!parent.exists() && !parent.mkdirs()) throw new IllegalStateException("Kan update-map niet uitpakken");
                try (FileOutputStream stream = new FileOutputStream(output)) {
                    int read;
                    while ((read = zip.read(buffer)) != -1) {
                        total += read;
                        if (total > MAX_UNPACKED_BYTES) throw new SecurityException("Uitgepakte update is te groot");
                        stream.write(buffer, 0, read);
                    }
                }
            }
        }
    }

    private static HttpURLConnection secureConnection(String value) throws Exception {
        assertPulseUrl(value);
        HttpURLConnection connection = (HttpURLConnection) new URL(value).openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(10_000);
        connection.setReadTimeout(30_000);
        connection.setUseCaches(false);
        connection.setRequestProperty("Cache-Control", "no-cache");
        if (connection.getResponseCode() != 200) throw new IllegalStateException("Update-server gaf geen succesvolle reactie");
        return connection;
    }

    private static void assertPulseUrl(String value) throws Exception {
        Uri uri = Uri.parse(value);
        if (!"https".equals(uri.getScheme()) || !"web.pulse-messenger.com".equals(uri.getHost()) || uri.getUserInfo() != null || uri.getPort() != -1) {
            throw new SecurityException("Update komt niet van de toegestane Pulse-server");
        }
    }

    private static boolean verifySignature(byte[] data, String encodedSignature) throws Exception {
        byte[] keyBytes = Base64.decode(BuildConfig.PULSE_NATIVE_UPDATE_PUBLIC_KEY, Base64.DEFAULT);
        PublicKey publicKey = KeyFactory.getInstance("EC").generatePublic(new X509EncodedKeySpec(keyBytes));
        Signature verifier = Signature.getInstance("SHA256withECDSA");
        verifier.initVerify(publicKey);
        verifier.update(data);
        return verifier.verify(Base64.decode(encodedSignature, Base64.DEFAULT));
    }

    private static String readText(HttpURLConnection connection, int maximumBytes) throws Exception {
        try (InputStream input = connection.getInputStream()) {
            byte[] buffer = new byte[4096];
            int total = 0;
            StringBuilder builder = new StringBuilder();
            int read;
            while ((read = input.read(buffer)) != -1) {
                total += read;
                if (total > maximumBytes) throw new SecurityException("Manifest is te groot");
                builder.append(new String(buffer, 0, read, StandardCharsets.UTF_8));
            }
            return builder.toString();
        } finally {
            connection.disconnect();
        }
    }

    private static SharedPreferences prefs(Context context) { return context.getSharedPreferences(UPDATE_PREFS, Context.MODE_PRIVATE); }
    private static String getCapacitorPath(Context context) { return context.getSharedPreferences(CAP_PREFS, Context.MODE_PRIVATE).getString(CAP_SERVER_PATH, ""); }
    private static void setCapacitorPath(Context context, String path) { context.getSharedPreferences(CAP_PREFS, Context.MODE_PRIVATE).edit().putString(CAP_SERVER_PATH, path == null ? "" : path).apply(); }
    private static String toHex(byte[] bytes) { StringBuilder out = new StringBuilder(bytes.length * 2); for (byte b : bytes) out.append(String.format("%02x", b)); return out.toString(); }
    private static void deleteTree(File file) { if (file == null || !file.exists()) return; if (file.isDirectory()) { File[] items = file.listFiles(); if (items != null) for (File item : items) deleteTree(item); } file.delete(); }

    static final class Result {
        final boolean enabled; final boolean staged; final boolean current; final String version;
        private Result(boolean enabled, boolean staged, boolean current, String version) { this.enabled = enabled; this.staged = staged; this.current = current; this.version = version; }
        static Result disabled() { return new Result(false, false, false, ""); }
        static Result staged(String version) { return new Result(true, true, false, version); }
        static Result current(String version) { return new Result(true, false, true, version); }
    }
}

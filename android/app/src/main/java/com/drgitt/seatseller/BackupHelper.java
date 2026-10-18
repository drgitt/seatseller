package com.drgitt.seatseller;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Writes the app's backup JSON to a file the user picked once (for example in Google Drive). */
final class BackupHelper {
    private BackupHelper() {}

    private static SharedPreferences sp(Context c) { return c.getSharedPreferences(PriceCheckWorker.PREFS, Context.MODE_PRIVATE); }

    static boolean configured(Context c) { return !sp(c).getString("backupUri", "").isEmpty(); }

    /** Returns a short status string. Always overwrites the same file. */
    static String backup(Context c) {
        SharedPreferences p = sp(c);
        String uri = p.getString("backupUri", ""), json = p.getString("backupJson", "");
        if (uri.isEmpty()) return "Auto-backup is off";
        if (json.isEmpty()) return "Nothing to back up yet";
        String result;
        try (OutputStream os = c.getContentResolver().openOutputStream(Uri.parse(uri), "wt")) {
            if (os == null) throw new IllegalStateException("no stream");
            os.write(json.getBytes(StandardCharsets.UTF_8));
            os.flush();
            p.edit().putLong("lastBackup", System.currentTimeMillis()).apply();
            result = "OK";
        } catch (Exception e) {
            result = "Failed: " + e.getClass().getSimpleName() + (e.getMessage() != null ? " " + e.getMessage() : "");
        }
        p.edit().putString("lastBackupResult", result).apply();
        return result;
    }

    static void maybeBackup(Context c) {
        if (!configured(c)) return;
        long last = sp(c).getLong("lastBackup", 0L);
        if (System.currentTimeMillis() - last > 20L * 3600_000L) backup(c);
    }
}

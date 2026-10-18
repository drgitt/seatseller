package com.drgitt.seatseller;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.provider.CalendarContract;

import androidx.activity.result.ActivityResult;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/** Bridge between the web UI and the native notification code. */
@CapacitorPlugin(
        name = "SeatSeller",
        permissions = {
                @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS}),
                @Permission(alias = "calendar", strings = {Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR})
        }
)
public class SeatSellerPlugin extends Plugin {

    private JSObject status() {
        Context ctx = getContext();
        SharedPreferences sp = ctx.getSharedPreferences(PriceCheckWorker.PREFS, Context.MODE_PRIVATE);
        JSObject o = new JSObject();
        o.put("enabled", NotificationManagerCompat.from(ctx).areNotificationsEnabled());
        o.put("lastCheck", sp.getLong("lastCheck", 0L));
        o.put("lastResult", sp.getString("lastResult", ""));
        return o;
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(status());
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        PriceCheckWorker.ensureChannel(getContext());
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "permissionCallback");
        } else {
            call.resolve(status());
        }
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        call.resolve(status());
    }

    @PluginMethod
    public void testNotification(PluginCall call) {
        boolean ok = PriceCheckWorker.notifyUser(getContext(), "SeatSeller test", "Notifications are working. You will hear about games that are selling fast.", 1001);
        JSObject o = status();
        o.put("sent", ok);
        call.resolve(o);
    }

    @PluginMethod
    public void checkNow(final PluginCall call) {
        final Context ctx = getContext();
        new Thread(new Runnable() {
            @Override
            public void run() {
                String r = PriceCheckWorker.check(ctx);
                JSObject o = status();
                o.put("result", r);
                call.resolve(o);
            }
        }).start();
    }

    /* ---------- reminders ---------- */
    @PluginMethod
    public void syncReminders(PluginCall call) {
        try {
            JSONArray items = call.getArray("items");
            Reminders.replaceAll(getContext(), items == null ? new JSONArray() : items);
            call.resolve();
        } catch (Exception e) {
            call.reject("reminders: " + e.getMessage());
        }
    }

    /* ---------- calendar ---------- */
    @PluginMethod
    public void addToCalendarIntent(PluginCall call) {
        try {
            long start = CalendarSync.utcMidnight(call.getString("date"));
            Intent i = new Intent(Intent.ACTION_INSERT, CalendarContract.Events.CONTENT_URI)
                    .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, start)
                    .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, start + 86400000L)
                    .putExtra(CalendarContract.EXTRA_EVENT_ALL_DAY, true)
                    .putExtra(CalendarContract.Events.TITLE, call.getString("title", ""))
                    .putExtra(CalendarContract.Events.EVENT_LOCATION, call.getString("location", ""))
                    .putExtra(CalendarContract.Events.DESCRIPTION, call.getString("desc", ""));
            getActivity().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("calendar: " + e.getMessage());
        }
    }

    @PluginMethod
    public void syncCalendar(PluginCall call) {
        if (getPermissionState("calendar") != PermissionState.GRANTED) {
            requestPermissionForAlias("calendar", call, "calendarPermCallback");
        } else {
            runCalendar(call);
        }
    }

    @PermissionCallback
    private void calendarPermCallback(PluginCall call) {
        if (getPermissionState("calendar") == PermissionState.GRANTED) {
            runCalendar(call);
        } else {
            JSObject o = new JSObject();
            o.put("added", 0); o.put("updated", 0); o.put("removed", 0);
            o.put("error", "Calendar access was not allowed. You can allow it in Android Settings, Apps, SeatSeller, Permissions.");
            call.resolve(o);
        }
    }

    private void runCalendar(final PluginCall call) {
        final Context ctx = getContext();
        final JSONArray events = call.getArray("events");
        new Thread(new Runnable() {
            @Override
            public void run() {
                JSObject o = new JSObject();
                try {
                    String[] r = CalendarSync.run(ctx, events == null ? new JSONArray() : events);
                    o.put("added", Integer.parseInt(r[0])); o.put("updated", Integer.parseInt(r[1])); o.put("removed", Integer.parseInt(r[2]));
                    if (!r[3].isEmpty()) o.put("error", r[3]);
                } catch (Exception e) {
                    o.put("added", 0); o.put("updated", 0); o.put("removed", 0);
                    o.put("error", "Calendar sync failed: " + e.getMessage());
                }
                call.resolve(o);
            }
        }).start();
    }

    /* ---------- backup ---------- */
    private SharedPreferences sp() { return getContext().getSharedPreferences(PriceCheckWorker.PREFS, Context.MODE_PRIVATE); }

    @PluginMethod
    public void setBackupData(PluginCall call) {
        String json = call.getString("json", "");
        if (!json.isEmpty()) sp().edit().putString("backupJson", json).apply();
        call.resolve();
    }

    private JSObject backupStatus() {
        SharedPreferences p = sp();
        JSObject o = new JSObject();
        o.put("configured", !p.getString("backupUri", "").isEmpty());
        o.put("lastBackup", p.getLong("lastBackup", 0L));
        o.put("lastResult", p.getString("lastBackupResult", ""));
        return o;
    }

    @PluginMethod
    public void getBackupStatus(PluginCall call) { call.resolve(backupStatus()); }

    @PluginMethod
    public void chooseBackupFile(PluginCall call) {
        String json = call.getString("json", "");
        if (!json.isEmpty()) sp().edit().putString("backupJson", json).apply();
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType("application/json")
                .putExtra(Intent.EXTRA_TITLE, "SeatSeller-backup.json")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, i, "chooseBackupResult");
    }

    @ActivityCallback
    private void chooseBackupResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("cancelled");
            return;
        }
        final Uri uri = result.getData().getData();
        final Context ctx = getContext();
        try {
            ctx.getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        } catch (Exception ignored) { /* some providers only allow one-time access; the write below will tell us */ }
        sp().edit().putString("backupUri", uri.toString()).apply();
        final PluginCall c = call;
        new Thread(new Runnable() {
            @Override
            public void run() {
                BackupHelper.backup(ctx);
                c.resolve(backupStatus());
            }
        }).start();
    }

    @PluginMethod
    public void backupNow(final PluginCall call) {
        final Context ctx = getContext();
        new Thread(new Runnable() {
            @Override
            public void run() {
                BackupHelper.backup(ctx);
                call.resolve(backupStatus());
            }
        }).start();
    }

    @PluginMethod
    public void stopBackup(PluginCall call) {
        String u = sp().getString("backupUri", "");
        if (!u.isEmpty()) {
            try {
                getContext().getContentResolver().releasePersistableUriPermission(Uri.parse(u), Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            } catch (Exception ignored) { }
        }
        sp().edit().remove("backupUri").remove("lastBackup").remove("lastBackupResult").apply();
        call.resolve(backupStatus());
    }

    @PluginMethod
    public void restoreFromFile(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
        startActivityForResult(call, i, "restoreResult");
    }

    @ActivityCallback
    private void restoreResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("cancelled");
            return;
        }
        try (InputStream in = getContext().getContentResolver().openInputStream(result.getData().getData())) {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while (in != null && (n = in.read(buf)) > 0) bos.write(buf, 0, n);
            JSObject o = new JSObject();
            o.put("json", new String(bos.toByteArray(), StandardCharsets.UTF_8));
            call.resolve(o);
        } catch (Exception e) {
            call.reject("read failed: " + e.getMessage());
        }
    }
}

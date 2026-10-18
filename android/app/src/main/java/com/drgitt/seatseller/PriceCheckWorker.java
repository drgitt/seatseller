package com.drgitt.seatseller;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Fetches data/prices.json from the repo and posts a notification for each alert it has not shown yet.
 * Runs about every 3 hours through WorkManager, and on demand from the Check prices now button.
 */
public class PriceCheckWorker extends Worker {

    static final String CHANNEL_ID = "seatseller_alerts";
    static final String PREFS = "seatseller";
    static final String DATA_URL = "https://raw.githubusercontent.com/drgitt/seatseller/main/data/prices.json";
    private static final long MAX_ALERT_AGE_MS = 36L * 3600L * 1000L;

    public PriceCheckWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        String r = check(getApplicationContext());
        BackupHelper.maybeBackup(getApplicationContext());
        return r.startsWith("Failed") ? Result.retry() : Result.success();
    }

    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Ticket alerts", NotificationManager.IMPORTANCE_HIGH);
                ch.setDescription("Games that are selling fast, price jumps and tipoff reminders");
                nm.createNotificationChannel(ch);
            }
        }
    }

    static boolean notifyUser(Context ctx, String title, String body, int id) {
        ensureChannel(ctx);
        if (!NotificationManagerCompat.from(ctx).areNotificationsEnabled()) return false;
        Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        PendingIntent pi = null;
        if (launch != null) {
            launch.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            pi = PendingIntent.getActivity(ctx, id, launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        }
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_seat)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true);
        if (pi != null) b.setContentIntent(pi);
        try {
            NotificationManagerCompat.from(ctx).notify(id, b.build());
            return true;
        } catch (SecurityException e) {
            return false;
        }
    }

    private static String fetch(String address) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(address + "?t=" + System.currentTimeMillis()).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(20000);
        c.setRequestProperty("Cache-Control", "no-cache");
        int code = c.getResponseCode();
        if (code != 200) throw new Exception("HTTP " + code);
        InputStream in = c.getInputStream();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        in.close();
        c.disconnect();
        return out.toString("UTF-8");
    }

    private static long parseTime(String iso) {
        if (iso == null) return System.currentTimeMillis();
        String[] patterns = {"yyyy-MM-dd'T'HH:mm:ssXXX", "yyyy-MM-dd'T'HH:mm:ss.SSSXXX", "yyyy-MM-dd'T'HH:mm:ss'Z'"};
        for (String p : patterns) {
            try {
                return new SimpleDateFormat(p, Locale.US).parse(iso).getTime();
            } catch (Exception ignored) { }
        }
        return System.currentTimeMillis();
    }

    /** Returns a short status line, starting with "Failed" when the feed could not be read. */
    static String check(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String result;
        try {
            JSONObject root = new JSONObject(fetch(DATA_URL));
            JSONObject games = root.optJSONObject("games");
            int priced = games == null ? 0 : games.length();
            JSONArray alerts = root.optJSONArray("alerts");

            Set<String> seen = new HashSet<>(sp.getStringSet("seen", new HashSet<String>()));
            boolean first = !sp.getBoolean("initialized", false);
            int shown = 0;
            long now = System.currentTimeMillis();
            if (alerts != null) {
                for (int i = 0; i < alerts.length(); i++) {
                    JSONObject a = alerts.optJSONObject(i);
                    if (a == null) continue;
                    String id = a.optString("id", "");
                    if (id.isEmpty() || seen.contains(id)) continue;
                    long t = parseTime(a.optString("t", null));
                    seen.add(id);
                    if (first || now - t > MAX_ALERT_AGE_MS) continue;
                    if (notifyUser(ctx, a.optString("title", "SeatSeller"), a.optString("body", ""), id.hashCode())) shown++;
                }
            }
            if (seen.size() > 300) seen.clear();
            sp.edit().putStringSet("seen", seen).putBoolean("initialized", true).apply();
            result = "OK · " + priced + " games priced · " + shown + " new alert" + (shown == 1 ? "" : "s");
        } catch (Exception e) {
            String msg = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
            if (msg.contains("404")) msg = "HTTP 404 (price feed not public yet)";
            result = "Failed: " + msg;
        }
        sp.edit().putLong("lastCheck", System.currentTimeMillis()).putString("lastResult", result).apply();
        return result;
    }
}

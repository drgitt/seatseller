package com.drgitt.seatseller;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

/** Schedules the list-by and last-call reminders with AlarmManager (inexact, no special permission needed). */
final class Reminders {
    private Reminders() {}

    private static PendingIntent pi(Context ctx, String id, String title, String body, int flags) {
        Intent i = new Intent(ctx, ReminderReceiver.class).setAction(ReminderReceiver.ACTION);
        i.putExtra("title", title).putExtra("body", body).putExtra("nid", 2000 + (Math.abs(id.hashCode()) % 90000));
        return PendingIntent.getBroadcast(ctx, id.hashCode(), i, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    static synchronized void replaceAll(Context ctx, JSONArray items) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        SharedPreferences sp = ctx.getSharedPreferences(PriceCheckWorker.PREFS, Context.MODE_PRIVATE);
        try {
            JSONArray old = new JSONArray(sp.getString("remItems", "[]"));
            for (int k = 0; k < old.length(); k++) {
                JSONObject o = old.getJSONObject(k);
                PendingIntent p = pi(ctx, o.getString("id"), "", "", PendingIntent.FLAG_NO_CREATE);
                if (p != null) { am.cancel(p); p.cancel(); }
            }
        } catch (Exception ignored) { }
        sp.edit().putString("remItems", items.toString()).apply();
        schedule(ctx, items);
    }

    static void rescheduleFromStore(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PriceCheckWorker.PREFS, Context.MODE_PRIVATE);
        try { schedule(ctx, new JSONArray(sp.getString("remItems", "[]"))); } catch (Exception ignored) { }
    }

    private static void schedule(Context ctx, JSONArray items) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        long now = System.currentTimeMillis();
        for (int k = 0; k < items.length(); k++) {
            try {
                JSONObject o = items.getJSONObject(k);
                long at = o.getLong("at");
                if (at <= now) continue;
                PendingIntent p = pi(ctx, o.getString("id"), o.optString("title"), o.optString("body"), PendingIntent.FLAG_UPDATE_CURRENT);
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, p);
            } catch (Exception ignored) { }
        }
    }
}

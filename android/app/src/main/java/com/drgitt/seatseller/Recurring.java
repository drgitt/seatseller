package com.drgitt.seatseller;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import java.util.Calendar;

/**
 * Daily digest and weekly check reminders. Each one is its own alarm that re-arms itself every time it fires,
 * so it keeps coming even if the app is never opened and does not depend on the background price check.
 */
final class Recurring {
    static final String ACTION = "com.drgitt.seatseller.RECURRING";
    private Recurring() {}

    private static PendingIntent pi(Context ctx, String kind, int flags) {
        Intent i = new Intent(ctx, RecurringReceiver.class).setAction(ACTION).putExtra("kind", kind);
        return PendingIntent.getBroadcast(ctx, "digest".equals(kind) ? 7001 : 7002, i, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Next time at hour:00 on the given weekday (Calendar.SUNDAY..SATURDAY), or any day when weekday is 0. */
    static long next(int weekday, int hour) {
        Calendar c = Calendar.getInstance();
        c.set(Calendar.HOUR_OF_DAY, hour); c.set(Calendar.MINUTE, 0); c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0);
        long now = System.currentTimeMillis();
        for (int k = 0; k < 8; k++) {
            if ((weekday == 0 || c.get(Calendar.DAY_OF_WEEK) == weekday) && c.getTimeInMillis() > now + 30000) return c.getTimeInMillis();
            c.add(Calendar.DAY_OF_YEAR, 1);
        }
        return c.getTimeInMillis();
    }

    static void scheduleAll(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PriceCheckWorker.PREFS, Context.MODE_PRIVATE);
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        SharedPreferences.Editor ed = sp.edit();
        PendingIntent d = pi(ctx, "digest", PendingIntent.FLAG_UPDATE_CURRENT);
        if (sp.getBoolean("digestOn", true)) {
            long at = next(0, sp.getInt("digestHour", 8));
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, d);
            ed.putLong("nextDigestAt", at);
        } else { am.cancel(d); ed.putLong("nextDigestAt", 0L); }
        PendingIntent w = pi(ctx, "weekly", PendingIntent.FLAG_UPDATE_CURRENT);
        if (sp.getBoolean("weeklyOn", true)) {
            long at = next(sp.getInt("weeklyDay", Calendar.SUNDAY), sp.getInt("weeklyHour", 10));
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, w);
            ed.putLong("nextWeeklyAt", at);
        } else { am.cancel(w); ed.putLong("nextWeeklyAt", 0L); }
        ed.apply();
    }
}

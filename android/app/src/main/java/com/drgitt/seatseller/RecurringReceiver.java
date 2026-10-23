package com.drgitt.seatseller;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Posts the daily digest or weekly reminder, then arms the next one. */
public class RecurringReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent i) {
        if (i == null || !Recurring.ACTION.equals(i.getAction())) return;
        SharedPreferences sp = ctx.getSharedPreferences(PriceCheckWorker.PREFS, Context.MODE_PRIVATE);
        String kind = i.getStringExtra("kind");
        sp.edit().putLong("lastFiredAt", System.currentTimeMillis()).putString("lastFiredKind", String.valueOf(kind)).apply();
        try {
            if ("weekly".equals(kind)) {
                if (sp.getBoolean("weeklyOn", true))
                    PriceCheckWorker.notifyUser(ctx, "Weekly check", "About a minute: open SeatSeller, tap Weekly check, and log your section's prices.", 7002);
            } else if (sp.getBoolean("digestOn", true)) {
                String extra = sp.getString("digestExtra", ""), pend = sp.getString("digestPending", "");
                String body = extra + (!extra.isEmpty() && !pend.isEmpty() ? "\n\n" : "") + pend;
                if (body.isEmpty()) body = "Open SeatSeller to see today's advice.";
                if (PriceCheckWorker.notifyUser(ctx, "SeatSeller daily digest", body, 7001)) {
                    sp.edit().putString("digestDay", new SimpleDateFormat("yyyyMMdd", Locale.US).format(new Date())).putString("digestPending", "").apply();
                }
            }
        } finally {
            Recurring.scheduleAll(ctx);
        }
    }
}

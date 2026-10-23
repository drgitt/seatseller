package com.drgitt.seatseller;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Fires a stored reminder as a notification. */
public class ReminderReceiver extends BroadcastReceiver {
    static final String ACTION = "com.drgitt.seatseller.REMINDER";

    @Override
    public void onReceive(Context ctx, Intent i) {
        if (i == null || !ACTION.equals(i.getAction())) return;
        ctx.getSharedPreferences(PriceCheckWorker.PREFS, Context.MODE_PRIVATE).edit().putLong("lastFiredAt", System.currentTimeMillis()).putString("lastFiredKind", "reminder").apply();
        PriceCheckWorker.ensureChannel(ctx);
        PriceCheckWorker.notifyUser(ctx, i.getStringExtra("title"), i.getStringExtra("body"), i.getIntExtra("nid", 2000));
    }
}

package com.drgitt.seatseller;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Alarms are cleared on reboot, so put the saved reminders back. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent i) {
        if (i != null && Intent.ACTION_BOOT_COMPLETED.equals(i.getAction())) Reminders.rescheduleFromStore(ctx);
    }
}

package com.drgitt.seatseller;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/** Bridge between the web UI and the native notification code. */
@CapacitorPlugin(
        name = "SeatSeller",
        permissions = {
                @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})
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
}
